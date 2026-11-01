import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import Papa from "papaparse";
import { parseLocalizedNumber } from "@/lib/parse-localized-number";

const importSchema = z.object({
  fonte: z.string(),
  uf: z.string(),
  mes_ref: z.string(),
  tipo: z.enum(['insumo', 'composicao', 'composicao-analitica']),
  csvContent: z.string() // We pass the file content as text to avoid FormData issues in tRPC
});

export const importPrecosCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    // O middleware injeta um cliente com o Bearer token do usuário. Não criar
    // aqui um cliente anônimo, pois isso perderia a identidade e o RLS.
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    if (!supabase || !userId) return { ok: false, error: "Sessão autenticada não encontrada." };

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) return { ok: false, error: "Somente administradores podem importar bases de preços." };
    
    // Parse CSV. Remove BOM e espaços do cabeçalho para aceitar arquivos
    // SINAPI exportados com ponto e vírgula e cabeçalhos espaçados.
    const csvContent = data.csvContent.replace(/^\uFEFF/, '');
    const firstLine = csvContent.split('\n')[0] || '';
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, delimiter });
    
    if (data.tipo === 'composicao-analitica') {
      // Formato esperado: codigo_composicao, tipo_item (INSUMO/COMPOSICAO), codigo_item, coeficiente
      const porChave = new Map<string, any>();
      let linhasIgnoradas = 0;
      for (const rawRow of parsed.data as any[]) {
        const row: Record<string, string> = {};
        for (const [key, value] of Object.entries(rawRow as Record<string, unknown>)) {
          row[key.trim().toLowerCase()] = String(value ?? '').trim();
        }
        const codigoComposicao = row.codigo_composicao;
        const codigoItem = row.codigo_item;
        const tipoItem = row.tipo_item.toUpperCase();

        // O arquivo anexado tem uma linha marcadora para cada composição,
        // por exemplo: 104658;;;. Ela não é um item e não pode ser enviada à
        // coluna NOT NULL codigo_item.
        if (!codigoComposicao || !codigoItem || !tipoItem) {
          linhasIgnoradas++;
          continue;
        }
        if (!['INSUMO', 'COMPOSICAO'].includes(tipoItem)) {
          return { ok: false, error: `Tipo de item inválido na composição ${codigoComposicao}: ${tipoItem}` };
        }
        const coef = parseLocalizedNumber(row.coeficiente || '0');
        if (!Number.isFinite(coef)) {
          return { ok: false, error: `Coeficiente inválido na composição ${codigoComposicao}, item ${codigoItem}.` };
        }
        const item = {
          codigo_composicao: codigoComposicao,
          fonte: data.fonte.trim().toUpperCase(),
          tipo_item: tipoItem,
          codigo_item: codigoItem,
          coeficiente: coef,
        };
        // Evita duplicidade no mesmo CSV; a última ocorrência prevalece.
        porChave.set(`${codigoComposicao}|${item.fonte}|${tipoItem}|${codigoItem}`, item);
      }
      const itens = Array.from(porChave.values());
      if (itens.length === 0) return { ok: false, error: "Nenhum item analítico encontrado." };

      // Não dividir uma composição entre lotes: a RPC substitui a estrutura
      // inteira do código e apaga os itens antigos antes de inserir os novos.
      const grupos = new Map<string, any[]>();
      for (const item of itens) {
        const grupo = grupos.get(`${item.codigo_composicao}|${item.fonte}`) ?? [];
        grupo.push(item);
        grupos.set(`${item.codigo_composicao}|${item.fonte}`, grupo);
      }
      // Lotes menores reduzem o tempo de DELETE + INSERT + validação de FK
      // por chamada no Supabase, especialmente em catálogos já grandes.
      const MAX_ITENS_POR_LOTE = 250;
      const lotes: any[][] = [];
      let lote: any[] = [];
      for (const grupo of grupos.values()) {
        if (lote.length && lote.length + grupo.length > MAX_ITENS_POR_LOTE) {
          lotes.push(lote);
          lote = [];
        }
        lote.push(...grupo);
      }
      if (lote.length) lotes.push(lote);
      const codigos = Array.from(grupos.keys()).map(key => key.split('|')[0]);
      const { error: clearError } = await supabase.rpc('limpar_catalogo_composicao_itens_importacao', {
        p_fonte: data.fonte.trim().toUpperCase(),
        p_codigos: codigos,
      });
      if (clearError) return { ok: false, error: `Erro ao preparar a injeção analítica: ${clearError.message}` };
      for (const batch of lotes) {
        const { error: rpcError } = await supabase.rpc('inserir_catalogo_composicao_itens_lote', { payload: batch });
        if (rpcError) return { ok: false, error: `Erro na injeção analítica: ${rpcError.message}` };
      }
      return { ok: true, message: `Sucesso! ${itens.length} vínculos analíticos inseridos/atualizados em ${grupos.size} composições. ${linhasIgnoradas} linhas de cabeçalho foram ignoradas.` };
    }

    // Processamento Normal de Insumos / Composicoes Sinteticas
    const metadados: any[] = [];
    const precos: any[] = [];

    for (const rawRow of parsed.data as any[]) {
      // Create a lowercase key map to avoid issues with user CSV headers having caps or trailing spaces
      const row: any = {};
      for (const k in rawRow) {
         if(k) row[k.trim().toLowerCase()] = rawRow[k];
      }
      
      if (!row.codigo) continue; // Pula linhas vazias

      metadados.push({
        codigo: String(row.codigo).trim(),
        fonte: data.fonte,
        descricao: (row.descricao || row['descrição'] || 'Sem descrição').trim(),
        unidade: (row.unidade || 'un').trim()
      });

      const rawPd = row.preco_desonerado || row.custo_desonerado || '0';
      const rawPnd = row.preco_nao_desonerado || row.custo_nao_desonerado || '0';
      
      const pd = parseLocalizedNumber(rawPd);
      const pnd = parseLocalizedNumber(rawPnd);

      precos.push({
        codigo_insumo: data.tipo === 'insumo' ? String(row.codigo).trim() : undefined,
        codigo_composicao: data.tipo === 'composicao' ? String(row.codigo).trim() : undefined,
        fonte: data.fonte,
        uf: data.uf,
        mes_ref: data.mes_ref,
        preco_desonerado: pd,
        preco_nao_desonerado: pnd
      });
    }

    if (precos.length === 0) return { ok: false, error: "Nenhum dado válido encontrado no CSV." };

    // A. Upsert do Catálogo (garante que os itens existam)
    // Para catálogos grandes, dividimos em lotes de 1000 para não estourar o limite de payload da API
    const BATCH_SIZE = 1000;
    
    for (let i = 0; i < metadados.length; i += BATCH_SIZE) {
      const batch = metadados.slice(i, i + BATCH_SIZE);
      const catalogoRpc = data.tipo === 'insumo' ? 'upsert_catalogo_insumos_lote' : 'upsert_catalogo_composicoes_lote';
      const { error: catError } = await supabase.rpc(catalogoRpc, { payload: batch });
      if (catError) return { ok: false, error: `Erro no catálogo: ${catError.message}` };
    }

    // B. Upsert em Lote dos Preços usando a função de RPC 
    const rpcName = data.tipo === 'insumo' ? 'upsert_precos_insumos_lote' : 'upsert_precos_composicoes_lote';
    
    for (let i = 0; i < precos.length; i += BATCH_SIZE) {
      const batch = precos.slice(i, i + BATCH_SIZE);
      const { error: rpcError } = await supabase.rpc(rpcName, { payload: batch });
      if (rpcError) return { ok: false, error: `Erro na injeção de preços: ${rpcError.message}` };
    }

    return { ok: true, message: `Sucesso! ${precos.length} preços inseridos/atualizados.` };
  });

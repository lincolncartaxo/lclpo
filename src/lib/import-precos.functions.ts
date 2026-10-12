import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

// Since we are running on the server (Node/Vite), we need to initialize a server-side client
// to execute the RPC bypass without relying on the client-side session proxy directly for large inserts.
function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL or Key is missing in env vars.");
  return createClient(url, key);
}

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
  .handler(async ({ data }) => {
    const supabase = getServerSupabase();
    
    // Parse CSV
    const parsed = Papa.parse(data.csvContent, { header: true, skipEmptyLines: true });
    
    if (data.tipo === 'composicao-analitica') {
      // Formato esperado: codigo_composicao, tipo_item (INSUMO/COMPOSICAO), codigo_item, coeficiente
      const itens: any[] = [];
      for (const row of parsed.data as any[]) {
        const coef = parseFloat(String(row.coeficiente || '0').replace(',', '.'));
        itens.push({
          codigo_composicao: row.codigo_composicao,
          fonte: data.fonte,
          tipo_item: (row.tipo_item || 'INSUMO').toUpperCase(),
          codigo_item: row.codigo_item,
          coeficiente: isNaN(coef) ? 0 : coef
        });
      }
      if (itens.length === 0) return { ok: false, error: "Nenhum item analítico encontrado." };
      
      const BATCH_SIZE = 1000;
      for (let i = 0; i < itens.length; i += BATCH_SIZE) {
        const batch = itens.slice(i, i + BATCH_SIZE);
        const { error: rpcError } = await supabase.from('catalogo_composicao_itens').upsert(batch, { onConflict: 'codigo_composicao, fonte, tipo_item, codigo_item' });
        if (rpcError) return { ok: false, error: `Erro na injeção analítica: ${rpcError.message}` };
      }
      return { ok: true, message: `Sucesso! ${itens.length} vínculos analíticos inseridos/atualizados.` };
    }

    // Processamento Normal de Insumos / Composicoes Sinteticas
    const metadados: any[] = [];
    const precos: any[] = [];

    for (const row of parsed.data as any[]) {
      metadados.push({
        codigo: row.codigo,
        fonte: data.fonte,
        descricao: row.descricao || 'Sem descrição',
        unidade: row.unidade || 'un'
      });

      const pd = parseFloat(String(row.preco_desonerado || '0').replace(',', '.'));
      const pnd = parseFloat(String(row.preco_nao_desonerado || '0').replace(',', '.'));

      precos.push({
        codigo_insumo: data.tipo === 'insumo' ? row.codigo : undefined,
        codigo_composicao: data.tipo === 'composicao' ? row.codigo : undefined,
        fonte: data.fonte,
        uf: data.uf,
        mes_ref: data.mes_ref,
        preco_desonerado: isNaN(pd) ? 0 : pd,
        preco_nao_desonerado: isNaN(pnd) ? 0 : pnd
      });
    }

    if (precos.length === 0) return { ok: false, error: "Nenhum dado válido encontrado no CSV." };

    // A. Upsert do Catálogo (garante que os itens existam)
    const tabelaCat = data.tipo === 'insumo' ? 'catalogo_insumos' : 'catalogo_composicoes';
    
    // Para catálogos grandes, dividimos em lotes de 1000 para não estourar o limite de payload da API
    const BATCH_SIZE = 1000;
    
    for (let i = 0; i < metadados.length; i += BATCH_SIZE) {
      const batch = metadados.slice(i, i + BATCH_SIZE);
      const { error: catError } = await supabase.from(tabelaCat).upsert(batch, { onConflict: 'codigo, fonte' });
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

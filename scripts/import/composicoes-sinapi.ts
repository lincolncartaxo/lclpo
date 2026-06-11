/**
 * Importa o relatório SINAPI "Analítico de Composições" (.xlsx) para:
 *   - public.base_composicoes        (1 linha por composição, uf=NULL, mes_ref=NULL)
 *   - public.base_composicao_itens   (N filhos por composição, uf=NULL, mes_ref=NULL)
 *
 * Os COEFICIENTES são universais (não variam por UF/mês/desoneração).
 * Os PREÇOS de insumos ficam em public.base_insumos (importação separada).
 *
 * Layout esperado da planilha (aba "Analítico"):
 *   Col A: Grupo
 *   Col B: Código da Composição
 *   Col C: Tipo Item (vazio = linha-mãe; "COMPOSICAO" ou "INSUMO" = linha-filha)
 *   Col D: Código do Item
 *   Col E: Descrição
 *   Col F: Unidade
 *   Col G: Coeficiente
 *   Col H: Situação (ignorado)
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   bun run scripts/import/composicoes-sinapi.ts <arquivo.xlsx> [--fonte SINAPI]
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

type CompRow = {
  fonte: string;
  codigo: string;
  descricao: string;
  unidade: string | null;
  classe: string | null;
};
type ItemRow = {
  fonte: string;
  composicao_codigo: string;
  tipo: string; // INSUMO | COMPOSICAO
  insumo_codigo: string;
  descricao: string;
  unidade: string | null;
  coeficiente: number;
};

const BATCH = 1000;

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const fonte = (args.find((a) => a.startsWith('--fonte='))?.split('=')[1]) ?? 'SINAPI';
  if (!file) throw new Error('Uso: composicoes-sinapi.ts <arquivo.xlsx> [--fonte=SINAPI]');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log(`> Lendo ${file} ...`);
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });

  // Localiza o header
  let headerIdx = rows.findIndex(
    (r) => r && r[0] === 'Grupo' && String(r[1] ?? '').startsWith('Código'),
  );
  if (headerIdx < 0) throw new Error('Cabeçalho ("Grupo", "Código da Composição"...) não encontrado.');

  const comps = new Map<string, CompRow>();
  const items: ItemRow[] = [];
  let currentComp: string | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c == null || c === '')) continue;
    const grupo = (r[0] ?? '').toString().trim() || null;
    const codComp = r[1] == null ? '' : String(r[1]).trim();
    const tipoItem = (r[2] ?? '').toString().trim().toUpperCase();
    const codItem = r[3] == null ? '' : String(r[3]).trim();
    const descricao = (r[4] ?? '').toString().trim();
    const unidade = (r[5] ?? '').toString().trim() || null;
    const coef = r[6];

    if (!tipoItem) {
      // Linha-mãe (composição)
      if (!codComp || !descricao) continue;
      currentComp = codComp;
      if (!comps.has(codComp)) {
        comps.set(codComp, { fonte, codigo: codComp, descricao, unidade, classe: grupo });
      }
    } else {
      // Linha-filha
      const parent = codComp || currentComp;
      if (!parent || !codItem) continue;
      const n = typeof coef === 'number' ? coef : parseFloat(String(coef).replace(',', '.'));
      if (!isFinite(n)) continue;
      items.push({
        fonte,
        composicao_codigo: parent,
        tipo: tipoItem === 'COMPOSICAO' ? 'COMPOSICAO' : 'INSUMO',
        insumo_codigo: codItem,
        descricao,
        unidade,
        coeficiente: n,
      });
    }
  }

  console.log(`> Composições: ${comps.size}  | Itens: ${items.length}`);

  // Upsert composições
  const compArr = Array.from(comps.values());
  for (let i = 0; i < compArr.length; i += BATCH) {
    const slice = compArr.slice(i, i + BATCH);
    const { error } = await sb
      .from('base_composicoes')
      .upsert(slice, { onConflict: 'fonte,codigo', ignoreDuplicates: false });
    if (error) throw error;
    process.stdout.write(`\r  composições ${Math.min(i + BATCH, compArr.length)}/${compArr.length}`);
  }
  process.stdout.write('\n');

  // Upsert itens
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const { error } = await sb
      .from('base_composicao_itens')
      .upsert(slice, {
        onConflict: 'fonte,composicao_codigo,insumo_codigo',
        ignoreDuplicates: false,
      });
    if (error) throw error;
    process.stdout.write(`\r  itens ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }
  process.stdout.write('\n');

  console.log('> Importação concluída.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

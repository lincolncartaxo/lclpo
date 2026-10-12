/** Importa o Analítico SINAPI para catalogo_* e catalogo_composicao_itens. */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

type Comp = { codigo: string; fonte: string; descricao: string; unidade: string | null; classe: string | null };
type Item = { codigo_composicao: string; fonte: string; tipo_item: string; codigo_item: string; coeficiente: number };
type Insumo = { codigo: string; fonte: string; descricao: string; unidade: string | null; origem: string };
const BATCH = 1000;
async function main() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const fonte = args.find(a => a.startsWith('--fonte='))?.split('=')[1] ?? 'SINAPI';
  if (!file) throw new Error('Uso: composicoes-sinapi.ts <arquivo.xlsx> [--fonte=SINAPI]');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
  const headerIdx = rows.findIndex(r => r && r[0] === 'Grupo' && String(r[1] ?? '').startsWith('Código'));
  if (headerIdx < 0) throw new Error('Cabeçalho do relatório Analítico não encontrado.');
  const comps = new Map<string, Comp>(), insumos = new Map<string, Insumo>(), itens: Item[] = [];
  let current: string | null = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || r.every(c => c == null || c === '')) continue;
    const grupo = String(r[0] ?? '').trim() || null;
    const codigoComp = String(r[1] ?? '').trim(), tipo = String(r[2] ?? '').trim().toUpperCase();
    const codigoItem = String(r[3] ?? '').trim(), descricao = String(r[4] ?? '').trim();
    const unidade = String(r[5] ?? '').trim() || null;
    const coef = typeof r[6] === 'number' ? r[6] : Number(String(r[6] ?? '').replace(',', '.'));
    if (!tipo) {
      if (!codigoComp || !descricao) continue;
      current = codigoComp; comps.set(codigoComp, { codigo: codigoComp, fonte, descricao, unidade, classe: grupo });
    } else {
      const parent = codigoComp || current; if (!parent || !codigoItem || !Number.isFinite(coef)) continue;
      const tipoItem = tipo === 'COMPOSICAO' ? 'COMPOSICAO' : 'INSUMO';
      itens.push({ codigo_composicao: parent, fonte, tipo_item: tipoItem, codigo_item: codigoItem, coeficiente: coef });
      if (tipoItem === 'INSUMO') insumos.set(codigoItem, { codigo: codigoItem, fonte, descricao, unidade, origem: fonte });
    }
  }
  const upsert = async (table: string, data: any[], onConflict: string) => {
    for (let i = 0; i < data.length; i += BATCH) {
      const { error } = await (sb as any).from(table).upsert(data.slice(i, i + BATCH), { onConflict, ignoreDuplicates: false });
      if (error) throw error;
    }
  };
  await upsert('catalogo_composicoes', [...comps.values()], 'codigo,fonte');
  await upsert('catalogo_insumos', [...insumos.values()], 'codigo,fonte');
  await upsert('catalogo_composicao_itens', itens, 'codigo_composicao,fonte,tipo_item,codigo_item');
  console.log(`Importação concluída: ${comps.size} composições, ${insumos.size} insumos e ${itens.length} vínculos.`);
}
main().catch(e => { console.error(e); process.exit(1); });

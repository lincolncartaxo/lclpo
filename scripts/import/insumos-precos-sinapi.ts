/** Importa preços de insumos para catalogo_insumos + precos_historicos_insumos. */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
const BATCH = 1000;
const norm = (s: string) => s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const number = (v: any) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '');
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized); return Number.isFinite(n) ? n : 0;
};
async function main() {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
  const uf = args.find(a => a.startsWith('--uf='))?.split('=')[1]?.toUpperCase();
  const mes = args.find(a => a.startsWith('--mes='))?.split('=')[1];
  const fonte = args.find(a => a.startsWith('--fonte='))?.split('=')[1] ?? 'SINAPI';
  if (!file || !uf || !mes) throw new Error('Uso: insumos-precos-sinapi.ts <xlsx> --uf=PB --mes=YYYY-MM [--fonte=SINAPI]');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
  const headerIdx = rows.findIndex(r => r?.map((x: any) => norm(String(x ?? ''))).join('|').includes('codigo') && r.map((x: any) => norm(String(x ?? ''))).join('|').includes('descricao'));
  if (headerIdx < 0) throw new Error('Cabeçalho não encontrado.');
  const header = rows[headerIdx].map((x: any) => norm(String(x ?? '')));
  const find = (...parts: string[]) => header.findIndex((h: string) => parts.every(p => h.includes(norm(p))));
  const codigo = find('codigo'), descricao = find('descricao'), unidade = find('unidade');
  const deson = find('preco', 'desonerad') >= 0 ? find('preco', 'desonerad') : find('custo', 'desonerad');
  const ndeson = find('preco', 'nao desonerad') >= 0 ? find('preco', 'nao desonerad') : (find('custo', 'nao desonerad') >= 0 ? find('custo', 'nao desonerad') : find('preco', 'mediano'));
  if (codigo < 0 || descricao < 0) throw new Error('Colunas Código/Descrição não encontradas.');
  const catalogo: any[] = [], precos: any[] = [], seen = new Set<string>();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const cod = String(r[codigo] ?? '').trim(), desc = String(r[descricao] ?? '').trim();
    if (!cod || !desc) continue;
    if (!seen.has(cod)) { seen.add(cod); catalogo.push({ codigo: cod, fonte, descricao: desc, unidade: unidade >= 0 ? String(r[unidade] ?? '').trim() || null : null, origem: fonte }); }
    precos.push({ codigo_insumo: cod, fonte, uf, mes_ref: mes, preco_desonerado: deson >= 0 ? number(r[deson]) : 0, preco_nao_desonerado: ndeson >= 0 ? number(r[ndeson]) : 0 });
  }
  for (let i = 0; i < catalogo.length; i += BATCH) { const { error } = await (sb as any).from('catalogo_insumos').upsert(catalogo.slice(i, i+BATCH), { onConflict: 'codigo,fonte' }); if (error) throw error; }
  for (let i = 0; i < precos.length; i += BATCH) { const { error } = await (sb as any).rpc('upsert_precos_insumos_lote', { payload: precos.slice(i, i+BATCH) }); if (error) throw error; }
  console.log(`Importação concluída: ${catalogo.length} insumos em ${fonte}/${uf}/${mes}.`);
}
main().catch(e => { console.error(e); process.exit(1); });

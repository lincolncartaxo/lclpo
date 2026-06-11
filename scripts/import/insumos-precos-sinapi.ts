/**
 * Importa preços de insumos SINAPI (Relatório de Insumos por UF, mensal).
 * Popula public.base_insumos com (fonte, codigo, uf, mes_ref, preco_desonerado, preco_nao_desonerado).
 *
 * Como o layout SINAPI varia entre relatórios "ISD" (sintético desonerado),
 * "CSD" (custo sintético) etc., este script tenta detectar as colunas por
 * cabeçalho. Ajuste --col-* se necessário.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   bun run scripts/import/insumos-precos-sinapi.ts <arquivo.xlsx> \
 *     --uf=PB --mes=2026-04 [--fonte=SINAPI]
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const BATCH = 1000;

function normalize(s: string) {
  return s
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const uf = args.find((a) => a.startsWith('--uf='))?.split('=')[1];
  const mes = args.find((a) => a.startsWith('--mes='))?.split('=')[1]; // YYYY-MM
  const fonte = args.find((a) => a.startsWith('--fonte='))?.split('=')[1] ?? 'SINAPI';
  if (!file || !uf || !mes)
    throw new Error('Uso: insumos-precos-sinapi.ts <xlsx> --uf=PB --mes=YYYY-MM [--fonte=SINAPI]');

  const mesRef = `${mes}-01`;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });

  // Detecta linha de cabeçalho
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const r = rows[i] ?? [];
    const joined = r.map((x: any) => normalize(String(x ?? ''))).join('|');
    if (joined.includes('codigo') && joined.includes('descricao') && joined.includes('preco')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error('Cabeçalho não encontrado (precisa ter "Código", "Descrição" e algum "Preço").');

  const header = (rows[headerIdx] as any[]).map((x) => normalize(String(x ?? '')));
  const findCol = (...needles: string[]) =>
    header.findIndex((h) => needles.every((n) => h.includes(normalize(n))));

  const colCodigo = findCol('codigo');
  const colDescricao = findCol('descricao');
  const colUnidade = findCol('unidade');
  const colDeson = findCol('preco', 'desonerad');
  const colNDeson =
    findCol('preco', 'nao desonerad') >= 0
      ? findCol('preco', 'nao desonerad')
      : findCol('preco', 'mediano'); // fallback
  if (colCodigo < 0 || colDescricao < 0) throw new Error('Colunas Código/Descrição não encontradas.');

  console.log(
    `> Colunas: codigo=${colCodigo} descricao=${colDescricao} unidade=${colUnidade} deson=${colDeson} nao_deson=${colNDeson}`,
  );

  const toNum = (v: any) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  };

  const payload: any[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const codigo = r[colCodigo] == null ? '' : String(r[colCodigo]).trim();
    const descricao = (r[colDescricao] ?? '').toString().trim();
    if (!codigo || !descricao) continue;
    payload.push({
      fonte,
      codigo,
      descricao,
      unidade: colUnidade >= 0 ? (r[colUnidade] ?? '').toString().trim() || null : null,
      uf,
      mes_ref: mesRef,
      preco_desonerado: colDeson >= 0 ? toNum(r[colDeson]) : null,
      preco_nao_desonerado: colNDeson >= 0 ? toNum(r[colNDeson]) : null,
      origem: 'SINAPI',
    });
  }

  console.log(`> Insumos: ${payload.length} (uf=${uf}, mes=${mesRef})`);

  for (let i = 0; i < payload.length; i += BATCH) {
    const slice = payload.slice(i, i + BATCH);
    const { error } = await sb
      .from('base_insumos')
      .upsert(slice, { onConflict: 'fonte,codigo,uf,mes_ref', ignoreDuplicates: false });
    if (error) throw error;
    process.stdout.write(`\r  ${Math.min(i + BATCH, payload.length)}/${payload.length}`);
  }
  process.stdout.write('\n> Concluído.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

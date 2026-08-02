import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { fmtBRL } from "@/lib/format";
import { Search, ChevronLeft, ChevronRight, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bases")({
  head: () => ({ meta: [{ title: "Bases — Orça" }] }),
  component: Bases,
});

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const FONTES = ["SINAPI", "DER", "SICRO3", "SBC", "ORSE", "PRÓPRIA", "Outras"];
const PAGE_SIZE = 10;
const PROPRIA = "PRÓPRIA";
const toMesRef = (mes: string) => mes && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : mes;

function Filtros({
  uf, setUf, mes, setMes, fonte, setFonte,
}: {
  uf: string; setUf: (v: string) => void;
  mes: string; setMes: (v: string) => void;
  fonte: string; setFonte: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end mb-4">
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Estado</Label>
        <Select value={uf} onValueChange={setUf}>
          <SelectTrigger className="w-28"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos</SelectItem>
            {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Mês de Referência</Label>
        <Input type="month" className="w-40" value={mes} onChange={e => setMes(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Fonte</Label>
        <Select value={fonte} onValueChange={setFonte}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas</SelectItem>
            {FONTES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Bases() {
  const [uf, setUf] = useState<string>("__all");
  const [mes, setMes] = useState<string>("");
  const [fonte, setFonte] = useState<string>("__all");
  const [reloadKey, setReloadKey] = useState(0);
  const bump = () => setReloadKey(k => k + 1);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Bases de Preços</h1>
      <p className="text-sm text-muted-foreground mb-6">Composições e insumos referenciais. Filtre por estado, mês e fonte.</p>

      <Filtros uf={uf} setUf={setUf} mes={mes} setMes={setMes} fonte={fonte} setFonte={setFonte} />

      <Tabs defaultValue="composicoes">
        <TabsList>
          <TabsTrigger value="composicoes">Composições</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
        </TabsList>
        <TabsContent value="composicoes"><CompList uf={uf} mes={mes} fonte={fonte} reloadKey={reloadKey} onReload={bump} /></TabsContent>
        <TabsContent value="insumos"><InsList uf={uf} mes={mes} fonte={fonte} reloadKey={reloadKey} onReload={bump} /></TabsContent>
      </Tabs>
    </div>
  );
}

function usePaged<T = any>(
  table: "base_composicoes" | "base_insumos",
  columns: string,
  { uf, mes, fonte, q, page, reloadKey }: { uf: string; mes: string; fonte: string; q: string; page: number; reloadKey: number },
) {
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query: any = supabase.from(table).select(columns, { count: "exact" }).range(from, to).order("codigo");
      if (fonte !== "__all") query = query.eq("fonte", fonte);
      if (uf !== "__all") query = query.eq("uf", uf);
      if (mes) query = query.eq("mes_ref", toMesRef(mes));
      if (q.trim()) query = query.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
      const { data, count: c } = await query;
      setRows((data as T[]) ?? []);
      setCount(c ?? 0);
    }, 250);
    return () => clearTimeout(t);
  }, [table, columns, uf, mes, fonte, q, page, reloadKey]);
  return { rows, count };
}

function Pager({ page, setPage, count }: { page: number; setPage: (n: number) => void; count: number }) {
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between p-2 text-sm">
      <span className="text-muted-foreground">{count} registro(s) · página {page} de {totalPages}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

async function computeCompTotals(comp: { codigo: string; fonte: string }, uf: string, mes: string) {
  const args = { p_fonte: comp.fonte, p_codigo: comp.codigo, p_uf: uf === "__all" ? "PB" : uf, p_mes_ref: toMesRef(mes) || null };
  const [{ data: deson }, { data: naoDeson }] = await Promise.all([
    supabase.rpc("calcular_custo_composicao", { ...args, p_regime: "desonerado" }),
    supabase.rpc("calcular_custo_composicao", { ...args, p_regime: "nao_desonerado" }),
  ]);
  return { deson: Number(deson) || 0, nao_deson: Number(naoDeson) || 0 };
}

function CompList({ uf, mes, fonte, reloadKey, onReload }: { uf: string; mes: string; fonte: string; reloadKey: number; onReload: () => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [cpuRow, setCpuRow] = useState<any | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [computed, setComputed] = useState<Record<string, { deson: number; nao_deson: number }>>({});
  useEffect(() => { setPage(1); }, [uf, mes, fonte, q]);
  const { rows, count } = usePaged<any>(
    "base_composicoes",
    "id,codigo,descricao,unidade,custo_desonerado,custo_nao_desonerado,uf,mes_ref,fonte",
    { uf, mes, fonte, q, page, reloadKey },
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(rows.map(async (r: any) => [r.id, await computeCompTotals(r, uf, mes)] as const));
      if (cancelled) return;
      const map: Record<string, { deson: number; nao_deson: number }> = {};
      entries.forEach(([id, v]) => { map[id] = v; });
      setComputed(map);
    })();
    return () => { cancelled = true; };
  }, [rows, uf, mes]);

  const remove = async (r: any) => {
    const { error } = await supabase.from("base_composicao_itens").delete().eq("fonte", PROPRIA).eq("composicao_codigo", r.codigo);
    if (error) return toast.error(error.message);
    const { error: e2 } = await supabase.from("base_composicoes").delete().eq("id", r.id);
    if (e2) return toast.error(e2.message);
    toast.success("Composição excluída"); setConfirmDel(null); onReload();
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
        <Button onClick={()=>setOpenNew(true)}><Plus className="mr-2 size-4" />Nova composição</Button>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="budget-table">
          <thead><tr>
            <th>Fonte</th><th>UF</th><th>Mês</th><th>Código</th><th>Descrição</th><th>Unid.</th>
            <th className="num">Desonerado</th><th className="num">Não Desonerado</th><th style={{width:90}}></th>
          </tr></thead>
          <tbody>{rows.map((r,i)=> {
            const c = computed[r.id];
            const d = c?.deson ?? Number(r.custo_desonerado) ?? 0;
            const n = c?.nao_deson ?? Number(r.custo_nao_desonerado) ?? 0;
            return (
              <tr key={i} className="hover:bg-muted/30">
                <td>{r.fonte}</td><td>{r.uf ?? "—"}</td><td>{r.mes_ref ?? "—"}</td>
                <td>
                  <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={()=>setCpuRow(r)} title="Composição de Preço Unitário">
                    <Layers className="size-3" />{r.codigo}
                  </button>
                </td>
                <td>{r.descricao}</td><td>{r.unidade}</td>
                <td className="num">{fmtBRL(d)}</td>
                <td className="num">{fmtBRL(n)}</td>
                <td className="text-right">
                  {r.fonte === PROPRIA && (
                    <button onClick={()=>setConfirmDel(r)} className="text-destructive hover:opacity-70"><Trash2 className="size-4"/></button>
                  )}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro para os filtros selecionados.</div>}
        <Pager page={page} setPage={setPage} count={count} />
      </div>

      <CpuSheet row={cpuRow} uf={uf} mes={mes} onClose={()=>setCpuRow(null)} />
      <NovaComposicaoDialog open={openNew} setOpen={setOpenNew} onCreated={onReload} />
      <ConfirmDeleteDialog
        open={!!confirmDel}
        title="Excluir composição"
        message={confirmDel ? `Excluir a composição "${confirmDel.codigo} — ${confirmDel.descricao}" e sua CPU?` : ""}
        onCancel={()=>setConfirmDel(null)}
        onConfirm={()=>confirmDel && remove(confirmDel)}
      />
    </div>
  );
}

function InsList({ uf, mes, fonte, reloadKey, onReload }: { uf: string; mes: string; fonte: string; reloadKey: number; onReload: () => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  useEffect(() => { setPage(1); }, [uf, mes, fonte, q]);
  const { rows, count } = usePaged<any>(
    "base_insumos",
    "id,codigo,descricao,unidade,preco_desonerado,preco_nao_desonerado,origem,uf,mes_ref,fonte",
    { uf, mes, fonte, q, page, reloadKey },
  );
  const remove = async (r: any) => {
    const { error } = await supabase.from("base_insumos").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Insumo excluído"); setConfirmDel(null); onReload();
  };
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
        <Button onClick={()=>setOpenNew(true)}><Plus className="mr-2 size-4" />Novo insumo</Button>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="budget-table">
          <thead><tr>
            <th>Fonte</th><th>UF</th><th>Mês</th><th>Código</th><th>Descrição</th><th>Unid.</th><th>Origem</th>
            <th className="num">Desonerado</th><th className="num">Não Desonerado</th><th style={{width:90}}></th>
          </tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i}>
              <td>{r.fonte}</td><td>{r.uf ?? "—"}</td><td>{r.mes_ref ?? "—"}</td>
              <td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td><td>{r.origem ?? "—"}</td>
              <td className="num">{fmtBRL(r.preco_desonerado)}</td>
              <td className="num">{fmtBRL(r.preco_nao_desonerado)}</td>
              <td className="text-right">
                {r.fonte === PROPRIA && (
                  <button onClick={()=>setConfirmDel(r)} className="text-destructive hover:opacity-70"><Trash2 className="size-4"/></button>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro para os filtros selecionados.</div>}
        <Pager page={page} setPage={setPage} count={count} />
      </div>
      <NovoInsumoDialog open={openNew} setOpen={setOpenNew} onCreated={onReload} />
      <ConfirmDeleteDialog
        open={!!confirmDel}
        title="Excluir insumo"
        message={confirmDel ? `Excluir o insumo "${confirmDel.codigo} — ${confirmDel.descricao}"?` : ""}
        onCancel={()=>setConfirmDel(null)}
        onConfirm={()=>confirmDel && remove(confirmDel)}
      />
    </div>
  );
}

/* ---------- CPU SHEET (somente composições) ---------- */
function CpuSheet({ row, uf, mes, onClose }: { row: any | null; uf: string; mes: string; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!row) { setRows([]); return; }
    setLoading(true);
    (async () => {
      const { data: itens } = await supabase
        .from("base_composicao_itens")
        .select("*")
        .eq("fonte", row.fonte)
        .eq("composicao_codigo", row.codigo);

      if (!itens || itens.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const insumoCodigos = itens.filter((i: any) => i.tipo !== 'COMPOSICAO').map((i: any) => i.insumo_codigo).filter(Boolean);
      const compCodigos = itens.filter((i: any) => i.tipo === 'COMPOSICAO').map((i: any) => i.insumo_codigo).filter(Boolean);

      let insumosPriceMap: Record<string, any> = {};
      let compPriceMap: Record<string, any> = {};

      if (insumoCodigos.length > 0) {
        let q = supabase.from("base_insumos").select("codigo, preco_desonerado, preco_nao_desonerado").eq("fonte", row.fonte).in("codigo", insumoCodigos);
        if (uf !== "__all") q = q.eq("uf", uf);
        if (mes) q = q.eq("mes_ref", toMesRef(mes));
        const { data: insData } = await q;
        if (insData) insData.forEach(d => insumosPriceMap[d.codigo] = d);
      }

      if (compCodigos.length > 0) {
        const entries = await Promise.all(compCodigos.map(async (codigo: string) => {
          const totals = await computeCompTotals({ codigo, fonte: row.fonte }, uf, mes);
          return [codigo, { preco_desonerado: totals.deson, preco_nao_desonerado: totals.nao_deson }] as const;
        }));
        compPriceMap = Object.fromEntries(entries);
      }

      const rowsWithPrices = itens.map((i: any) => {
        const p = i.tipo === 'COMPOSICAO' ? compPriceMap[i.insumo_codigo] : insumosPriceMap[i.insumo_codigo];
        return {
          ...i,
          preco_desonerado: p?.preco_desonerado || 0,
          preco_nao_desonerado: p?.preco_nao_desonerado || 0,
        };
      });

      setRows(rowsWithPrices);
      setLoading(false);
    })();
  }, [row, uf, mes]);

  const totalDeson = rows.reduce((acc, r) => acc + Number(r.coeficiente) * (r.preco_desonerado || 0), 0);
  const totalNaoDeson = rows.reduce((acc, r) => acc + Number(r.coeficiente) * (r.preco_nao_desonerado || 0), 0);

  return (
    <Sheet open={!!row} onOpenChange={(o)=>{ if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-4xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Composição de Preço Unitário</SheetTitle>
          <SheetDescription>
            {row ? <>{row.fonte} · {row.codigo} — {row.descricao}</> : null}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 overflow-x-auto rounded border">
          <table className="budget-table">
            <thead><tr>
              <th>Tipo</th><th>Código</th><th>Descrição</th><th>Un.</th><th className="num">Coef.</th>
              <th className="num">Pr. Deson.</th><th className="num">Tot. Deson.</th>
              <th className="num">Pr. Não Deson.</th><th className="num">Tot. Não Deson.</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.tipo ?? "—"}</td>
                  <td>{r.insumo_codigo ?? "—"}</td>
                  <td>{r.descricao}</td>
                  <td>{r.unidade ?? "—"}</td>
                  <td className="num">{Number(r.coeficiente).toLocaleString("pt-BR",{minimumFractionDigits:4,maximumFractionDigits:6})}</td>
                  <td className="num">{fmtBRL(r.preco_desonerado)}</td>
                  <td className="num">{fmtBRL((r.preco_desonerado || 0) * Number(r.coeficiente))}</td>
                  <td className="num">{fmtBRL(r.preco_nao_desonerado)}</td>
                  <td className="num">{fmtBRL((r.preco_nao_desonerado || 0) * Number(r.coeficiente))}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-6 text-xs italic">
                  Nenhum item de composição cadastrado para este código.
                </td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-muted/50">
                  <td colSpan={6} className="text-right">Total</td>
                  <td className="num">{fmtBRL(totalDeson)}</td>
                  <td></td>
                  <td className="num">{fmtBRL(totalNaoDeson)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Os preços dos insumos são aplicados conforme regime, UF e mês do orçamento ao usar a composição.</p>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- ITEM PICKER (busca em base_insumos OU base_composicoes) ---------- */
type PickedItem = {
  tipo: "INSUMO" | "COMPOSICAO";
  codigo: string;
  descricao: string;
  unidade: string | null;
  preco_desonerado: number;
  preco_nao_desonerado: number;
};

function ItemPickerDialog({
  open, setOpen, uf, mes_ref, onPick,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  uf: string; mes_ref: string;
  onPick: (item: PickedItem) => void;
}) {
  const [tipo, setTipo] = useState<"INSUMO" | "COMPOSICAO">("INSUMO");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!open) { setQ(""); setResults([]); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      setLoading(true);
      if (tipo === "INSUMO") {
        let qy = supabase.from("base_insumos")
          .select("codigo,descricao,unidade,preco_desonerado,preco_nao_desonerado")
          .or(`codigo.ilike.%${q}%,descricao.ilike.%${q}%`).limit(20);
        if (uf) qy = qy.eq("uf", uf);
        if (mes_ref) qy = qy.eq("mes_ref", mes_ref);
        const { data } = await qy;
        setResults((data ?? []).map((d: any) => ({
          tipo: "INSUMO", codigo: d.codigo, descricao: d.descricao, unidade: d.unidade,
          preco_desonerado: Number(d.preco_desonerado) || 0,
          preco_nao_desonerado: Number(d.preco_nao_desonerado) || 0,
        })));
      } else {
        let qy = supabase.from("base_composicoes")
          .select("codigo,descricao,unidade,custo_desonerado,custo_nao_desonerado")
          .or(`codigo.ilike.%${q}%,descricao.ilike.%${q}%`).limit(20);
        if (uf) qy = qy.eq("uf", uf);
        if (mes_ref) qy = qy.eq("mes_ref", mes_ref);
        const { data } = await qy;
        setResults((data ?? []).map((d: any) => ({
          tipo: "COMPOSICAO", codigo: d.codigo, descricao: d.descricao, unidade: d.unidade,
          preco_desonerado: Number(d.custo_desonerado) || 0,
          preco_nao_desonerado: Number(d.custo_nao_desonerado) || 0,
        })));
      }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, tipo, uf, mes_ref, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Selecionar item do banco</DialogTitle></DialogHeader>
        <div className="flex gap-2 items-end mb-2">
          <div className="grid gap-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INSUMO">Insumo</SelectItem>
                <SelectItem value="COMPOSICAO">Composição</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 flex-1">
            <Label className="text-xs">Código ou descrição</Label>
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite para buscar…" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Filtrando por UF: {uf || "—"} · Mês: {mes_ref || "—"}</p>
        <div className="rounded border max-h-80 overflow-y-auto mt-2">
          <table className="budget-table">
            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="num">Deson.</th><th className="num">Não Deson.</th><th style={{width:80}}></th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.codigo}>
                  <td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade ?? "—"}</td>
                  <td className="num">{fmtBRL(r.preco_desonerado)}</td>
                  <td className="num">{fmtBRL(r.preco_nao_desonerado)}</td>
                  <td className="text-right"><Button size="sm" onClick={() => { onPick(r); setOpen(false); }}>Selecionar</Button></td>
                </tr>
              ))}
              {!loading && results.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-4 text-xs italic">
                  {q.trim() ? "Nenhum item encontrado para esta UF/Mês." : "Digite para buscar."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- NOVA COMPOSIÇÃO (somente itens do banco, totais automáticos) ---------- */
type CpuLine = PickedItem & { coeficiente: string };

function NovaComposicaoDialog({ open, setOpen, onCreated }: { open: boolean; setOpen: (v: boolean)=>void; onCreated: () => void }) {
  const [f, setF] = useState({ codigo: "", descricao: "", unidade: "un", uf: "", mes_ref: "" });
  const [lines, setLines] = useState<CpuLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reset = () => { setF({ codigo: "", descricao: "", unidade: "un", uf: "", mes_ref: "" }); setLines([]); };
  const totalDeson = lines.reduce((acc, l) => acc + (Number(l.coeficiente.replace(",", ".")) || 0) * (l.preco_desonerado || 0), 0);
  const totalNaoDeson = lines.reduce((acc, l) => acc + (Number(l.coeficiente.replace(",", ".")) || 0) * (l.preco_nao_desonerado || 0), 0);

  const onPick = (item: PickedItem) => {
    if (lines.some(l => l.codigo === item.codigo && l.tipo === item.tipo)) {
      return toast.error("Item já adicionado");
    }
    setLines(prev => [...prev, { ...item, coeficiente: "1" }]);
  };

  const submit = async () => {
    if (!f.codigo.trim() || !f.descricao.trim()) return toast.error("Código e descrição obrigatórios");
    if (lines.length === 0) return toast.error("Adicione pelo menos 1 item à CPU (a partir do banco)");

    const { error } = await supabase.from("base_composicoes").insert({
      fonte: PROPRIA, codigo: f.codigo.trim(), descricao: f.descricao.trim(), unidade: f.unidade.trim() || null,
      uf: f.uf || null, mes_ref: f.mes_ref || null,
      custo_desonerado: totalDeson,
      custo_nao_desonerado: totalNaoDeson,
    });
    if (error) return toast.error(error.message);

    const itens = lines.map(l => ({
      fonte: PROPRIA, composicao_codigo: f.codigo.trim(),
      insumo_codigo: l.codigo, descricao: l.descricao,
      unidade: l.unidade || null, coeficiente: Number(l.coeficiente.replace(",", ".")) || 0,
      tipo: l.tipo, uf: f.uf || null, mes_ref: f.mes_ref || null,
    }));
    const { error: e2 } = await supabase.from("base_composicao_itens").insert(itens);
    if (e2) return toast.error(e2.message);

    toast.success("Composição criada");
    reset(); setOpen(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Nova composição (fonte PRÓPRIA)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Código</Label><Input value={f.codigo} onChange={(e)=>setF({...f, codigo: e.target.value})} placeholder="Ex.: PROP-001" /></div>
          <div className="col-span-2"><Label>Descrição</Label><Input value={f.descricao} onChange={(e)=>setF({...f, descricao: e.target.value})} /></div>
          <div><Label>Unidade</Label><Input value={f.unidade} onChange={(e)=>setF({...f, unidade: e.target.value})} /></div>
          <div><Label>UF (data-base)</Label>
            <Select value={f.uf || "__none"} onValueChange={(v)=>setF({...f, uf: v === "__none" ? "" : v})}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Mês de Referência</Label><Input type="month" value={f.mes_ref} onChange={(e)=>setF({...f, mes_ref: e.target.value})} /></div>
          <div><Label>Custo Desonerado (R$)</Label><Input readOnly className="bg-muted" value={fmtBRL(totalDeson)} /></div>
          <div><Label>Custo Não Desonerado (R$)</Label><Input readOnly className="bg-muted" value={fmtBRL(totalNaoDeson)} /></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold">Composição de Preço Unitário</Label>
            <Button size="sm" variant="secondary" onClick={()=>setPickerOpen(true)}><Plus className="size-3 mr-1" />Adicionar item do banco</Button>
          </div>
          <div className="rounded border overflow-x-auto max-h-72 overflow-y-auto">
            <table className="budget-table">
              <thead><tr>
                <th style={{width:110}}>Tipo</th><th style={{width:120}}>Código</th><th>Descrição</th>
                <th style={{width:80}}>Un.</th>
                <th className="num" style={{width:110}}>Coef.</th>
                <th className="num" style={{width:110}}>Pr. Deson.</th>
                <th className="num" style={{width:110}}>Pr. N/Deson.</th>
                <th style={{width:40}}></th>
              </tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={`${l.tipo}-${l.codigo}`}>
                    <td>{l.tipo === "COMPOSICAO" ? "Composição" : "Insumo"}</td>
                    <td>{l.codigo}</td>
                    <td>{l.descricao}</td>
                    <td>{l.unidade ?? "—"}</td>
                    <td><Input className="h-8 text-right" value={l.coeficiente} onChange={(e)=>setLines(prev => prev.map((p,j)=> j===i ? {...p, coeficiente: e.target.value} : p))} /></td>
                    <td className="num">{fmtBRL(l.preco_desonerado)}</td>
                    <td className="num">{fmtBRL(l.preco_nao_desonerado)}</td>
                    <td><button className="text-destructive" onClick={()=>setLines(prev => prev.filter((_,j)=>j!==i))}><Trash2 className="size-4"/></button></td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-4 text-xs italic">
                    Nenhum item adicionado. Use "Adicionar item do banco" para incluir insumos ou composições já cadastrados.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Os preços são extraídos do banco conforme UF e Mês de Referência informados acima. Apenas o coeficiente é editável.</p>
        </div>

        <DialogFooter><Button onClick={submit}>Criar composição</Button></DialogFooter>

        <ItemPickerDialog open={pickerOpen} setOpen={setPickerOpen} uf={f.uf} mes_ref={f.mes_ref} onPick={onPick} />
      </DialogContent>
    </Dialog>
  );
}

/* ---------- NOVO INSUMO ---------- */
function NovoInsumoDialog({ open, setOpen, onCreated }: { open: boolean; setOpen: (v: boolean)=>void; onCreated: () => void }) {
  const [f, setF] = useState({ codigo: "", descricao: "", unidade: "un", origem: "", uf: "", mes_ref: "", preco_desonerado: "0", preco_nao_desonerado: "0" });
  const reset = () => setF({ codigo: "", descricao: "", unidade: "un", origem: "", uf: "", mes_ref: "", preco_desonerado: "0", preco_nao_desonerado: "0" });
  const submit = async () => {
    if (!f.codigo.trim() || !f.descricao.trim()) return toast.error("Código e descrição obrigatórios");
    const { error } = await supabase.from("base_insumos").insert({
      fonte: PROPRIA, codigo: f.codigo.trim(), descricao: f.descricao.trim(), unidade: f.unidade.trim() || null,
      origem: f.origem.trim() || null, uf: f.uf || null, mes_ref: f.mes_ref || null,
      preco_desonerado: Number(f.preco_desonerado.replace(",", ".")) || 0,
      preco_nao_desonerado: Number(f.preco_nao_desonerado.replace(",", ".")) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Insumo criado"); reset(); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo insumo (fonte PRÓPRIA)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Código</Label><Input value={f.codigo} onChange={(e)=>setF({...f, codigo: e.target.value})} /></div>
          <div className="col-span-2"><Label>Descrição</Label><Input value={f.descricao} onChange={(e)=>setF({...f, descricao: e.target.value})} /></div>
          <div><Label>Unidade</Label><Input value={f.unidade} onChange={(e)=>setF({...f, unidade: e.target.value})} /></div>
          <div><Label>Origem</Label><Input value={f.origem} onChange={(e)=>setF({...f, origem: e.target.value})} /></div>
          <div><Label>UF</Label>
            <Select value={f.uf || "__none"} onValueChange={(v)=>setF({...f, uf: v === "__none" ? "" : v})}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Mês de Referência</Label><Input type="month" value={f.mes_ref} onChange={(e)=>setF({...f, mes_ref: e.target.value})} /></div>
          <div><Label>Preço Desonerado (R$)</Label><Input value={f.preco_desonerado} onChange={(e)=>setF({...f, preco_desonerado: e.target.value})} /></div>
          <div><Label>Preço Não Desonerado (R$)</Label><Input value={f.preco_nao_desonerado} onChange={(e)=>setF({...f, preco_nao_desonerado: e.target.value})} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Criar insumo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- CONFIRM DELETE ---------- */
function ConfirmDeleteDialog({ open, title, message, onCancel, onConfirm }: { open: boolean; title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o)=>{ if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Excluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

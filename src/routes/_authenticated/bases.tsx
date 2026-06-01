import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtBRL } from "@/lib/format";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bases")({
  head: () => ({ meta: [{ title: "Bases SINAPI/DER — Orça" }] }),
  component: Bases,
});

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const FONTES = ["SINAPI", "DER", "SICRO3", "SBC", "ORSE", "Outras"];
const PAGE_SIZE = 10;

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
        <TabsContent value="composicoes"><CompList uf={uf} mes={mes} fonte={fonte} /></TabsContent>
        <TabsContent value="insumos"><InsList uf={uf} mes={mes} fonte={fonte} /></TabsContent>
      </Tabs>
    </div>
  );
}

function usePaged<T = any>(
  table: "base_composicoes" | "base_insumos",
  columns: string,
  { uf, mes, fonte, q, page }: { uf: string; mes: string; fonte: string; q: string; page: number },
) {
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query: any = supabase.from(table).select(columns, { count: "exact" }).range(from, to);
      if (fonte !== "__all") query = query.eq("fonte", fonte);
      if (uf !== "__all") query = query.eq("uf", uf);
      if (mes) query = query.eq("mes_ref", mes);
      if (q.trim()) query = query.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
      const { data, count: c } = await query;
      setRows((data as T[]) ?? []);
      setCount(c ?? 0);
    }, 250);
    return () => clearTimeout(t);
  }, [table, columns, uf, mes, fonte, q, page]);
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

function CompList({ uf, mes, fonte }: { uf: string; mes: string; fonte: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [uf, mes, fonte, q]);
  const { rows, count } = usePaged<any>(
    "base_composicoes",
    "codigo,descricao,unidade,custo_desonerado,custo_nao_desonerado,uf,mes_ref,fonte",
    { uf, mes, fonte, q, page },
  );
  return (
    <div className="mt-4">
      <div className="relative max-w-md mb-3">
        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="budget-table">
          <thead><tr>
            <th>Fonte</th><th>UF</th><th>Mês</th><th>Código</th><th>Descrição</th><th>Unid.</th>
            <th className="num">Desonerado</th><th className="num">Não Desonerado</th>
          </tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i}>
              <td>{r.fonte}</td><td>{r.uf ?? "—"}</td><td>{r.mes_ref ?? "—"}</td>
              <td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td>
              <td className="num">{fmtBRL(r.custo_desonerado)}</td>
              <td className="num">{fmtBRL(r.custo_nao_desonerado)}</td>
            </tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro para os filtros selecionados.</div>}
        <Pager page={page} setPage={setPage} count={count} />
      </div>
    </div>
  );
}

function InsList({ uf, mes, fonte }: { uf: string; mes: string; fonte: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [uf, mes, fonte, q]);
  const { rows, count } = usePaged<any>(
    "base_insumos",
    "codigo,descricao,unidade,preco_desonerado,preco_nao_desonerado,origem,uf,mes_ref,fonte",
    { uf, mes, fonte, q, page },
  );
  return (
    <div className="mt-4">
      <div className="relative max-w-md mb-3">
        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="budget-table">
          <thead><tr>
            <th>Fonte</th><th>UF</th><th>Mês</th><th>Código</th><th>Descrição</th><th>Unid.</th><th>Origem</th>
            <th className="num">Desonerado</th><th className="num">Não Desonerado</th>
          </tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i}>
              <td>{r.fonte}</td><td>{r.uf ?? "—"}</td><td>{r.mes_ref ?? "—"}</td>
              <td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td><td>{r.origem ?? "—"}</td>
              <td className="num">{fmtBRL(r.preco_desonerado)}</td>
              <td className="num">{fmtBRL(r.preco_nao_desonerado)}</td>
            </tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro para os filtros selecionados.</div>}
        <Pager page={page} setPage={setPage} count={count} />
      </div>
    </div>
  );
}

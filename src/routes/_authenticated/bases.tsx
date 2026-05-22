import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtBRL } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bases")({
  head: () => ({ meta: [{ title: "Bases SINAPI/DER — Orça" }] }),
  component: Bases,
});

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const FONTES = ["SINAPI", "DER", "SICRO3", "SBC", "ORSE", "Outras"];

function Filtros({
  uf, setUf, mes, setMes, fonte, setFonte, showFonte = true,
}: {
  uf: string; setUf: (v: string) => void;
  mes: string; setMes: (v: string) => void;
  fonte: string; setFonte: (v: string) => void;
  showFonte?: boolean;
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
      {showFonte && (
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
      )}
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

function useFiltered<T = any>(
  table: "base_composicoes" | "base_insumos",
  columns: string,
  { uf, mes, fonte, q }: { uf: string; mes: string; fonte: string; q: string },
) {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      let query: any = supabase.from(table).select(columns).limit(200);
      if (fonte !== "__all") query = query.eq("fonte", fonte);
      if (uf !== "__all") query = query.eq("uf", uf);
      if (mes) query = query.eq("mes_ref", mes);
      if (q.trim()) query = query.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
      const { data } = await query;
      setRows((data as T[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [table, columns, uf, mes, fonte, q]);
  return rows;
}

function CompList({ uf, mes, fonte }: { uf: string; mes: string; fonte: string }) {
  const [q, setQ] = useState("");
  const rows = useFiltered<any>(
    "base_composicoes",
    "codigo,descricao,unidade,custo_unitario,custo_desonerado,custo_nao_desonerado,uf,mes_ref,fonte",
    { uf, mes, fonte, q },
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
              <td className="num">{fmtBRL(r.custo_desonerado ?? r.custo_unitario)}</td>
              <td className="num">{fmtBRL(r.custo_nao_desonerado ?? r.custo_unitario)}</td>
            </tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro para os filtros selecionados.</div>}
      </div>
    </div>
  );
}

function InsList({ uf, mes, fonte }: { uf: string; mes: string; fonte: string }) {
  const [q, setQ] = useState("");
  const rows = useFiltered<any>(
    "base_insumos",
    "codigo,descricao,unidade,preco,preco_desonerado,preco_nao_desonerado,origem,uf,mes_ref,fonte",
    { uf, mes, fonte, q },
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
              <td className="num">{fmtBRL(r.preco_desonerado ?? r.preco)}</td>
              <td className="num">{fmtBRL(r.preco_nao_desonerado ?? r.preco)}</td>
            </tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro para os filtros selecionados.</div>}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtBRL } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bases")({
  head: () => ({ meta: [{ title: "Bases SINAPI/DER — Orça" }] }),
  component: Bases,
});

function Bases() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Bases de Preços</h1>
      <p className="text-sm text-muted-foreground mb-6">Composições e insumos referenciais para orçamentação.</p>
      <Tabs defaultValue="sinapi-comp">
        <TabsList>
          <TabsTrigger value="sinapi-comp">SINAPI Composições</TabsTrigger>
          <TabsTrigger value="sinapi-ins">SINAPI Insumos</TabsTrigger>
          <TabsTrigger value="der">DER</TabsTrigger>
        </TabsList>
        <TabsContent value="sinapi-comp"><CompList fonte="SINAPI" /></TabsContent>
        <TabsContent value="sinapi-ins"><InsList /></TabsContent>
        <TabsContent value="der"><CompList fonte="DER" /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompList({ fonte }: { fonte: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase.from("base_composicoes").select("codigo,descricao,unidade,custo_unitario").eq("fonte", fonte).limit(100);
      if (q.trim()) query = query.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
      const { data } = await query;
      setRows(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, fonte]);
  return (
    <div className="mt-4">
      <div className="relative max-w-md mb-3"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} /></div>
      <div className="overflow-x-auto rounded border">
        <table className="budget-table">
          <thead><tr><th>Código</th><th>Descrição</th><th>Unid.</th><th className="num">Custo Unit.</th></tr></thead>
          <tbody>{rows.map((r,i)=>(<tr key={i}><td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td><td className="num">{fmtBRL(r.custo_unitario)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
function InsList() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase.from("base_insumos").select("codigo,descricao,unidade,preco,origem").limit(100);
      if (q.trim()) query = query.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
      const { data } = await query;
      setRows(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="mt-4">
      <div className="relative max-w-md mb-3"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} /></div>
      <div className="overflow-x-auto rounded border">
        <table className="budget-table">
          <thead><tr><th>Código</th><th>Descrição</th><th>Unid.</th><th>Origem</th><th className="num">Preço</th></tr></thead>
          <tbody>{rows.map((r,i)=>(<tr key={i}><td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td><td>{r.origem}</td><td className="num">{fmtBRL(r.preco)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

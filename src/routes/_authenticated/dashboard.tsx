import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Meus Orçamentos — Orça" }] }),
  component: Dashboard,
});

type Orc = { id: string; nome: string; objeto: string | null; municipio: string | null; status: string; updated_at: string; total?: number };

function Dashboard() {
  const nav = useNavigate();
  const [orcs, setOrcs] = useState<Orc[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", objeto: "", municipio: "", uf: "", orgao: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("orcamentos").select("id,nome,objeto,municipio,status,updated_at").order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    // total via items aggregate
    const ids = (data ?? []).map((o) => o.id);
    let totals: Record<string, number> = {};
    if (ids.length) {
      const { data: items } = await supabase.from("orcamento_itens").select("orcamento_id,quantidade,preco_unitario").in("orcamento_id", ids);
      (items ?? []).forEach((it: any) => {
        totals[it.orcamento_id] = (totals[it.orcamento_id] ?? 0) + Number(it.quantidade) * Number(it.preco_unitario);
      });
    }
    setOrcs((data ?? []).map((o) => ({ ...o, total: totals[o.id] ?? 0 })));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.nome) return toast.error("Informe o nome do orçamento");
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("orcamentos").insert({ ...form, user_id: user!.id }).select().single();
    setLoading(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    nav({ to: "/orcamento/$id", params: { id: data!.id } });
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Meus Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie seus orçamentos de obra.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />Novo orçamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome do orçamento</Label><Input value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})} placeholder="Ex.: Construção de Campo de Futebol" /></div>
              <div><Label>Objeto</Label><Textarea value={form.objeto} onChange={(e)=>setForm({...form,objeto:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Município</Label><Input value={form.municipio} onChange={(e)=>setForm({...form,municipio:e.target.value})} /></div>
                <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e)=>setForm({...form,uf:e.target.value.toUpperCase()})} /></div>
              </div>
              <div><Label>Órgão / Concedente</Label><Input value={form.orgao} onChange={(e)=>setForm({...form,orgao:e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={loading}>{loading?"Criando…":"Criar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {orcs.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <FileSpreadsheet className="size-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Você ainda não tem orçamentos. Crie o primeiro.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {orcs.map((o) => (
            <Link key={o.id} to="/orcamento/$id" params={{ id: o.id }} className="rounded-lg border bg-card p-5 hover:border-primary transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{o.nome}</h3>
                  <p className="text-sm text-muted-foreground">{o.municipio || "—"} · {o.objeto?.slice(0,60) || "Sem objeto"}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-secondary">{o.status}</span>
              </div>
              <div className="mt-4 text-lg font-semibold">{fmtBRL(o.total)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

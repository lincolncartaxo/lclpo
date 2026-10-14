import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Meus Orçamentos — LclPlan" }] }), component: Dashboard,
});

type Orc = { id: string; nome: string; objeto: string | null; localizacao?: string | null; municipio: string | null; status: string; updated_at: string };
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
type Base = { fonte: string; mes_ref: string };
const fmtBase = (b: Base) => { const [y,m] = String(b.mes_ref).split("-"); return `${b.fonte} · ${m && y ? `${m}/${y}` : b.mes_ref}`; };

function Dashboard() {
  const nav = useNavigate();
  const [orcs, setOrcs] = useState<Orc[]>([]);
  const [open, setOpen] = useState(false);
  const [bases, setBases] = useState<Base[]>([]);
  const [form, setForm] = useState({ nome: "", objeto: "", localizacao: "", uf: "", ref_precos: "", orgao: "", regime: "nao_desonerado" });
  const [loading, setLoading] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.from("orcamentos").select("id,nome,objeto,localizacao,municipio,status,updated_at").order("updated_at", { ascending: false }).limit(50);
    if (error) return toast.error(error.message); setOrcs((data ?? []) as unknown as Orc[]);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!form.uf) { setBases([]); setForm(v => ({ ...v, ref_precos: "" })); return; }
    (supabase as any).rpc("listar_bases_precos", { p_uf: form.uf }).then(({ data, error }: any) => {
      if (error) return toast.error(error.message);
      const next = (data ?? []) as Base[]; setBases(next);
      setForm(v => ({ ...v, ref_precos: v.ref_precos && next.some(b => `${b.fonte}|${b.mes_ref}` === v.ref_precos) ? v.ref_precos : (next[0] ? `${next[0].fonte}|${next[0].mes_ref}` : "") }));
    });
  }, [form.uf]);
  const create = async () => {
    if (!form.nome || !form.uf || !form.ref_precos) return toast.error("Informe nome, UF e data base");
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any).from("orcamentos").insert({ ...form, municipio: form.localizacao, user_id: user!.id }).select().single();
    setLoading(false);
    if (error) return toast.error(error.message.includes("Limite do plano atingido") ? `${error.message} Faça upgrade quando os planos pagos estiverem disponíveis.` : error.message);
    setOpen(false); nav({ to: "/orcamento/$id", params: { id: data!.id } });
  };
  return <div className="p-8 max-w-6xl">
    <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-semibold">Meus Orçamentos</h1><p className="text-sm text-muted-foreground">Crie e gerencie seus orçamentos de obra.</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 size-4" />Novo orçamento</Button></DialogTrigger><DialogContent>
        <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader><div className="space-y-3">
          <div><Label>Nome do orçamento</Label><Input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} placeholder="Ex.: Construção de Campo de Futebol" /></div>
          <div><Label>Objeto</Label><Textarea value={form.objeto} onChange={e=>setForm({...form,objeto:e.target.value})} /></div>
          <div><Label>Endereço / localização da intervenção</Label><Input value={form.localizacao} onChange={e=>setForm({...form,localizacao:e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>UF da base de preços</Label><Select value={form.uf} onValueChange={v=>setForm({...form,uf:v})}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent className="max-h-72">{UFS.map(u=><SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Data base / fonte</Label><Select value={form.ref_precos} onValueChange={v=>setForm({...form,ref_precos:v})} disabled={!form.uf}><SelectTrigger><SelectValue placeholder="Última disponível" /></SelectTrigger><SelectContent className="max-h-72">{bases.map(b=><SelectItem key={`${b.fonte}|${b.mes_ref}`} value={`${b.fonte}|${b.mes_ref}`}>{fmtBase(b)}</SelectItem>)}</SelectContent></Select></div></div>
          <div><Label>Regime tributário</Label><Select value={form.regime} onValueChange={v=>setForm({...form,regime:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nao_desonerado">Não Desonerado</SelectItem><SelectItem value="desonerado">Desonerado</SelectItem></SelectContent></Select></div>
          <div><Label>Órgão / Concedente</Label><Input value={form.orgao} onChange={e=>setForm({...form,orgao:e.target.value})} /></div>
        </div><DialogFooter><Button onClick={create} disabled={loading}>{loading?"Criando…":"Criar"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
    {orcs.length === 0 ? <div className="border border-dashed rounded-lg p-12 text-center"><FileSpreadsheet className="size-10 mx-auto text-muted-foreground" /><p className="mt-3 text-muted-foreground">Você ainda não tem orçamentos. Crie o primeiro.</p></div> : <div className="grid gap-3 md:grid-cols-2">{orcs.map(o=><Link key={o.id} to="/orcamento/$id" params={{id:o.id}} className="rounded-lg border bg-card p-5 hover:border-primary transition"><div className="flex items-start justify-between"><div><h3 className="font-semibold">{o.nome}</h3><p className="text-sm text-muted-foreground">{o.localizacao || o.municipio || "—"} · {o.objeto?.slice(0,60) || "Sem objeto"}</p></div><span className="text-xs px-2 py-1 rounded bg-secondary">{o.status}</span></div><div className="mt-4 text-sm font-medium text-blue-600 hover:underline">Abrir orçamento →</div></Link>)}</div>}
  </div>;
}

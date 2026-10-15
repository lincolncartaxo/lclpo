import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet, Trash2, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Meus Orçamentos — LclPlan" }] }),
  component: Dashboard,
});

type Orc = {
  id: string;
  nome: string;
  objeto: string | null;
  localizacao?: string | null;
  municipio: string | null;
  status: string;
  updated_at: string;
};
type Base = { fonte: string; mes_ref: string };

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];
const fmtBase = (b: Base) => {
  const [y, m] = String(b.mes_ref).split("-");
  return `${b.fonte} · ${m && y ? `${m}/${y}` : b.mes_ref}`;
};
const missingLocalizacao = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === "42703" || error.code === "PGRST204" || error.message?.toLowerCase().includes("localizacao")));

function Dashboard() {
  const nav = useNavigate();
  const [orcs, setOrcs] = useState<Orc[]>([]);
  const [open, setOpen] = useState(false);
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusSaving, setStatusSaving] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", objeto: "", localizacao: "", uf: "", ref_precos: "", orgao: "", regime: "nao_desonerado" });

  const load = async () => {
    let { data, error } = await (supabase as any)
      .from("orcamentos")
      .select("id,nome,objeto,localizacao,municipio,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (missingLocalizacao(error)) {
      const fallback = await (supabase as any)
        .from("orcamentos")
        .select("id,nome,objeto,municipio,status,updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      data = (fallback.data ?? []).map((item: any) => ({ ...item, localizacao: item.municipio }));
      error = fallback.error;
    }
    if (error) return toast.error(error.message);
    setOrcs((data ?? []) as Orc[]);
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!form.uf) {
      setBases([]);
      return;
    }
    (supabase as any).rpc("listar_bases_precos", { p_uf: form.uf }).then(({ data, error }: any) => {
      if (error) return toast.error(error.message);
      const next = (data ?? []) as Base[];
      setBases(next);
      setForm((value) => ({
        ...value,
        ref_precos: value.ref_precos && next.some((base) => `${base.fonte}|${base.mes_ref}` === value.ref_precos)
          ? value.ref_precos
          : (next[0] ? `${next[0].fonte}|${next[0].mes_ref}` : ""),
      }));
    });
  }, [form.uf]);

  const create = async () => {
    if (!form.nome || !form.uf || !form.ref_precos) return toast.error("Informe nome, UF e data base");
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...form, municipio: form.localizacao, user_id: user!.id };
    let { data, error } = await (supabase as any).from("orcamentos").insert(payload).select().single();
    if (missingLocalizacao(error)) {
      const fallback: Record<string, unknown> = { ...payload };
      delete fallback.localizacao;
      ({ data, error } = await (supabase as any).from("orcamentos").insert(fallback).select().single());
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    nav({ to: "/orcamento/$id", params: { id: data.id } });
  };

  const updateStatus = async (id: string, status: string) => {
    setStatusSaving(id);
    const { error } = await (supabase as any)
      .from("orcamentos")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    setStatusSaving(null);
    if (error) return toast.error(`Não foi possível alterar o status: ${error.message}`);
    setOrcs((current) => current.map((orc) => orc.id === id ? { ...orc, status, updated_at: new Date().toISOString() } : orc));
    toast.success("Status do orçamento atualizado");
  };

  const duplicate = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nome = window.prompt("Nome do orçamento copiado", "Cópia do orçamento");
    if (!nome?.trim()) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("duplicar_orcamento", { p_orcamento_id: id, p_nome: nome.trim() });
    setLoading(false);
    if (error) return toast.error("Erro ao duplicar: " + error.message);
    toast.success("Orçamento duplicado como modelo");
    void load();
    if (data) nav({ to: "/orcamento/$id", params: { id: data } });
  };

  const del = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir este orçamento permanentemente?")) return;
    setLoading(true);
    const { error } = await supabase.from("orcamentos").delete().eq("id", id);
    setLoading(false);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    toast.success("Orçamento excluído com sucesso!");
    void load();
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
              <div><Label>Nome do orçamento</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>Objeto</Label><Textarea value={form.objeto} onChange={(e) => setForm({ ...form, objeto: e.target.value })} /></div>
              <div><Label>Endereço / localização da intervenção</Label><Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>UF da base de preços</Label>
                  <Select value={form.uf} onValueChange={(uf) => setForm({ ...form, uf })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-72">{UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data base / fonte</Label>
                  <Select value={form.ref_precos} onValueChange={(ref_precos) => setForm({ ...form, ref_precos })} disabled={!form.uf}>
                    <SelectTrigger><SelectValue placeholder="Última disponível" /></SelectTrigger>
                    <SelectContent className="max-h-72">{bases.map((base) => <SelectItem key={`${base.fonte}|${base.mes_ref}`} value={`${base.fonte}|${base.mes_ref}`}>{fmtBase(base)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Regime tributário</Label>
                <Select value={form.regime} onValueChange={(regime) => setForm({ ...form, regime })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_desonerado">Não Desonerado</SelectItem>
                    <SelectItem value="desonerado">Desonerado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Órgão / Concedente</Label><Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={loading}>{loading ? "Criando…" : "Criar"}</Button></DialogFooter>
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
          {orcs.map((orc) => (
            <BudgetCard
              key={orc.id}
              orc={orc}
              statusSaving={statusSaving === orc.id}
              onStatusChange={updateStatus}
              onDuplicate={(event) => duplicate(orc.id, event)}
              onDelete={(event) => del(orc.id, event)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type BudgetCardProps = {
  orc: Orc;
  statusSaving: boolean;
  onStatusChange: (id: string, status: string) => void;
  onDuplicate: (event: React.MouseEvent) => void;
  onDelete: (event: React.MouseEvent) => void;
};

function BudgetCard({ orc, statusSaving, onStatusChange, onDuplicate, onDelete }: BudgetCardProps) {
  const statusValue = orc.status || "rascunho";
  const hasKnownStatus = STATUS_OPTIONS.some((option) => option.value === statusValue);

  return (
    <div className="rounded-lg border bg-card p-5 hover:border-primary transition group">
      <div className="flex items-start justify-between gap-3">
        <Link to="/orcamento/$id" params={{ id: orc.id }} className="min-w-0 pr-2 block">
          <h3 className="font-semibold">{orc.nome}</h3>
          <p className="text-sm text-muted-foreground">{orc.localizacao || orc.municipio || "—"} · {orc.objeto?.slice(0, 60) || "Sem objeto"}</p>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Select value={statusValue} onValueChange={(status) => onStatusChange(orc.id, status)} disabled={statusSaving}>
            <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Status do orçamento ${orc.nome}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              {!hasKnownStatus && <SelectItem value={statusValue}>{statusValue}</SelectItem>}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={onDuplicate} title="Duplicar como modelo" disabled={statusSaving}>
              <Copy className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete} title="Excluir orçamento" disabled={statusSaving}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <Link to="/orcamento/$id" params={{ id: orc.id }} className="mt-4 block text-sm font-medium text-blue-600 hover:underline">
        Abrir orçamento →
      </Link>
    </div>
  );
}

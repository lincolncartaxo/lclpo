import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Trash2, Save, Calculator } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { pageMetadata } from "@/lib/route-metadata";

export const Route = createFileRoute("/_authenticated/cotacoes")({
  head: () => pageMetadata("Cotações", "Cotações de fornecedores reutilizáveis nos orçamentos da empresa."),
  component: CotacoesPage,
});

type Quote = any;
type Proposal = any;
const blank = { tipo_item: "servico", codigo: "", fonte: "", descricao: "", unidade: "UN", data_cotacao: new Date().toISOString().slice(0, 10), quantidade_propostas_desejadas: "3", metodo_calculo: "mediana", observacao: "" };
const blankProposal = { fornecedor_nome: "", fornecedor_cnpj: "", fornecedor_contato: "", fornecedor_email: "", nome_contato: "", data_proposta: new Date().toISOString().slice(0, 10), unidade: "UN", valor: "", observacao: "" };

function CotacoesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...blank });
  const [proposal, setProposal] = useState<any>({ ...blankProposal });
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from("cotacoes_empresa").select("*").order("updated_at", { ascending: false });
    if (error) return toast.error(`Não foi possível carregar as cotações: ${error.message}`);
    setQuotes(data ?? []);
    if (selected) await loadProposals(selected.id);
  }, [selected]);
  const loadProposals = async (id: string) => {
    const { data, error } = await (supabase as any).from("cotacao_propostas").select("*").eq("cotacao_id", id).order("data_proposta");
    if (error) return toast.error(error.message);
    setProposals(data ?? []);
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (quote: Quote) => { setSelected(quote); await loadProposals(quote.id); };
  const createQuote = async () => {
    if (!form.descricao.trim() || !form.unidade.trim()) return toast.error("Informe descrição e unidade");
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await (supabase as any).from("profiles").select("id_empresa").eq("id", user?.id).single();
    if (!profile?.id_empresa) return toast.error("Usuário sem empresa vinculada");
    setLoading(true);
    const { data, error } = await (supabase as any).from("cotacoes_empresa").insert({ ...form, quantidade_propostas_desejadas: Number(form.quantidade_propostas_desejadas), created_by: user?.id, organization_id: profile.id_empresa }).select().single();
    setLoading(false);
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ ...blank }); await load(); if (data) await choose(data); toast.success("Cotação criada");
  };
  const addProposal = async () => {
    if (!selected) return;
    if (!proposal.fornecedor_nome.trim() || proposal.valor === "" || Number(proposal.valor) < 0) return toast.error("Informe fornecedor e valor válido");
    const { error } = await (supabase as any).from("cotacao_propostas").insert({ ...proposal, cotacao_id: selected.id, valor: Number(proposal.valor) });
    if (error) return toast.error(error.message);
    setProposal({ ...blankProposal, unidade: selected.unidade }); await loadProposals(selected.id); await load(); toast.success("Proposta adicionada");
  };
  const removeProposal = async (id: string) => {
    if (!confirm("Excluir esta proposta?")) return;
    const { error } = await (supabase as any).from("cotacao_propostas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected) { await loadProposals(selected.id); await load(); }
  };
  const calculation = useMemo(() => {
    const values = proposals.map(p => Number(p.valor)).filter(Number.isFinite);
    if (!values.length) return 0;
    if (selected?.metodo_calculo === "menor") return Math.min(...values);
    if (selected?.metodo_calculo === "media") return values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }, [proposals, selected]);
  const saveMethod = async (method: string) => { if (!selected) return; const { error } = await (supabase as any).from("cotacoes_empresa").update({ metodo_calculo: method }).eq("id", selected.id); if (error) return toast.error(error.message); setSelected({ ...selected, metodo_calculo: method }); await load(); };
  const deleteQuote = async (id: string) => { if (!confirm("Excluir a cotação e suas propostas?")) return; const { error } = await (supabase as any).from("cotacoes_empresa").delete().eq("id", id); if (error) return toast.error(error.message); setSelected(null); setProposals([]); await load(); };
  const count = selected ? proposals.length : 0;
  return <div className="p-8 max-w-7xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold flex items-center gap-2"><ClipboardList className="size-6 text-primary" /> Cotações da empresa</h1><p className="text-sm text-muted-foreground mt-1">Cadastre propostas de fornecedores uma vez e reutilize o preço calculado em qualquer orçamento da sua empresa.</p></div><Button onClick={() => setOpen(true)}><Plus className="mr-2 size-4" />Nova cotação</Button></div>
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card><CardHeader><CardTitle className="text-base">Cotações cadastradas</CardTitle><CardDescription>{quotes.length} cotação(ões) disponíveis para a empresa.</CardDescription></CardHeader><CardContent className="space-y-2">{quotes.map(q => <button key={q.id} type="button" onClick={() => void choose(q)} className={`w-full text-left rounded-md border p-3 hover:border-primary ${selected?.id === q.id ? "border-primary bg-primary/5" : ""}`}><div className="font-medium truncate">{q.descricao}</div><div className="text-xs text-muted-foreground mt-1">{q.fonte || "Sem fonte"} · {q.unidade} · {q.quantidade_propostas_desejadas} propostas desejadas</div></button>)}{!quotes.length && <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma cotação cadastrada.</div>}</CardContent></Card>
      {selected ? <Card><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>{selected.descricao}</CardTitle><CardDescription>{selected.tipo_item} · {selected.codigo || "sem código"} · {selected.fonte || "fonte própria"} · {selected.data_cotacao}</CardDescription></div><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void deleteQuote(selected.id)} title="Excluir cotação"><Trash2 className="size-4" /></Button></CardHeader><CardContent className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><div><Label>Propostas recebidas</Label><div className="text-2xl font-semibold">{count} / {selected.quantidade_propostas_desejadas}</div></div><div><Label>Método de cálculo</Label><Select value={selected.metodo_calculo} onValueChange={saveMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mediana">Mediana</SelectItem><SelectItem value="media">Média aritmética</SelectItem><SelectItem value="menor">Menor valor</SelectItem></SelectContent></Select></div><div><Label>Preço calculado</Label><div className="text-2xl font-semibold text-primary">{calculation ? fmtBRL(calculation) : "—"}</div></div><div className="flex items-end"><Badge variant={count >= Number(selected.quantidade_propostas_desejadas) ? "default" : "secondary"}>{count >= Number(selected.quantidade_propostas_desejadas) ? "Pronta para uso" : "Aguardando propostas"}</Badge></div></div>
        <div className="rounded-lg border p-4 bg-muted/20"><h3 className="font-semibold mb-3">Adicionar proposta de fornecedor</h3><div className="grid gap-3 md:grid-cols-3"><Field label="Fornecedor"><Input value={proposal.fornecedor_nome} onChange={e => setProposal({ ...proposal, fornecedor_nome: e.target.value })} placeholder="Razão social / nome" /></Field><Field label="CNPJ"><Input value={proposal.fornecedor_cnpj} onChange={e => setProposal({ ...proposal, fornecedor_cnpj: e.target.value })} /></Field><Field label="Valor cotado"><Input type="number" min="0" step="0.01" value={proposal.valor} onChange={e => setProposal({ ...proposal, valor: e.target.value })} /></Field><Field label="Nome do contato"><Input value={proposal.nome_contato} onChange={e => setProposal({ ...proposal, nome_contato: e.target.value })} /></Field><Field label="Contato"><Input value={proposal.fornecedor_contato} onChange={e => setProposal({ ...proposal, fornecedor_contato: e.target.value })} placeholder="Telefone" /></Field><Field label="E-mail"><Input type="email" value={proposal.fornecedor_email} onChange={e => setProposal({ ...proposal, fornecedor_email: e.target.value })} /></Field><Field label="Data da proposta"><Input type="date" value={proposal.data_proposta} onChange={e => setProposal({ ...proposal, data_proposta: e.target.value })} /></Field><Field label="Unidade"><Input value={proposal.unidade} onChange={e => setProposal({ ...proposal, unidade: e.target.value })} /></Field><div className="flex items-end"><Button onClick={addProposal}><Plus className="mr-2 size-4" />Adicionar proposta</Button></div></div></div>
        <Table><TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>CNPJ</TableHead><TableHead>Contato</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow></TableHeader><TableBody>{proposals.map(p => <TableRow key={p.id}><TableCell className="font-medium">{p.fornecedor_nome}<div className="text-xs text-muted-foreground">{p.nome_contato || "—"}</div></TableCell><TableCell>{p.fornecedor_cnpj || "—"}</TableCell><TableCell>{p.fornecedor_contato || p.fornecedor_email || "—"}</TableCell><TableCell>{p.data_proposta}</TableCell><TableCell className="text-right font-medium">{fmtBRL(Number(p.valor))}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void removeProposal(p.id)}><Trash2 className="size-4" /></Button></TableCell></TableRow>)}</TableBody></Table>
      </CardContent></Card> : <Card className="flex items-center justify-center min-h-[360px]"><CardContent className="text-center text-muted-foreground"><Calculator className="size-10 mx-auto mb-3" /><p>Selecione uma cotação para cadastrar propostas e calcular o valor.</p></CardContent></Card>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Nova cotação corporativa</DialogTitle></DialogHeader><div className="grid gap-3 md:grid-cols-2"><Field label="Tipo"><Select value={form.tipo_item} onValueChange={v => setForm({ ...form, tipo_item: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="servico">Serviço</SelectItem><SelectItem value="material">Material</SelectItem><SelectItem value="insumo">Insumo</SelectItem><SelectItem value="composicao">Composição</SelectItem></SelectContent></Select></Field><Field label="Unidade"><Input value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} /></Field><Field label="Código"><Input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} /></Field><Field label="Fonte"><Input value={form.fonte} onChange={e => setForm({ ...form, fonte: e.target.value })} placeholder="SINAPI, ORSE, própria..." /></Field><Field label="Data da cotação"><Input type="date" value={form.data_cotacao} onChange={e => setForm({ ...form, data_cotacao: e.target.value })} /></Field><Field label="Quantidade de propostas desejadas"><Input type="number" min="1" value={form.quantidade_propostas_desejadas} onChange={e => setForm({ ...form, quantidade_propostas_desejadas: e.target.value })} /></Field><div className="md:col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva o serviço ou material a cotar" /></div><div className="md:col-span-2"><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={createQuote} disabled={loading}><Save className="mr-2 size-4" />{loading ? "Salvando…" : "Criar cotação"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }

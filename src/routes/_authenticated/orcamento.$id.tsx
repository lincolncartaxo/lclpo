import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtPct, fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/orcamento/$id")({
  head: () => ({ meta: [{ title: "Editor de Orçamento — Orça" }] }),
  component: Editor,
});

type Orc = any;
type Item = {
  id: string; orcamento_id: string; ordem: number;
  etapa: string | null; item: string | null; fonte: string | null;
  codigo: string | null; descricao: string; unidade: string | null;
  quantidade: number; preco_unitario: number;
};

function Editor() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [orc, setOrc] = useState<Orc | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: o } = await supabase.from("orcamentos").select("*").eq("id", id).single();
    const { data: it } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("ordem");
    setOrc(o); setItems((it ?? []) as Item[]); setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading || !orc) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const subtotal = items.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
  const totalEncargos = subtotal * Number(orc.encargos_pct);
  const totalComBdi = subtotal * (1 + Number(orc.bdi_pct));

  return (
    <div>
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Voltar</Button></Link>
          <div className="flex-1">
            <h1 className="font-semibold">{orc.nome}</h1>
            <p className="text-xs text-muted-foreground">{orc.municipio || "—"} · {orc.orgao || "—"}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total c/ BDI</div>
            <div className="text-lg font-semibold">{fmtBRL(totalComBdi)}</div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <Tabs defaultValue="capa">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="capa">Dados Gerais</TabsTrigger>
            <TabsTrigger value="encargos">Encargos</TabsTrigger>
            <TabsTrigger value="bdi">BDI</TabsTrigger>
            <TabsTrigger value="composicao">Composições</TabsTrigger>
            <TabsTrigger value="cotacao">Cotação</TabsTrigger>
            <TabsTrigger value="planilha">Planilha Orçamentária</TabsTrigger>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="cronograma">Cronograma F/F</TabsTrigger>
            <TabsTrigger value="qci">QCI</TabsTrigger>
          </TabsList>

          <TabsContent value="capa"><CapaTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="encargos"><EncargosTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="bdi"><BdiTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="composicao"><ComposicaoTab items={items} /></TabsContent>
          <TabsContent value="cotacao"><CotacaoTab /></TabsContent>
          <TabsContent value="planilha"><PlanilhaTab orcId={id} items={items} reload={load} bdiPct={Number(orc.bdi_pct)} /></TabsContent>
          <TabsContent value="resumo"><ResumoTab items={items} subtotal={subtotal} totalEncargos={totalEncargos} totalComBdi={totalComBdi} orc={orc} /></TabsContent>
          <TabsContent value="cronograma"><CronogramaTab orcId={id} items={items} totalComBdi={totalComBdi} /></TabsContent>
          <TabsContent value="qci"><QciTab subtotal={subtotal} totalComBdi={totalComBdi} orc={orc} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------- CAPA ---------- */
function CapaTab({ orc, onSaved }: { orc: Orc; onSaved: () => void }) {
  const [f, setF] = useState({ ...orc });
  const save = async () => {
    const { error } = await supabase.from("orcamentos").update({
      nome: f.nome, objeto: f.objeto, contrato: f.contrato, orgao: f.orgao,
      municipio: f.municipio, uf: f.uf, engenheiro: f.engenheiro, crea: f.crea, ref_precos: f.ref_precos,
    }).eq("id", orc.id);
    if (error) return toast.error(error.message);
    toast.success("Dados Gerais salvos"); onSaved();
  };
  return (
    <div className="mt-4 max-w-3xl space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome do Orçamento"><Input value={f.nome ?? ""} onChange={(e)=>setF({...f,nome:e.target.value})} /></Field>
        <Field label="Contrato"><Input value={f.contrato ?? ""} onChange={(e)=>setF({...f,contrato:e.target.value})} /></Field>
        <Field label="Município"><Input value={f.municipio ?? ""} onChange={(e)=>setF({...f,municipio:e.target.value})} /></Field>
        <Field label="UF"><Input maxLength={2} value={f.uf ?? ""} onChange={(e)=>setF({...f,uf:e.target.value.toUpperCase()})} /></Field>
        <Field label="Órgão / Concedente"><Input value={f.orgao ?? ""} onChange={(e)=>setF({...f,orgao:e.target.value})} /></Field>
        <Field label="Referência de Preços"><Input value={f.ref_precos ?? ""} placeholder="Ex.: SINAPI PB - Janeiro/2026" onChange={(e)=>setF({...f,ref_precos:e.target.value})} /></Field>
        <Field label="Engenheiro Responsável"><Input value={f.engenheiro ?? ""} onChange={(e)=>setF({...f,engenheiro:e.target.value})} /></Field>
        <Field label="CREA"><Input value={f.crea ?? ""} onChange={(e)=>setF({...f,crea:e.target.value})} /></Field>
      </div>
      <Field label="Objeto"><Textarea rows={4} value={f.objeto ?? ""} onChange={(e)=>setF({...f,objeto:e.target.value})} /></Field>
      <Button onClick={save}><Save className="mr-2 size-4" />Salvar Dados Gerais</Button>
    </div>
  );
}

/* ---------- ENCARGOS ---------- */
function EncargosTab({ orc, onSaved }: { orc: Orc; onSaved: () => void }) {
  const [pct, setPct] = useState((Number(orc.encargos_pct) * 100).toFixed(2));
  const save = async () => {
    const v = Number(pct.replace(",", ".")) / 100;
    if (isNaN(v)) return toast.error("Valor inválido");
    const { error } = await supabase.from("orcamentos").update({ encargos_pct: v }).eq("id", orc.id);
    if (error) return toast.error(error.message);
    toast.success("Encargos atualizados"); onSaved();
  };
  return (
    <div className="mt-4 max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">Percentual de encargos sociais aplicado sobre mão de obra (referencial SINAPI: horista 86,19% / mensalista 48,51%).</p>
      <Field label="Encargos Sociais (%)">
        <div className="flex gap-2"><Input value={pct} onChange={(e)=>setPct(e.target.value)} /><Button onClick={save}>Salvar</Button></div>
      </Field>
      <div className="rounded border bg-muted/30 p-4 text-sm">
        <h3 className="font-semibold mb-2">Tabela referencial</h3>
        <ul className="space-y-1 text-muted-foreground">
          <li>Horista: 86,19%</li>
          <li>Mensalista: 48,51%</li>
        </ul>
      </div>
    </div>
  );
}

/* ---------- BDI ---------- */
function BdiTab({ orc, onSaved }: { orc: Orc; onSaved: () => void }) {
  const [b, setB] = useState({ ac: 4.0, s: 0.8, r: 0.97, g: 8.04, l: 6.16, i: 5.0, tipo: "Edificações" });
  const calc = useMemo(() => {
    const ac = b.ac/100, s=b.s/100, r=b.r/100, g=b.g/100, l=b.l/100, i=b.i/100;
    const bdi = ((1+(ac+s+r+g))*(1+l)*(1+(0))/(1-i)) - 1; // simplificado
    return bdi;
  }, [b]);
  const save = async () => {
    const { error } = await supabase.from("orcamentos").update({ bdi_pct: calc }).eq("id", orc.id);
    if (error) return toast.error(error.message);
    toast.success("BDI atualizado"); onSaved();
  };
  return (
    <div className="mt-4 max-w-2xl">
      <p className="text-sm text-muted-foreground mb-3">Cálculo do BDI conforme Acórdão TCU 2.622/2013. Ajuste os percentuais.</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["ac", "AC - Adm. Central (%)"], ["s", "S - Seguros (%)"], ["r", "R - Riscos (%)"],
          ["g", "G - Garantias (%)"], ["l", "L - Lucro (%)"], ["i", "I - Tributos (%)"],
        ].map(([k,l]) => (
          <Field key={k} label={l}><Input type="number" step="0.01" value={(b as any)[k]} onChange={(e)=>setB({...b, [k]: Number(e.target.value)})} /></Field>
        ))}
      </div>
      <div className="mt-6 rounded-lg border p-5 bg-secondary/40">
        <div className="text-sm text-muted-foreground">BDI calculado</div>
        <div className="text-3xl font-bold">{fmtPct(calc)}</div>
        <div className="text-xs text-muted-foreground mt-1">Atual no orçamento: {fmtPct(orc.bdi_pct)}</div>
        <Button className="mt-3" onClick={save}><Save className="mr-2 size-4" />Aplicar BDI</Button>
      </div>
    </div>
  );
}

/* ---------- COMPOSIÇÃO ---------- */
function ComposicaoTab({ items }: { items: Item[] }) {
  const linked = items.filter(i => i.fonte && i.codigo);
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground mb-3">Itens vinculados a composições referenciais (SINAPI/DER).</p>
      <div className="overflow-x-auto rounded border">
        <table className="budget-table">
          <thead><tr><th>Item</th><th>Fonte</th><th>Código</th><th>Descrição</th><th>Unid.</th><th className="num">Quant.</th><th className="num">Custo Unit.</th></tr></thead>
          <tbody>
            {linked.map(i=>(<tr key={i.id}><td>{i.item}</td><td>{i.fonte}</td><td>{i.codigo}</td><td>{i.descricao}</td><td>{i.unidade}</td><td className="num">{fmtNum(Number(i.quantidade),3)}</td><td className="num">{fmtBRL(Number(i.preco_unitario))}</td></tr>))}
            {linked.length===0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Nenhum item vinculado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- COTAÇÃO ---------- */
function CotacaoTab() {
  return <div className="mt-4 text-sm text-muted-foreground rounded border p-6 bg-muted/20">Módulo de cotação de fornecedores — cadastre cotações livres de insumos não cobertos pelas bases. <span className="italic">(Em breve)</span></div>;
}

/* ---------- PLANILHA ORÇAMENTÁRIA ---------- */
function PlanilhaTab({ orcId, items, reload, bdiPct }: { orcId: string; items: Item[]; reload: () => void; bdiPct: number }) {
  const [open, setOpen] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState("");
  const [etapasExtra, setEtapasExtra] = useState<string[]>([]);

  const etapasExistentes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.etapa) set.add(i.etapa); });
    etapasExtra.forEach(e => set.add(e));
    return Array.from(set);
  }, [items, etapasExtra]);

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    etapasExistentes.forEach(e => { map[e] = []; });
    items.forEach(i => { const k = i.etapa || "Sem etapa"; (map[k] ??= []).push(i); });
    return map;
  }, [items, etapasExistentes]);

  const total = items.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario) * (1 + bdiPct), 0);

  const updateField = async (id: string, field: string, value: any) => {
    await (supabase.from("orcamento_itens") as any).update({ [field]: value }).eq("id", id);
    reload();
  };
  const remove = async (id: string) => {
    await supabase.from("orcamento_itens").delete().eq("id", id);
    reload();
  };

  const addEtapa = () => {
    const e = novaEtapa.trim();
    if (!e) return toast.error("Informe o nome da etapa");
    if (etapasExistentes.includes(e)) return toast.error("Etapa já existe");
    setEtapasExtra(prev => [...prev, e]);
    setNovaEtapa("");
    toast.success("Etapa criada. Adicione itens a ela.");
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <p className="text-sm text-muted-foreground">{items.length} itens · Total c/ BDI {fmtBRL(total)}</p>
        <div className="flex gap-2 items-center">
          <Input className="w-64" placeholder="Nova etapa (ex.: 1 - Serviços Preliminares)" value={novaEtapa} onChange={(e)=>setNovaEtapa(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') addEtapa(); }} />
          <Button variant="secondary" onClick={addEtapa}><Plus className="mr-1 size-4"/>Etapa</Button>
          <AddItemDialog orcId={orcId} open={open} setOpen={setOpen} onAdded={reload} nextOrdem={items.length+1} etapas={etapasExistentes} items={items} />
        </div>
      </div>
      <div className="overflow-x-auto rounded border bg-card">
        <table className="budget-table">
          <thead><tr>
            <th style={{width:80}}>Item</th><th style={{width:80}}>Fonte</th><th style={{width:90}}>Código</th>
            <th>Descrição</th><th style={{width:60}}>Un.</th>
            <th className="num" style={{width:90}}>Quant.</th><th className="num" style={{width:110}}>Preço Unit.</th>
            <th className="num" style={{width:80}}>BDI</th><th className="num" style={{width:130}}>Preço Unit. c/ BDI</th>
            <th className="num" style={{width:130}}>Total</th><th style={{width:40}}></th>
          </tr></thead>
          <tbody>
            {Object.entries(grouped).map(([etapa, list]) => (
              <React.Fragment key={"g-"+etapa}>
                <tr><td colSpan={11} className="bg-secondary/60 font-semibold">{etapa}</td></tr>
                {list.map((i) => {
                  const pu = Number(i.preco_unitario);
                  const puBdi = pu * (1 + bdiPct);
                  const tot = Number(i.quantidade) * puBdi;
                  return (
                    <tr key={i.id}>
                      <td><input className="w-full bg-transparent outline-none" defaultValue={i.item ?? ""} onBlur={(e)=>updateField(i.id,"item",e.target.value)} /></td>
                      <td>{i.fonte || "—"}</td>
                      <td>{i.codigo || "—"}</td>
                      <td><input className="w-full bg-transparent outline-none" defaultValue={i.descricao} onBlur={(e)=>updateField(i.id,"descricao",e.target.value)} /></td>
                      <td><input className="w-full bg-transparent outline-none" defaultValue={i.unidade ?? ""} onBlur={(e)=>updateField(i.id,"unidade",e.target.value)} /></td>
                      <td className="num"><input className="w-full text-right bg-transparent outline-none" type="number" step="0.01" defaultValue={i.quantidade} onBlur={(e)=>updateField(i.id,"quantidade",Number(e.target.value))} /></td>
                      <td className="num"><input className="w-full text-right bg-transparent outline-none" type="number" step="0.01" defaultValue={i.preco_unitario} onBlur={(e)=>updateField(i.id,"preco_unitario",Number(e.target.value))} /></td>
                      <td className="num text-muted-foreground">{fmtPct(bdiPct)}</td>
                      <td className="num">{fmtBRL(puBdi)}</td>
                      <td className="num font-medium">{fmtBRL(tot)}</td>
                      <td><button onClick={()=>remove(i.id)} className="text-destructive hover:opacity-70"><Trash2 className="size-4"/></button></td>
                    </tr>
                  );
                })}
                {list.length===0 && <tr><td colSpan={11} className="text-center text-muted-foreground py-3 text-xs italic">Etapa vazia — adicione itens a ela.</td></tr>}
              </React.Fragment>
            ))}
            {items.length===0 && etapasExistentes.length===0 && <tr><td colSpan={11} className="text-center text-muted-foreground py-8">Crie uma etapa e adicione o primeiro item.</td></tr>}
            <tr><td colSpan={9} className="text-right font-semibold">TOTAL c/ BDI</td><td className="num font-bold">{fmtBRL(total)}</td><td></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddItemDialog({ orcId, open, setOpen, onAdded, nextOrdem }: any) {
  const [tab, setTab] = useState("base");
  const [fonte, setFonte] = useState<"SINAPI"|"DER">("SINAPI");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [etapa, setEtapa] = useState("");
  const [item, setItem] = useState("");
  const [quant, setQuant] = useState("1");

  // manual fields
  const [m, setM] = useState({ descricao: "", unidade: "un", preco_unitario: "0" });

  useEffect(() => {
    const t = setTimeout(async () => {
      let qb = supabase.from("base_composicoes").select("codigo,descricao,unidade,custo_unitario").eq("fonte", fonte).limit(30);
      if (q.trim()) qb = qb.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
      const { data } = await qb;
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, fonte]);

  const addFromBase = async (r: any) => {
    await supabase.from("orcamento_itens").insert({
      orcamento_id: orcId, ordem: nextOrdem, etapa: etapa || null, item: item || null,
      fonte, codigo: String(r.codigo), descricao: r.descricao, unidade: r.unidade,
      quantidade: Number(quant.replace(",",".") || 1), preco_unitario: Number(r.custo_unitario || 0),
    });
    toast.success("Item adicionado"); setOpen(false); onAdded();
  };
  const addManual = async () => {
    if (!m.descricao) return toast.error("Descrição obrigatória");
    await supabase.from("orcamento_itens").insert({
      orcamento_id: orcId, ordem: nextOrdem, etapa: etapa || null, item: item || null,
      fonte: "COMP", descricao: m.descricao, unidade: m.unidade,
      quantidade: Number(quant.replace(",",".") || 1), preco_unitario: Number(m.preco_unitario.replace(",",".") || 0),
    });
    toast.success("Item adicionado"); setOpen(false); onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 size-4"/>Adicionar item</Button></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Adicionar item</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Etapa"><Input value={etapa} onChange={(e)=>setEtapa(e.target.value)} placeholder="Ex.: 1 - Serviços Preliminares" /></Field>
          <Field label="Item nº"><Input value={item} onChange={(e)=>setItem(e.target.value)} placeholder="1.1.1" /></Field>
          <Field label="Quantidade"><Input value={quant} onChange={(e)=>setQuant(e.target.value)} /></Field>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="base">Da base SINAPI/DER</TabsTrigger><TabsTrigger value="manual">Item manual</TabsTrigger></TabsList>
          <TabsContent value="base">
            <div className="flex gap-2 mt-2">
              <Select value={fonte} onValueChange={(v)=>setFonte(v as any)}>
                <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="SINAPI">SINAPI</SelectItem><SelectItem value="DER">DER</SelectItem></SelectContent>
              </Select>
              <div className="relative flex-1"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground"/><Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} /></div>
            </div>
            <div className="mt-3 max-h-80 overflow-auto rounded border">
              <table className="budget-table">
                <thead><tr><th>Cód.</th><th>Descrição</th><th>Un.</th><th className="num">Custo</th><th></th></tr></thead>
                <tbody>{results.map((r,i)=>(<tr key={i}><td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td><td className="num">{fmtBRL(r.custo_unitario)}</td><td><Button size="sm" variant="secondary" onClick={()=>addFromBase(r)}>Adicionar</Button></td></tr>))}</tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="manual">
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={m.descricao} onChange={(e)=>setM({...m,descricao:e.target.value})}/></div>
              <div><Label>Unidade</Label><Input value={m.unidade} onChange={(e)=>setM({...m,unidade:e.target.value})}/></div>
              <div><Label>Preço Unitário (R$)</Label><Input value={m.preco_unitario} onChange={(e)=>setM({...m,preco_unitario:e.target.value})}/></div>
            </div>
            <DialogFooter className="mt-4"><Button onClick={addManual}>Adicionar item manual</Button></DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- RESUMO ---------- */
function ResumoTab({ items, subtotal, totalEncargos, totalComBdi, orc }: any) {
  const grouped: Record<string, number> = {};
  items.forEach((i: Item) => {
    const k = i.etapa || "Sem etapa";
    grouped[k] = (grouped[k] ?? 0) + Number(i.quantidade) * Number(i.preco_unitario);
  });
  const totGrupos = Object.values(grouped).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="mt-4 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
        <table className="budget-table">
          <thead><tr><th>Etapa</th><th className="num">Total</th><th className="num">% Obra</th></tr></thead>
          <tbody>
            {Object.entries(grouped).map(([k,v])=>(<tr key={k}><td>{k}</td><td className="num">{fmtBRL(v)}</td><td className="num">{fmtPct(v/totGrupos)}</td></tr>))}
            <tr className="font-semibold"><td>SUBTOTAL</td><td className="num">{fmtBRL(subtotal)}</td><td className="num">100,00%</td></tr>
            <tr><td>BDI ({fmtPct(orc.bdi_pct)})</td><td className="num">{fmtBRL(totalComBdi - subtotal)}</td><td></td></tr>
            <tr className="bg-primary/10 font-bold"><td>TOTAL GERAL</td><td className="num">{fmtBRL(totalComBdi)}</td><td></td></tr>
          </tbody>
        </table>
      </div>
      <div className="space-y-3">
        <Card label="Subtotal de itens" value={fmtBRL(subtotal)} />
        <Card label="Encargos referenciais" value={fmtBRL(totalEncargos)} hint={fmtPct(orc.encargos_pct) + " sobre subtotal"} />
        <Card label="BDI aplicado" value={fmtPct(orc.bdi_pct)} />
        <Card label="TOTAL c/ BDI" value={fmtBRL(totalComBdi)} highlight />
      </div>
    </div>
  );
}

/* ---------- CRONOGRAMA F/F ---------- */
function CronogramaTab({ orcId, items, totalComBdi }: { orcId: string; items: Item[]; totalComBdi: number }) {
  const etapas = useMemo(() => Array.from(new Set(items.map(i => i.etapa || "Sem etapa"))), [items]);
  const [meses, setMeses] = useState(6);
  const [grid, setGrid] = useState<Record<string, Record<number, number>>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orcamento_cronograma").select("*").eq("orcamento_id", orcId);
      const g: Record<string, Record<number, number>> = {};
      (data ?? []).forEach((r: any) => { (g[r.etapa] ??= {})[r.mes] = Number(r.percentual); });
      setGrid(g);
    })();
  }, [orcId]);

  const setCell = async (etapa: string, mes: number, val: number) => {
    setGrid(prev => ({ ...prev, [etapa]: { ...(prev[etapa]||{}), [mes]: val } }));
    await supabase.from("orcamento_cronograma").upsert({ orcamento_id: orcId, etapa, mes, percentual: val }, { onConflict: "orcamento_id,etapa,mes" });
  };

  const totalEtapa = (e: string) => items.filter(i => (i.etapa||"Sem etapa")===e).reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario),0) * (totalComBdi / Math.max(items.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario),0),1));
  const valorMes = (mes: number) => etapas.reduce((s,e)=>s + (grid[e]?.[mes]||0) * totalEtapa(e), 0);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3">
        <Label>Meses:</Label>
        <Input className="w-24" type="number" min={1} max={36} value={meses} onChange={(e)=>setMeses(Math.max(1, Math.min(36, Number(e.target.value))))} />
        <p className="text-xs text-muted-foreground">Informe o percentual de execução de cada etapa por mês (0 a 1, ex.: 0,5 = 50%).</p>
      </div>
      <div className="overflow-x-auto rounded border bg-card">
        <table className="budget-table">
          <thead><tr><th>Etapa</th>{Array.from({length:meses},(_,i)=>i+1).map(m=>(<th key={m} className="num">M{m}</th>))}<th className="num">Σ</th></tr></thead>
          <tbody>
            {etapas.map(e=>{
              const sum = Array.from({length:meses},(_,i)=>i+1).reduce((s,m)=>s+(grid[e]?.[m]||0),0);
              return (
                <tr key={e}>
                  <td className="font-medium">{e}</td>
                  {Array.from({length:meses},(_,i)=>i+1).map(m=>(
                    <td key={m} className="num">
                      <input className="w-16 text-right bg-transparent outline-none" type="number" step="0.05" defaultValue={grid[e]?.[m] ?? ""} onBlur={(e2)=>setCell(e, m, Number(e2.target.value)||0)} />
                    </td>
                  ))}
                  <td className={"num font-medium " + (Math.abs(sum-1)<0.001?"text-success":"text-warning")}>{fmtPct(sum)}</td>
                </tr>
              );
            })}
            <tr className="bg-secondary/50 font-semibold">
              <td>Valor / mês</td>
              {Array.from({length:meses},(_,i)=>i+1).map(m=>(<td key={m} className="num">{fmtBRL(valorMes(m))}</td>))}
              <td className="num">{fmtBRL(Array.from({length:meses},(_,i)=>i+1).reduce((s,m)=>s+valorMes(m),0))}</td>
            </tr>
            {etapas.length===0 && <tr><td colSpan={meses+2} className="text-center text-muted-foreground py-6">Adicione itens com etapa na Planilha Orçamentária.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- QCI ---------- */
function QciTab({ subtotal, totalComBdi, orc }: any) {
  const repasse = totalComBdi * 0.95;
  const contrapartida = totalComBdi - repasse;
  return (
    <div className="mt-4 max-w-2xl">
      <h3 className="font-semibold mb-3">Quadro de Composição do Investimento</h3>
      <table className="budget-table">
        <tbody>
          <tr><td>Investimento total da obra</td><td className="num">{fmtBRL(totalComBdi)}</td></tr>
          <tr><td>Custo direto (sem BDI)</td><td className="num">{fmtBRL(subtotal)}</td></tr>
          <tr><td>BDI ({fmtPct(orc.bdi_pct)})</td><td className="num">{fmtBRL(totalComBdi - subtotal)}</td></tr>
          <tr><td>Repasse (95%)</td><td className="num">{fmtBRL(repasse)}</td></tr>
          <tr><td>Contrapartida (5%)</td><td className="num">{fmtBRL(contrapartida)}</td></tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-2">Valores percentuais indicativos — ajuste conforme convênio.</p>
    </div>
  );
}

/* ---------- ART ---------- */
function ArtTab({ orc, totalComBdi }: any) {
  return (
    <div className="mt-4 max-w-xl rounded border p-6 bg-card">
      <h3 className="font-semibold mb-3">Dados para emissão de ART</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-muted-foreground">Engenheiro</dt><dd>{orc.engenheiro || "—"}</dd>
        <dt className="text-muted-foreground">CREA</dt><dd>{orc.crea || "—"}</dd>
        <dt className="text-muted-foreground">Objeto</dt><dd>{orc.objeto || "—"}</dd>
        <dt className="text-muted-foreground">Município/UF</dt><dd>{orc.municipio || "—"}/{orc.uf || "—"}</dd>
        <dt className="text-muted-foreground">Valor da obra</dt><dd className="font-semibold">{fmtBRL(totalComBdi)}</dd>
      </dl>
    </div>
  );
}

/* ---------- helpers ---------- */
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div><Label className="mb-1 block">{label}</Label>{children}</div>;
}
function Card({ label, value, hint, highlight }: any) {
  return (
    <div className={"rounded-lg border p-4 " + (highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card")}>
      <div className={"text-xs " + (highlight ? "opacity-80" : "text-muted-foreground")}>{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {hint && <div className={"text-xs mt-1 " + (highlight ? "opacity-80" : "text-muted-foreground")}>{hint}</div>}
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Search, Trash2, FileDown, Layers } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtPct, fmtNum } from "@/lib/format";

/* ---------- HELPERS COMPARTILHADOS ---------- */
const prefixOf = (s: string) => {
  const m = (s || "").trim().match(/^([0-9]+(?:\.[0-9]+)*)/);
  return m ? m[1] : "";
};

/** Compara códigos hierárquicos numericamente: "1" < "1.2" < "1.10" < "2". */
export const cmpCode = (a: string, b: string) => {
  const pa = (a || "").split(".").map(n => parseInt(n, 10));
  const pb = (b || "").split(".").map(n => parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i]; const y = pb[i];
    if (isNaN(x) && isNaN(y)) continue;
    if (isNaN(x)) return -1;
    if (isNaN(y)) return 1;
    if (x !== y) return x - y;
  }
  return 0;
};

function useEtapasExtra(orcId: string) {
  const key = `orc_etapas_${orcId}`;
  const [etapasExtra, setEtapasExtra] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(etapasExtra));
  }, [etapasExtra, key]);
  return [etapasExtra, setEtapasExtra] as const;
}

/** Agrupa itens nas etapas casando o prefixo do código do item com o prefixo da etapa.
 *  Ordena etapas e itens hierarquicamente (1 → 1.2 → 1.10 → 2). */
function groupItemsByEtapa(items: Item[], etapas: string[], drafts: Record<string,string> = {}) {
  const etapasInfo = etapas.map(e => ({ etapa: e, label: drafts[e] ?? e, pfx: prefixOf(drafts[e] ?? e) }));
  const etapasPfx = etapasInfo
    .filter(x => x.pfx)
    .sort((a, b) => b.pfx.length - a.pfx.length);
  // ordena etapas por prefixo numérico para inserção
  const etapasOrdenadas = [...etapasInfo].sort((a, b) => {
    if (a.pfx && b.pfx) return cmpCode(a.pfx, b.pfx);
    if (a.pfx) return -1;
    if (b.pfx) return 1;
    return a.label.localeCompare(b.label);
  });
  const map: Record<string, { label: string; list: Item[] }> = {};
  etapasOrdenadas.forEach(e => { map[e.etapa] = { label: e.label, list: [] }; });
  items.forEach(i => {
    const code = (i.item || "").trim();
    const match = etapasPfx.find(({ pfx }) => code === pfx || code.startsWith(pfx + "."));
    const k = match ? match.etapa : "Sem etapa";
    (map[k] ??= { label: "Sem etapa", list: [] }).list.push(i);
  });
  // ordena itens dentro de cada etapa
  Object.values(map).forEach(g => {
    g.list.sort((a, b) => cmpCode((a.item || "").trim(), (b.item || "").trim()));
  });
  return map;
}

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
  const tabKey = `orc_tab_${id}`;
  const [tab, setTabState] = useState<string>(() => {
    if (typeof window === "undefined") return "capa";
    return window.localStorage.getItem(tabKey) || "capa";
  });
  const setTab = (v: string) => {
    setTabState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(tabKey, v);
  };

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
        <Tabs value={tab} onValueChange={setTab}>
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
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          </TabsList>

          <TabsContent value="capa"><CapaTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="encargos"><EncargosTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="bdi"><BdiTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="composicao"><ComposicaoTab items={items} /></TabsContent>
          <TabsContent value="cotacao"><CotacaoTab /></TabsContent>
          <TabsContent value="planilha"><PlanilhaTab orcId={id} items={items} reload={load} bdiPct={Number(orc.bdi_pct)} regime={orc.regime ?? "nao_desonerado"} uf={orc.uf ?? null} /></TabsContent>
          <TabsContent value="resumo"><ResumoTab orcId={id} items={items} subtotal={subtotal} totalEncargos={totalEncargos} totalComBdi={totalComBdi} orc={orc} /></TabsContent>
          <TabsContent value="cronograma"><CronogramaTab orcId={id} items={items} totalComBdi={totalComBdi} /></TabsContent>
          <TabsContent value="qci"><QciTab subtotal={subtotal} totalComBdi={totalComBdi} orc={orc} /></TabsContent>
          <TabsContent value="relatorio"><RelatorioTab orc={orc} orcId={id} items={items} subtotal={subtotal} totalEncargos={totalEncargos} totalComBdi={totalComBdi} /></TabsContent>
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
      regime: f.regime ?? "nao_desonerado",
    } as any).eq("id", orc.id);
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
        <Field label="Regime Tributário">
          <Select value={f.regime ?? "nao_desonerado"} onValueChange={(v)=>setF({...f, regime: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao_desonerado">Não Desonerado</SelectItem>
              <SelectItem value="desonerado">Desonerado</SelectItem>
            </SelectContent>
          </Select>
        </Field>
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
function PlanilhaTab({ orcId, items, reload, bdiPct, regime }: { orcId: string; items: Item[]; reload: () => void; bdiPct: number; regime: string }) {
  const [open, setOpen] = useState(false);
  const [openEtapa, setOpenEtapa] = useState(false);
  const [explodeRow, setExplodeRow] = useState<Item | null>(null);
  const [etapasExtra, setEtapasExtra] = useEtapasExtra(orcId);
  const [etapaDrafts, setEtapaDrafts] = useState<Record<string, string>>({});

  const etapasExistentes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.etapa) set.add(i.etapa); });
    etapasExtra.forEach(e => set.add(e));
    return Array.from(set);
  }, [items, etapasExtra]);

  const grouped = useMemo(
    () => groupItemsByEtapa(items, etapasExistentes, etapaDrafts),
    [items, etapasExistentes, etapaDrafts]
  );

  const total = items.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario) * (1 + bdiPct), 0);

  const updateField = async (id: string, field: string, value: any) => {
    await (supabase.from("orcamento_itens") as any).update({ [field]: value }).eq("id", id);
    reload();
  };
  const remove = async (id: string) => {
    await supabase.from("orcamento_itens").delete().eq("id", id);
    reload();
  };

  const addEtapa = (nome: string) => {
    const e = nome.trim();
    if (!e) return toast.error("Informe o nome da etapa");
    if (etapasExistentes.includes(e)) return toast.error("Etapa já existe");
    setEtapasExtra(prev => [...prev, e]);
    toast.success("Etapa criada");
  };

  const totalEtapa = (list: Item[]) =>
    list.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario) * (1 + bdiPct), 0);


  const renameEtapa = async (oldName: string, newName: string) => {
    const nn = newName.trim();
    if (!nn || nn === oldName) return;
    if (etapasExistentes.includes(nn)) return toast.error("Já existe uma etapa com esse nome");
    setEtapasExtra(prev => {
      const exists = prev.includes(oldName);
      const next = exists ? prev.map(e => e === oldName ? nn : e) : [...prev, nn];
      return Array.from(new Set(next));
    });
    toast.success("Etapa renomeada");
  };

  const deleteEtapa = async (etapa: string) => {
    const pfx = prefixOf(etapa);
    const affected = pfx
      ? items.filter(i => { const c = (i.item||"").trim(); return c === pfx || c.startsWith(pfx + "."); })
      : [];
    if (affected.length > 0) {
      if (!confirm(`Excluir a etapa "${etapa}" e seus ${affected.length} item(ns)?`)) return;
      const ids = affected.map(i => i.id);
      const { error } = await supabase.from("orcamento_itens").delete().in("id", ids);
      if (error) return toast.error(error.message);
    }
    setEtapasExtra(prev => prev.filter(e => e !== etapa));
    toast.success("Etapa excluída");
    reload();
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <p className="text-sm text-muted-foreground">{items.length} itens · Total c/ BDI {fmtBRL(total)}</p>
        <div className="flex gap-2 items-center">
          <AddEtapaDialog open={openEtapa} setOpen={setOpenEtapa} onAdd={addEtapa} />
          <AddItemDialog orcId={orcId} open={open} setOpen={setOpen} onAdded={reload} nextOrdem={items.length+1} regime={regime} />


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
            {Object.entries(grouped).map(([etapa, group]) => (
              <React.Fragment key={"g-"+etapa}>
                <tr className="bg-secondary/60">
                  {etapa === "Sem etapa" ? (
                    <td colSpan={9} className="font-semibold">
                      <span className="text-muted-foreground italic">{group.label}</span>
                    </td>
                  ) : (
                    <EtapaEditor
                      key={etapa}
                      etapa={etapa}
                      draftEtapa={group.label}
                      onDraftChange={(draft: string)=>setEtapaDrafts(prev => ({ ...prev, [etapa]: draft }))}
                      onRename={(nn)=>{
                        setEtapaDrafts(prev => { const next = { ...prev }; delete next[etapa]; return next; });
                        renameEtapa(etapa, nn);
                      }}
                      onDelete={()=>deleteEtapa(etapa)}
                    />
                  )}
                  <td className="num font-semibold">{fmtBRL(totalEtapa(group.list))}</td>
                  <td></td>
                </tr>
                {group.list.map((i) => {
                  const pu = Number(i.preco_unitario);
                  const puBdi = pu * (1 + bdiPct);
                  const tot = Number(i.quantidade) * puBdi;
                  return (
                    <tr key={i.id} className={i.fonte && i.codigo ? "cursor-pointer hover:bg-muted/40" : ""}>
                      <td onClick={(e)=>e.stopPropagation()}><input className="w-full bg-transparent outline-none" defaultValue={i.item ?? ""} onBlur={(e)=>updateField(i.id,"item",e.target.value)} /></td>
                      <td>
                        {i.fonte && i.codigo ? (
                          <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={()=>setExplodeRow(i)} title="Explosão de insumos">
                            <Layers className="size-3" />{i.fonte}
                          </button>
                        ) : (i.fonte || "—")}
                      </td>
                      <td className="text-muted-foreground">{i.codigo || "—"}</td>
                      <td className="text-muted-foreground">{i.descricao}</td>
                      <td className="text-muted-foreground">{i.unidade ?? "—"}</td>
                      <td className="num" onClick={(e)=>e.stopPropagation()}><input className="w-full text-right bg-transparent outline-none" type="number" step="0.01" defaultValue={i.quantidade} onBlur={(e)=>updateField(i.id,"quantidade",Number(e.target.value))} /></td>
                      <td className="num text-muted-foreground">{fmtBRL(pu)}</td>
                      <td className="num text-muted-foreground">{fmtPct(bdiPct)}</td>
                      <td className="num">{fmtBRL(puBdi)}</td>
                      <td className="num font-medium">{fmtBRL(tot)}</td>
                      <td><button onClick={()=>remove(i.id)} className="text-destructive hover:opacity-70"><Trash2 className="size-4"/></button></td>
                    </tr>
                  );
                })}
                {group.list.length===0 && <tr><td colSpan={11} className="text-center text-muted-foreground py-3 text-xs italic">Etapa vazia — adicione itens a ela.</td></tr>}
              </React.Fragment>
            ))}
            {items.length===0 && etapasExistentes.length===0 && <tr><td colSpan={11} className="text-center text-muted-foreground py-8">Crie uma etapa e adicione o primeiro item.</td></tr>}
            <tr><td colSpan={9} className="text-right font-semibold">TOTAL c/ BDI</td><td className="num font-bold">{fmtBRL(total)}</td><td></td></tr>
          </tbody>
        </table>
      </div>
      <ExplosaoSheet row={explodeRow} onClose={()=>setExplodeRow(null)} regime={regime} />
    </div>
  );
}

function ExplosaoSheet({ row, onClose, regime }: { row: Item | null; onClose: () => void; regime: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!row) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("base_composicao_itens")
        .select("*")
        .eq("fonte", row.fonte!)
        .eq("composicao_codigo", row.codigo!);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [row]);
  const priceOf = (r: any) => Number((regime === "desonerado" ? r.preco_desonerado : r.preco_nao_desonerado) ?? 0);
  const total = rows.reduce((s, r) => s + Number(r.coeficiente) * priceOf(r), 0);
  return (
    <Sheet open={!!row} onOpenChange={(o)=>{ if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Explosão de insumos</SheetTitle>
          <SheetDescription>
            {row ? <>{row.fonte} · {row.codigo} — {row.descricao}</> : null}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 overflow-x-auto rounded border">
          <table className="budget-table">
            <thead><tr>
              <th>Tipo</th><th>Código</th><th>Descrição</th><th>Un.</th>
              <th className="num">Coef.</th><th className="num">Preço Unit.</th><th className="num">Subtotal</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.tipo ?? "—"}</td>
                  <td>{r.insumo_codigo ?? "—"}</td>
                  <td>{r.descricao}</td>
                  <td>{r.unidade ?? "—"}</td>
                  <td className="num">{Number(r.coeficiente).toLocaleString("pt-BR",{minimumFractionDigits:4,maximumFractionDigits:6})}</td>
                  <td className="num">{fmtBRL(priceOf(r))}</td>
                  <td className="num">{fmtBRL(Number(r.coeficiente) * priceOf(r))}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-6 text-xs italic">
                  Nenhuma composição cadastrada para este código.
                </td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-secondary/40">
                  <td colSpan={6} className="text-right">Custo total da composição</td>
                  <td className="num">{fmtBRL(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddItemDialog({ orcId, open, setOpen, onAdded, nextOrdem, regime }: any) {
  const FONTES_ALL = ["SINAPI","DER","SICRO3","SBC","ORSE","Outras"];
  const [tab, setTab] = useState("base");
  const [fonte, setFonte] = useState<string>("__all");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [item, setItem] = useState("");
  const [quant, setQuant] = useState("1");

  // manual fields
  const [m, setM] = useState({ descricao: "", unidade: "un", preco_unitario: "0" });

  const priceField = regime === "desonerado" ? "custo_desonerado" : "custo_nao_desonerado";

  useEffect(() => {
    const t = setTimeout(async () => {
      let qb: any = supabase
        .from("base_composicoes")
        .select("codigo,descricao,unidade,custo_desonerado,custo_nao_desonerado,fonte")
        .limit(30);
      if (fonte !== "__all") qb = qb.eq("fonte", fonte);
      if (q.trim()) qb = qb.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
      const { data } = await qb;
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, fonte]);

  const addFromBase = async (r: any) => {
    await supabase.from("orcamento_itens").insert({
      orcamento_id: orcId, ordem: nextOrdem, etapa: null, item: item || null,
      fonte: r.fonte, codigo: String(r.codigo), descricao: r.descricao, unidade: r.unidade,
      quantidade: Number(quant.replace(",",".") || 1),
      preco_unitario: Number(r[priceField] ?? 0),
    });
    toast.success("Item adicionado"); setOpen(false); onAdded();
  };
  const addManual = async () => {
    if (!m.descricao) return toast.error("Descrição obrigatória");
    await supabase.from("orcamento_itens").insert({
      orcamento_id: orcId, ordem: nextOrdem, etapa: null, item: item || null,
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
        <p className="text-xs text-muted-foreground -mt-2">O item é agrupado automaticamente na etapa cujo prefixo corresponde (ex.: item “1.1” entra na etapa “1 - …”). Preço aplicado conforme regime: <strong>{regime === "desonerado" ? "Desonerado" : "Não Desonerado"}</strong>.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Item nº (prefixo hierárquico)"><Input value={item} onChange={(e)=>setItem(e.target.value)} placeholder="Ex.: 1.1" /></Field>
          <Field label="Quantidade"><Input value={quant} onChange={(e)=>setQuant(e.target.value)} /></Field>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="base">Das bases de preços</TabsTrigger><TabsTrigger value="manual">Item manual</TabsTrigger></TabsList>
          <TabsContent value="base">
            <div className="flex gap-2 mt-2">
              <Select value={fonte} onValueChange={(v)=>setFonte(v)}>
                <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as fontes</SelectItem>
                  {FONTES_ALL.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative flex-1"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground"/><Input className="pl-8" placeholder="Buscar código ou descrição…" value={q} onChange={(e)=>setQ(e.target.value)} /></div>
            </div>
            <div className="mt-3 max-h-80 overflow-auto rounded border">
              <table className="budget-table">
                <thead><tr><th>Fonte</th><th>Cód.</th><th>Descrição</th><th>Un.</th><th className="num">Preço</th><th></th></tr></thead>
                <tbody>{results.map((r,i)=>(<tr key={i}><td>{r.fonte}</td><td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td><td className="num">{fmtBRL(Number(r[priceField] ?? 0))}</td><td><Button size="sm" variant="secondary" onClick={()=>addFromBase(r)}>Adicionar</Button></td></tr>))}</tbody>
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
function ResumoTab({ orcId, items, subtotal, totalEncargos, totalComBdi, orc }: any) {
  const [etapasExtra] = useEtapasExtra(orcId);
  const etapasExistentes = useMemo(() => {
    const set = new Set<string>();
    (items as Item[]).forEach(i => { if (i.etapa) set.add(i.etapa); });
    etapasExtra.forEach(e => set.add(e));
    return Array.from(set);
  }, [items, etapasExtra]);
  const groups = useMemo(() => groupItemsByEtapa(items, etapasExistentes), [items, etapasExistentes]);
  const grouped: Record<string, number> = {};
  Object.values(groups).forEach((g) => {
    grouped[g.label] = (grouped[g.label] ?? 0) + g.list.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
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
  const [etapasExtra] = useEtapasExtra(orcId);
  const etapasExistentes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.etapa) set.add(i.etapa); });
    etapasExtra.forEach(e => set.add(e));
    return Array.from(set);
  }, [items, etapasExtra]);
  const groups = useMemo(() => groupItemsByEtapa(items, etapasExistentes), [items, etapasExistentes]);
  const etapas = useMemo(
    () => Object.values(groups).map(g => g.label).filter(l => l !== "Sem etapa" || (groups["Sem etapa"]?.list.length ?? 0) > 0),
    [groups]
  );
  const totaisPorEtapa = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(groups).forEach(g => {
      m[g.label] = g.list.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
    });
    return m;
  }, [groups]);
  const subtotalAll = Object.values(totaisPorEtapa).reduce((a, b) => a + b, 0);
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

  const totalEtapa = (e: string) => (totaisPorEtapa[e] || 0) * (totalComBdi / Math.max(subtotalAll, 1));
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

function EtapaEditor({ etapa, draftEtapa = etapa, onDraftChange, onRename, onDelete }: { etapa: string; draftEtapa?: string; onDraftChange?: (n: string) => void; onRename: (n: string) => void; onDelete: () => void }) {
  // Divide "1 - Serviços Preliminares" em prefixo "1" + nome "Serviços Preliminares"
  const split = (s: string) => {
    const m = s.trim().match(/^([0-9]+(?:\.[0-9]+)*)\s*[-–:.]?\s*(.*)$/);
    return m ? { code: m[1], name: m[2] } : { code: "", name: s };
  };
  const compose = (nextCode: string, nextName: string) => nextCode.trim() ? `${nextCode.trim()} - ${nextName.trim()}` : nextName.trim();
  const initial = split(draftEtapa);
  const [code, setCode] = useState(initial.code);
  const [name, setName] = useState(initial.name);
  useEffect(() => {
    const next = split(draftEtapa);
    setCode(next.code);
    setName(next.name);
  }, [draftEtapa]);
  const composed = compose(code, name);
  const dirty = composed !== etapa;
  const save = () => { if (dirty) onRename(composed); };
  return (
    <>
      <td className="font-semibold">
        <Input
          value={code}
          onChange={(e) => { setCode(e.target.value); onDraftChange?.(compose(e.target.value, name)); }}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="1"
          className="h-8 font-semibold bg-background"
        />
      </td>
      <td colSpan={8} className="font-semibold">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); onDraftChange?.(compose(code, e.target.value)); }}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Nome da etapa"
            className="h-8 font-semibold bg-background"
          />
          {dirty && <Button size="sm" onClick={save}>Salvar</Button>}
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </>
  );
}

/* ---------- ADICIONAR ETAPA (MODAL) ---------- */
function AddEtapaDialog({ open, setOpen, onAdd }: { open: boolean; setOpen: (v: boolean) => void; onAdd: (nome: string) => void }) {
  const [item, setItem] = useState("");
  const [descricao, setDescricao] = useState("");
  const submit = () => {
    const nome = item.trim() ? `${item.trim()} - ${descricao.trim()}` : descricao.trim();
    if (!nome) return toast.error("Informe ao menos a descrição");
    onAdd(nome);
    setItem(""); setDescricao(""); setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary"><Plus className="mr-1 size-4"/>Etapa</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Adicionar etapa</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Item nº (prefixo hierárquico)">
            <Input value={item} onChange={(e)=>setItem(e.target.value)} placeholder="Ex.: 1" />
          </Field>
          <Field label="Descrição">
            <Input value={descricao} onChange={(e)=>setDescricao(e.target.value)} placeholder="Ex.: Serviços Preliminares" onKeyDown={(e)=>{ if(e.key==='Enter') submit(); }} />
          </Field>
        </div>
        <DialogFooter><Button onClick={submit}>Adicionar etapa</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- RELATÓRIO ---------- */
const RELATORIO_TABS = [
  { key: "capa", label: "Dados Gerais" },
  { key: "encargos", label: "Encargos" },
  { key: "bdi", label: "BDI" },
  { key: "composicao", label: "Composições" },
  { key: "planilha", label: "Planilha Orçamentária" },
  { key: "resumo", label: "Resumo" },
  { key: "cronograma", label: "Cronograma F/F" },
  { key: "qci", label: "QCI" },
];

function RelatorioTab({ orc, orcId, items, subtotal, totalEncargos, totalComBdi }: any) {
  const [sel, setSel] = useState<Record<string, boolean>>(
    Object.fromEntries(RELATORIO_TABS.map(t => [t.key, true]))
  );
  const [etapasExtra] = useEtapasExtra(orcId);
  const etapasExistentes = useMemo(() => {
    const set = new Set<string>();
    (items as Item[]).forEach(i => { if (i.etapa) set.add(i.etapa); });
    etapasExtra.forEach((e: string) => set.add(e));
    return Array.from(set);
  }, [items, etapasExtra]);
  const groups = useMemo(() => groupItemsByEtapa(items, etapasExistentes), [items, etapasExistentes]);

  const toggle = (k: string) => setSel(prev => ({ ...prev, [k]: !prev[k] }));
  const all = (v: boolean) => setSel(Object.fromEntries(RELATORIO_TABS.map(t => [t.key, v])));

  const sections = () => {
    const out: { key: string; title: string; rows: (string|number)[][] }[] = [];
    const bdiPct = Number(orc.bdi_pct);
    if (sel.capa) out.push({ key: "capa", title: "Dados Gerais", rows: [
      ["Nome", orc.nome ?? ""], ["Contrato", orc.contrato ?? ""], ["Município/UF", `${orc.municipio ?? ""} / ${orc.uf ?? ""}`],
      ["Órgão", orc.orgao ?? ""], ["Referência de Preços", orc.ref_precos ?? ""], ["Engenheiro", orc.engenheiro ?? ""],
      ["CREA", orc.crea ?? ""], ["Objeto", orc.objeto ?? ""],
    ]});
    if (sel.encargos) out.push({ key: "encargos", title: "Encargos", rows: [
      ["Encargos sobre M.O. (%)", fmtPct(Number(orc.encargos_pct))],
      ["Total de encargos referenciais", fmtBRL(totalEncargos)],
    ]});
    if (sel.bdi) out.push({ key: "bdi", title: "BDI", rows: [
      ["BDI aplicado", fmtPct(bdiPct)],
      ["Valor de BDI", fmtBRL(totalComBdi - subtotal)],
    ]});
    if (sel.composicao) {
      const linked = (items as Item[]).filter(i => i.fonte && i.codigo);
      out.push({ key: "composicao", title: "Composições", rows: [
        ["Item","Fonte","Código","Descrição","Un.","Quant.","Custo Unit."],
        ...linked.map(i => [i.item ?? "", i.fonte ?? "", i.codigo ?? "", i.descricao, i.unidade ?? "", Number(i.quantidade), Number(i.preco_unitario)]),
      ]});
    }
    if (sel.planilha) {
      const rows: (string|number)[][] = [["Item","Fonte","Código","Descrição","Un.","Quant.","Preço Unit.","Preço Unit. c/ BDI","Total"]];
      Object.values(groups).forEach(g => {
        rows.push([g.label, "", "", "", "", "", "", "", g.list.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario)*(1+bdiPct),0)]);
        g.list.forEach(i => {
          const pu = Number(i.preco_unitario); const puBdi = pu*(1+bdiPct);
          rows.push([i.item ?? "", i.fonte ?? "", i.codigo ?? "", i.descricao, i.unidade ?? "", Number(i.quantidade), pu, puBdi, Number(i.quantidade)*puBdi]);
        });
      });
      rows.push(["", "", "", "", "", "", "", "TOTAL c/ BDI", totalComBdi]);
      out.push({ key: "planilha", title: "Planilha Orçamentária", rows });
    }
    if (sel.resumo) {
      const grouped: Record<string, number> = {};
      Object.values(groups).forEach(g => { grouped[g.label] = g.list.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario),0); });
      const tot = Object.values(grouped).reduce((a,b)=>a+b,0) || 1;
      const rows: (string|number)[][] = [["Etapa","Total","% Obra"]];
      Object.entries(grouped).forEach(([k,v]) => rows.push([k, v, `${(v/tot*100).toFixed(2)}%`]));
      rows.push(["SUBTOTAL", subtotal, "100,00%"]);
      rows.push([`BDI (${fmtPct(bdiPct)})`, totalComBdi - subtotal, ""]);
      rows.push(["TOTAL GERAL", totalComBdi, ""]);
      out.push({ key: "resumo", title: "Resumo", rows });
    }
    if (sel.cronograma) {
      out.push({ key: "cronograma", title: "Cronograma F/F", rows: [
        ["Etapa","Total estimado"],
        ...Object.values(groups).map(g => [g.label, g.list.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario)*(1+bdiPct),0)]),
      ]});
    }
    if (sel.qci) {
      const repasse = totalComBdi * 0.95;
      out.push({ key: "qci", title: "QCI", rows: [
        ["Investimento total", totalComBdi],
        ["Custo direto (sem BDI)", subtotal],
        [`BDI (${fmtPct(bdiPct)})`, totalComBdi - subtotal],
        ["Repasse (95%)", repasse],
        ["Contrapartida (5%)", totalComBdi - repasse],
      ]});
    }
    return out;
  };

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    sections().forEach(s => {
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.title.substring(0, 31));
    });
    if (wb.SheetNames.length === 0) return toast.error("Selecione ao menos uma aba");
    XLSX.writeFile(wb, `${orc.nome || "orcamento"}.xlsx`);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    const secs = sections();
    if (secs.length === 0) return toast.error("Selecione ao menos uma aba");
    doc.setFontSize(14);
    doc.text(orc.nome || "Orçamento", 14, 14);
    let y = 22;
    secs.forEach((s, idx) => {
      if (idx > 0) doc.addPage();
      doc.setFontSize(12);
      doc.text(s.title, 14, y);
      const head = Array.isArray(s.rows[0]) && typeof s.rows[0][0] === "string" && s.rows.length > 1
        ? [s.rows[0].map(String)]
        : undefined;
      const body = (head ? s.rows.slice(1) : s.rows).map(r => r.map(c => typeof c === "number" ? c.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(c)));
      autoTable(doc, { startY: y + 4, head, body, styles: { fontSize: 8 } });
      y = 14;
    });
    doc.save(`${orc.nome || "orcamento"}.pdf`);
  };

  return (
    <div className="mt-4 max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">Selecione as abas que devem compor o relatório. Por padrão todas estão selecionadas.</p>
      <div className="flex gap-2 text-xs">
        <button className="underline text-muted-foreground" onClick={()=>all(true)}>Selecionar todas</button>
        <button className="underline text-muted-foreground" onClick={()=>all(false)}>Limpar</button>
      </div>
      <div className="rounded-lg border bg-card divide-y">
        {RELATORIO_TABS.map(t => (
          <label key={t.key} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
            <Checkbox checked={!!sel[t.key]} onCheckedChange={()=>toggle(t.key)} />
            <span className="text-sm">{t.label}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <Button onClick={exportXlsx}><FileDown className="mr-2 size-4"/>Exportar .xlsx</Button>
        <Button variant="secondary" onClick={exportPdf}><FileDown className="mr-2 size-4"/>Exportar .pdf</Button>
      </div>
    </div>
  );
}


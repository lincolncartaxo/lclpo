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

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
function parseRef(ref: string | null | undefined): { fonte: string | null; mes: string | null } {
  const m = /^(.+)\|(\d{4}-\d{2}-\d{2})$/.exec(ref ?? "");
  return m ? { fonte: m[1], mes: m[2] } : { fonte: null, mes: null };
}
function fmtRef(ref: string | null | undefined) {
  const { fonte, mes } = parseRef(ref);
  return fonte && mes ? `${fonte} - ${mes.slice(5,7)}/${mes.slice(0,4)}` : (ref ?? "");
}

async function recalculateBudgetPrices(orcamentoId: string, regime: string, uf: string | null, mesRef: string | null = null) {
  const { data: items } = await supabase
    .from("orcamento_itens")
    .select("id,fonte,codigo")
    .eq("orcamento_id", orcamentoId)
    .not("codigo", "is", null);
  await Promise.all((items ?? []).map(async (item) => {
    if (!item.fonte || !item.codigo) return;
    const { data, error } = await supabase.rpc("calcular_custo_composicao", {
      p_fonte: item.fonte,
      p_codigo: item.codigo,
      p_uf: uf?.trim() || "PB",
      p_mes_ref: mesRef ?? "",
      p_regime: regime,
    });
    const price = Number(data);
    if (!error && Number.isFinite(price) && price > 0) {
      await supabase.from("orcamento_itens").update({ preco_unitario: price }).eq("id", item.id);
    }
  }));
}

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
          <TabsContent value="planilha"><PlanilhaTab orcId={id} items={items} reload={load} bdiPct={Number(orc.bdi_pct)} regime={orc.regime ?? "nao_desonerado"} uf={orc.uf ?? null} refPrecos={orc.ref_precos ?? null} /></TabsContent>
          <TabsContent value="resumo"><ResumoTab orcId={id} items={items} subtotal={subtotal} totalEncargos={totalEncargos} totalComBdi={totalComBdi} orc={orc} /></TabsContent>
          <TabsContent value="cronograma"><CronogramaTab orcId={id} items={items} totalComBdi={totalComBdi} /></TabsContent>
          <TabsContent value="qci"><QciTab orcId={id} items={items} subtotal={subtotal} totalComBdi={totalComBdi} orc={orc} /></TabsContent>
          <TabsContent value="relatorio"><RelatorioTab orc={orc} orcId={id} items={items} subtotal={subtotal} totalEncargos={totalEncargos} totalComBdi={totalComBdi} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------- CAPA ---------- */
function CapaTab({ orc, onSaved }: { orc: Orc; onSaved: () => void }) {
  const [f, setF] = useState({ ...orc });
  const [bases, setBases] = useState<{ fonte: string; mes_ref: string }[]>([]);
  useEffect(() => {
    if (!f.uf) { setBases([]); return; }
    supabase.rpc("listar_bases_precos" as any, { p_uf: f.uf }).then(({ data }) => setBases((data as any) ?? []));
  }, [f.uf]);
  const save = async () => {
    const { error } = await supabase.from("orcamentos").update({
      nome: f.nome, objeto: f.objeto, contrato: f.contrato, orgao: f.orgao,
      municipio: f.municipio, uf: f.uf, engenheiro: f.engenheiro, crea: f.crea, ref_precos: f.ref_precos,
      regime: f.regime ?? "nao_desonerado",
    } as any).eq("id", orc.id);
    if (error) return toast.error(error.message);
    await recalculateBudgetPrices(orc.id, f.regime ?? "nao_desonerado", f.uf ?? null, parseRef(f.ref_precos).mes);
    toast.success("Dados Gerais salvos"); onSaved();
  };
  return (
    <div className="mt-4 max-w-3xl space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome do Orçamento"><Input value={f.nome ?? ""} onChange={(e)=>setF({...f,nome:e.target.value})} /></Field>
        <Field label="Contrato"><Input value={f.contrato ?? ""} onChange={(e)=>setF({...f,contrato:e.target.value})} /></Field>
        <Field label="Município"><Input value={f.municipio ?? ""} onChange={(e)=>setF({...f,municipio:e.target.value})} /></Field>
        <Field label="UF">
          <Select value={f.uf ?? ""} onValueChange={(v)=>setF({...f, uf: v, ref_precos: null})}>
            <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
            <SelectContent className="max-h-72">{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Órgão / Concedente"><Input value={f.orgao ?? ""} onChange={(e)=>setF({...f,orgao:e.target.value})} /></Field>
        <Field label="Base de Preços (Referência)">
          <Select value={parseRef(f.ref_precos).mes ? (f.ref_precos as string) : ""} onValueChange={(v)=>setF({...f, ref_precos: v})} disabled={!f.uf}>
            <SelectTrigger><SelectValue placeholder={f.uf ? (bases.length ? "Selecione a base" : "Nenhuma base para esta UF") : "Selecione a UF primeiro"} /></SelectTrigger>
            <SelectContent className="max-h-72">{bases.map(b => { const v = `${b.fonte}|${String(b.mes_ref).slice(0,10)}`; return <SelectItem key={v} value={v}>{fmtRef(v)}</SelectItem>; })}</SelectContent>
          </Select>
        </Field>
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
function PlanilhaTab({ orcId, items, reload, bdiPct, regime, uf, refPrecos }: { orcId: string; items: Item[]; reload: () => void; bdiPct: number; regime: string; uf: string | null; refPrecos: string | null }) {
  const [open, setOpen] = useState(false);
  const [openEtapa, setOpenEtapa] = useState(false);
  const [explodeRow, setExplodeRow] = useState<Item | null>(null);
  const [confirmItem, setConfirmItem] = useState<Item | null>(null);
  const [confirmEtapa, setConfirmEtapa] = useState<{ etapa: string; affected: Item[] } | null>(null);
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

  const totalItens = (list: Item[]) =>
    list.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario) * (1 + bdiPct), 0);

  const totalEtapa = (etapa: string, list: Item[]) => {
    const pfx = prefixOf(etapaDrafts[etapa] ?? etapa);
    if (!pfx) return totalItens(list);
    const descendentes = items.filter((item) => {
      const codigo = (item.item || "").trim();
      return codigo === pfx || codigo.startsWith(`${pfx}.`);
    });
    return totalItens(descendentes);
  };


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

  const askDeleteEtapa = (etapa: string) => {
    const pfx = prefixOf(etapa);
    const affected = pfx
      ? items.filter(i => { const c = (i.item||"").trim(); return c === pfx || c.startsWith(pfx + "."); })
      : [];
    setConfirmEtapa({ etapa, affected });
  };

  const doDeleteEtapa = async () => {
    if (!confirmEtapa) return;
    const { etapa, affected } = confirmEtapa;
    if (affected.length > 0) {
      const ids = affected.map(i => i.id);
      const { error } = await supabase.from("orcamento_itens").delete().in("id", ids);
      if (error) return toast.error(error.message);
    }
    setEtapasExtra(prev => prev.filter(e => e !== etapa));
    setConfirmEtapa(null);
    toast.success("Etapa excluída");
    reload();
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <p className="text-sm text-muted-foreground">{items.length} itens · Total c/ BDI {fmtBRL(total)}</p>
        <div className="flex gap-2 items-center">
          <AddEtapaDialog open={openEtapa} setOpen={setOpenEtapa} onAdd={addEtapa} />
          <AddItemDialog orcId={orcId} open={open} setOpen={setOpen} onAdded={reload} nextOrdem={items.length+1} regime={regime} uf={uf} refPrecos={refPrecos} />


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
                      onDelete={()=>askDeleteEtapa(etapa)}
                    />
                  )}
                  <td className="num font-semibold">{fmtBRL(totalEtapa(etapa, group.list))}</td>
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
                          <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={()=>setExplodeRow(i)} title="Composição de Preço Unitário">
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
                      <td><button onClick={()=>setConfirmItem(i)} className="text-destructive hover:opacity-70"><Trash2 className="size-4"/></button></td>
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
      <ExplosaoSheet row={explodeRow} onClose={()=>setExplodeRow(null)} regime={regime} uf={uf} mesRef={parseRef(refPrecos).mes} />
      <ConfirmDialog
        open={!!confirmItem}
        title="Excluir item"
        message={confirmItem ? `Excluir o item "${confirmItem.item ?? ""} — ${confirmItem.descricao}"?` : ""}
        onCancel={()=>setConfirmItem(null)}
        onConfirm={async ()=>{ if (confirmItem) { await remove(confirmItem.id); setConfirmItem(null); } }}
      />
      <ConfirmDialog
        open={!!confirmEtapa}
        title="Excluir etapa"
        message={confirmEtapa ? `Excluir a etapa "${confirmEtapa.etapa}"${confirmEtapa.affected.length ? ` e seus ${confirmEtapa.affected.length} item(ns) vinculado(s)` : ""}?` : ""}
        onCancel={()=>setConfirmEtapa(null)}
        onConfirm={doDeleteEtapa}
      />
    </div>
  );
}

function ExplosaoSheet({ row, onClose, regime, uf, mesRef }: { row: Item | null; onClose: () => void; regime: string; uf: string | null; mesRef: string | null }) {
  const [rows, setRows] = useState<any[]>([]);
  const [precos, setPrecos] = useState<Record<string, number>>({});
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
      const items = data ?? [];
      setRows(items);

      // Busca preços dos insumos automaticamente (regime + uf do orçamento)
       const codigos = Array.from(new Set(items.filter((r: any) => r.tipo !== "COMPOSICAO").map((r: any) => r.insumo_codigo).filter(Boolean)));
       const compCodes = Array.from(new Set(items.filter((r: any) => r.tipo === "COMPOSICAO").map((r: any) => r.insumo_codigo).filter(Boolean)));
      const map: Record<string, number> = {};
      if (codigos.length) {
        const priceCol = regime === "desonerado" ? "preco_desonerado" : "preco_nao_desonerado";
         let q: any = supabase.from("base_insumos").select(`codigo,fonte,uf,${priceCol}`).eq("fonte", row.fonte!).in("codigo", codigos as string[]);
        if (uf) q = q.eq("uf", uf);
        if (mesRef) q = q.eq("mes_ref", mesRef); else q = q.order("mes_ref", { ascending: false });
        const { data: ins } = await q;
        (ins ?? []).forEach((r: any) => {
          if (r.codigo && map[r.codigo] == null) map[r.codigo] = Number(r[priceCol] ?? 0);
        });
      }
       if (compCodes.length) {
         const entries = await Promise.all(compCodes.map(async (codigo) => {
           const { data } = await supabase.rpc("calcular_custo_composicao", {
             p_fonte: row.fonte!, p_codigo: String(codigo), p_uf: uf?.trim() || "PB",
             p_mes_ref: mesRef ?? "", p_regime: regime,
           });
           return [String(codigo), Number(data) || 0] as const;
         }));
         entries.forEach(([codigo, price]) => { map[codigo] = price; });
       }
      setPrecos(map);
      setLoading(false);
    })();
  }, [row, regime, uf, mesRef]);
  const priceOf = (r: any) => Number(precos[r.insumo_codigo ?? ""] ?? 0);
  const total = rows.reduce((s, r) => s + Number(r.coeficiente) * priceOf(r), 0);
  return (
    <Sheet open={!!row} onOpenChange={(o)=>{ if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Composição de Preço Unitário</SheetTitle>
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

function AddItemDialog({ orcId, open, setOpen, onAdded, nextOrdem, regime, uf, refPrecos }: any) {
  const FONTES_ALL = ["SINAPI","DER","SICRO3","SBC","ORSE","Outras"];
  const [tab, setTab] = useState("base");
  const ref = parseRef(refPrecos);
  const mesUse: string | null = ref.mes;
  const [fonte, setFonte] = useState<string>(ref.fonte ?? "__all");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [item, setItem] = useState("");
  const [quant, setQuant] = useState("1");

  // manual fields
  const [m, setM] = useState({ descricao: "", unidade: "un", preco_unitario: "0" });

  const ufUse = (uf && String(uf).trim()) || "PB";

  useEffect(() => {
    const t = setTimeout(async () => {
      let qb: any = supabase
        .from("base_composicoes")
        .select("codigo,descricao,unidade,custo_desonerado,custo_nao_desonerado,fonte")
        .limit(30);
      if (fonte !== "__all") qb = qb.eq("fonte", fonte);
      if (q.trim()) qb = qb.textSearch('descricao', q);
      const { data } = await qb;
      const rows = data ?? [];
      setResults(rows);
      setPrices({});
      const entries = await Promise.all(rows.map(async (r: any) => {
        try {
          const { data: p } = await supabase.rpc("calcular_custo_composicao" as any, {
            p_fonte: r.fonte, p_codigo: String(r.codigo),
            p_uf: ufUse, p_mes_ref: (mesUse ?? null) as any, p_regime: regime,
          });
          return [`${r.fonte}|${r.codigo}`, Number(p ?? 0)] as const;
        } catch { return [`${r.fonte}|${r.codigo}`, 0] as const; }
      }));
      setPrices(Object.fromEntries(entries));
    }, 250);
    return () => clearTimeout(t);
  }, [q, fonte, regime, ufUse, mesUse]);

  const addFromBase = async (r: any) => {
    // Sempre calcula recursivamente a partir dos insumos (UF do orçamento, último mês disponível)
    let preco = 0;
    try {
      const { data, error } = await supabase.rpc("calcular_custo_composicao" as any, {
        p_fonte: r.fonte, p_codigo: String(r.codigo),
        p_uf: ufUse, p_mes_ref: mesUse ?? null, p_regime: regime,
      });
      if (error) throw error;
      preco = Number(data ?? 0);
    } catch {
      preco = 0;
    }
    await supabase.from("orcamento_itens").insert({
      orcamento_id: orcId, ordem: nextOrdem, etapa: null, item: item || null,
      fonte: r.fonte, codigo: String(r.codigo), descricao: r.descricao, unidade: r.unidade,
      quantidade: Number(quant.replace(",",".") || 1),
      preco_unitario: preco,
    });
    if (!preco) toast.warning("Item adicionado sem preço (insumos sem cotação para a UF/mês).");
    else toast.success("Item adicionado");
    setOpen(false); onAdded();
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
        <p className="text-xs text-muted-foreground -mt-2">O item é agrupado automaticamente na etapa cujo prefixo corresponde (ex.: item “1.1” entra na etapa “1 - …”). Preços filtrados por: <strong>{regime === "desonerado" ? "Desonerado" : "Não Desonerado"}</strong> · UF <strong>{ufUse}</strong> · Base <strong>{refPrecos ? fmtRef(refPrecos) : "mais recente"}</strong>.</p>
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
                <tbody>{results.map((r,i)=>{ const pk = `${r.fonte}|${r.codigo}`; const pv = prices[pk]; return (<tr key={i}><td>{r.fonte}</td><td>{r.codigo}</td><td>{r.descricao}</td><td>{r.unidade}</td><td className="num">{pv===undefined ? "…" : fmtBRL(pv)}</td><td><Button size="sm" variant="secondary" onClick={()=>addFromBase(r)}>Adicionar</Button></td></tr>);})}</tbody>
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
/** Linhas do resumo: cada etapa soma todos os itens descendentes pelo prefixo hierárquico. */
function useResumoRows(orcId: string, items: Item[]) {
  const [etapasExtra] = useEtapasExtra(orcId);
  return useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.etapa) set.add(i.etapa); });
    etapasExtra.forEach(e => set.add(e));
    const groups = groupItemsByEtapa(items, Array.from(set));
    const val = (l: Item[]) => l.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
    const rows = Object.entries(groups).map(([etapa, g]) => {
      const pfx = prefixOf(etapa);
      const total = pfx
        ? val(items.filter(i => { const c = (i.item || "").trim(); return c === pfx || c.startsWith(pfx + "."); }))
        : val(g.list);
      return { label: g.label, total, nivel: pfx ? pfx.split(".").length - 1 : 0 };
    });
    // base do % = somente etapas de nível raiz (evita contar subetapas duas vezes)
    const base = rows.filter(r => r.nivel === 0).reduce((a, r) => a + r.total, 0) || 1;
    return { rows, base };
  }, [items, etapasExtra]);
}

function ResumoTab({ orcId, items, subtotal, totalEncargos, totalComBdi, orc }: any) {
  const { rows, base: totGrupos } = useResumoRows(orcId, items);
  return (
    <div className="mt-4 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
        <table className="budget-table">
          <thead><tr><th>Etapa</th><th className="num">Total</th><th className="num">% Obra</th></tr></thead>
          <tbody>
            {rows.map((r,idx)=>(<tr key={idx} className={r.nivel===0?"font-medium":""}><td style={{paddingLeft: 8 + r.nivel*16}}>{r.label}</td><td className="num">{fmtBRL(r.total)}</td><td className="num">{fmtPct(r.total/totGrupos)}</td></tr>))}
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

  const updateCell = (etapa: string, mes: number, val: number) => {
    setGrid(prev => ({ ...prev, [etapa]: { ...(prev[etapa]||{}), [mes]: val } }));
  };

  const saveCell = async (etapa: string, mes: number, percent: number) => {
    const val = Math.max(0, Math.min(100, percent)) / 100;
    updateCell(etapa, mes, val);
    await supabase.from("orcamento_cronograma").upsert({ orcamento_id: orcId, etapa, mes, percentual: val }, { onConflict: "orcamento_id,etapa,mes" });
  };

  const fator = totalComBdi / Math.max(subtotalAll, 1);
  // Subetapas descendentes (por prefixo hierárquico) de cada etapa
  const descendentes = useMemo(() => {
    const m: Record<string, string[]> = {};
    etapas.forEach(e => {
      const p = prefixOf(e);
      m[e] = p ? etapas.filter(o => o !== e && prefixOf(o).startsWith(p + ".")) : [];
    });
    return m;
  }, [etapas]);
  const isParent = (e: string) => (descendentes[e]?.length ?? 0) > 0;
  const folhasDe = (e: string) => descendentes[e].filter(d => !isParent(d));
  const totalEtapa = (e: string) => {
    if (!isParent(e)) return (totaisPorEtapa[e] || 0) * fator;
    return folhasDe(e).reduce((s, d) => s + (totaisPorEtapa[d] || 0) * fator, 0);
  };
  const pctCell = (e: string, mes: number): number => {
    if (!isParent(e)) return grid[e]?.[mes] || 0;
    const tot = totalEtapa(e);
    if (tot <= 0) return 0;
    return folhasDe(e).reduce((s, d) => s + (grid[d]?.[mes] || 0) * (totaisPorEtapa[d] || 0) * fator, 0) / tot;
  };
  const valorMes = (mes: number) => etapas.filter(e => !isParent(e)).reduce((s,e)=>s + (grid[e]?.[mes]||0) * totalEtapa(e), 0);


  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3">
        <Label>Meses:</Label>
        <Input className="w-24" type="number" min={1} max={36} value={meses} onChange={(e)=>setMeses(Math.max(1, Math.min(36, Number(e.target.value))))} />
        <p className="text-xs text-muted-foreground">Informe o percentual de execução de cada etapa por mês (0 a 100%).</p>
      </div>
      <div className="overflow-x-auto rounded border bg-card">
        <table className="budget-table">
          <thead><tr><th>Etapa</th>{Array.from({length:meses},(_,i)=>i+1).map(m=>(<th key={m} className="num">M{m}</th>))}<th className="num">Σ</th></tr></thead>
          <tbody>
            {etapas.map(e=>{
              const sum = Array.from({length:meses},(_,i)=>i+1).reduce((s,m)=>s+pctCell(e, m),0);
              const parent = isParent(e);
              return (
                <tr key={e} className={parent ? "bg-secondary/30 font-semibold" : undefined}>
                  <td className="font-medium">{e}</td>
                  {Array.from({length:meses},(_,i)=>i+1).map(m=> parent ? (
                    <td key={m} className="num" title="Calculado a partir das subetapas">{fmtPct(pctCell(e, m))}</td>
                  ) : (
                    <td key={m} className="num">
                      <div className="flex min-w-20 items-center justify-end gap-1">
                        <input
                          className="w-14 bg-transparent text-right outline-none"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={grid[e]?.[m] == null ? "" : Number((grid[e][m] * 100).toFixed(2))}
                          onChange={(event) => {
                            const percent = Math.max(0, Math.min(100, Number(event.target.value) || 0));
                            updateCell(e, m, percent / 100);
                          }}
                          onBlur={(event)=>saveCell(e, m, Number(event.target.value) || 0)}
                          aria-label={`${e}, mês ${m}, percentual`}
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
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
function QciTab({ orcId, items, subtotal, totalComBdi, orc }: any) {
  const { rows, base } = useResumoRows(orcId, items);
  const key = `orc_contrapartida_${orcId}`;
  const [cp, setCp] = useState<number>(0);
  useEffect(() => { const v = Number(window.localStorage.getItem(key)); if (!isNaN(v)) setCp(v); }, [key]);
  const upd = (v: number) => { const n = Math.min(100, Math.max(0, v || 0)); setCp(n); window.localStorage.setItem(key, String(n)); };
  const fc = cp / 100, fr = 1 - fc;
  const line = (label: string, total: number, cls = "", pad = 8, pct?: number) => (
    <tr className={cls}><td style={{paddingLeft: pad}}>{label}</td><td className="num">{fmtBRL(total*fr)}</td><td className="num">{fmtBRL(total*fc)}</td><td className="num">{fmtBRL(total)}</td><td className="num">{pct !== undefined ? fmtPct(pct) : ""}</td></tr>
  );
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-end gap-3">
        <Field label="Contrapartida (%)">
          <div className="relative w-40">
            <Input type="number" min={0} max={100} step="0.01" value={cp} onChange={e => upd(Number(e.target.value))} className="pr-7" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </Field>
        <p className="text-sm text-muted-foreground pb-2">Repasse: {fmtNum(100 - cp)}%</p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="budget-table">
          <thead><tr><th>Etapa</th><th className="num">Repasse ({fmtNum(100-cp)}%)</th><th className="num">Contrapartida ({fmtNum(cp)}%)</th><th className="num">Total</th><th className="num">% Obra</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <React.Fragment key={i}>{line(r.label, r.total, r.nivel===0?"font-medium":"", 8 + r.nivel*16, r.total/base)}</React.Fragment>)}
            {line("SUBTOTAL", subtotal, "font-semibold", 8, 1)}
            {line(`BDI (${fmtPct(orc.bdi_pct)})`, totalComBdi - subtotal)}
            {line("TOTAL GERAL", totalComBdi, "bg-primary/10 font-bold")}
          </tbody>
        </table>
      </div>
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
        
          <DialogFooter className="flex justify-between items-center w-full">
            <Button variant="outline" onClick={exportTransferegov} disabled={!tgModo || tgBusy}>Baixar JSON</Button>
            <Button onClick={enviarTransferegov} disabled={!tgModo || tgBusy || !tgProp.nrproposta || !tgProp.anoproposta}>
              {tgBusy ? "Enviando..." : "Enviar Direto (Transferegov)"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
  );
}


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
import { useServerFn } from "@tanstack/react-start";
import { consultarPropostaTG, enviarPOTransferegov } from "@/lib/transferegov.functions";
import { fmtBRL, fmtPct, fmtNum } from "@/lib/format";
import { ImportExcelDialog } from "@/components/ImportExcelDialog";

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

  // Hydrate from Database (Cronograma) to prevent stages from disappearing across devices/logins
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orcamento_cronograma").select("etapa").eq("orcamento_id", orcId);
      if (data && data.length > 0) {
        const dbEtapas = data.map(r => r.etapa);
        setEtapasExtra(prev => {
          const merged = Array.from(new Set([...prev, ...dbEtapas]));
          if (merged.length !== prev.length) return merged;
          return prev;
        });
      }
    })();
  }, [orcId]);

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
  head: () => ({ meta: [{ title: "Editor de Orçamento — LclPlan" }] }),
  component: Editor,
});

type Orc = any;
type Item = {
  id: string; orcamento_id: string; ordem: number;
  etapa: string | null; item: string | null; fonte: string | null;
  codigo: string | null; descricao: string; unidade: string | null;
  quantidade: number; preco_unitario: number;
  memoria?: any[];
};

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
function parseRef(ref: string | null | undefined): { fonte: string | null; mes: string | null } {
  if (!ref || !ref.includes("|")) return { fonte: null, mes: null };
  const parts = ref.split("|");
  return { fonte: parts[0], mes: parts[1] };
}
function fmtRef(ref: string | null | undefined) {
  const p = parseRef(ref);
  if (!p.fonte || !p.mes) return ref ?? "—";
  const parts = p.mes.split("-");
  return parts.length >= 2 ? `${p.fonte} | ${parts[1]}/${parts[0]}` : `${p.fonte} | ${p.mes}`;
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
            <TabsTrigger value="cotacao">Cotação</TabsTrigger>
            <TabsTrigger value="planilha">Planilha Orçamentária</TabsTrigger>
            <TabsTrigger value="memoria">Memória de Cálculo</TabsTrigger>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="cronograma">Cronograma F/F</TabsTrigger>
            <TabsTrigger value="abc">Curva ABC</TabsTrigger>
            <TabsTrigger value="qci">QCI</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          </TabsList>

          <TabsContent value="capa"><CapaTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="encargos"><EncargosTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="bdi"><BdiTab orc={orc} onSaved={load} /></TabsContent>
          <TabsContent value="cotacao"><CotacaoTab /></TabsContent>
          <TabsContent value="memoria"><MemoriaTab orcId={id} items={items} reload={load} /></TabsContent>
          <TabsContent value="abc"><CurvaABCTab orcId={id} items={items} bdiPct={Number(orc.bdi_pct)} /></TabsContent>
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
    supabase.rpc("listar_bases_precos" as any, { p_uf: f.uf }).then(({ data }) => {
      const next = (data as any) ?? []; setBases(next);
      setF((prev: Orc) => ({ ...prev, ref_precos: prev.ref_precos && next.some((b: any) => `${b.fonte}|${b.mes_ref}` === prev.ref_precos) ? prev.ref_precos : (next[0] ? `${next[0].fonte}|${next[0].mes_ref}` : "") }));
    });
  }, [f.uf]);
  const save = async () => {
    const updatePayload = {
      nome: f.nome, objeto: f.objeto, contrato: f.contrato, orgao: f.orgao,
      municipio: f.localizacao ?? f.municipio, localizacao: f.localizacao ?? f.municipio, uf: f.uf, engenheiro: f.engenheiro, crea: f.crea, ref_precos: f.ref_precos,
      regime: f.regime ?? "nao_desonerado",
    } as any;
    let { error } = await supabase.from("orcamentos").update(updatePayload).eq("id", orc.id);
    if (error && (error.code === "42703" || error.code === "PGRST204" || error.message?.toLowerCase().includes("localizacao"))) {
      const fallback = { ...updatePayload };
      delete fallback.localizacao;
      ({ error } = await supabase.from("orcamentos").update(fallback).eq("id", orc.id));
    }
    if (error) return toast.error(error.message);
    await recalculateBudgetPrices(orc.id, f.regime ?? "nao_desonerado", f.uf ?? null, parseRef(f.ref_precos).mes);
    toast.success("Dados Gerais salvos"); onSaved();
  };
  return (
    <div className="mt-4 max-w-3xl space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome do Orçamento"><Input value={f.nome ?? ""} onChange={(e)=>setF({...f,nome:e.target.value})} /></Field>
        <Field label="Contrato"><Input value={f.contrato ?? ""} onChange={(e)=>setF({...f,contrato:e.target.value})} /></Field>
        <Field label="Endereço / localização da intervenção"><Input value={f.localizacao ?? f.municipio ?? ""} onChange={(e)=>setF({...f,localizacao:e.target.value})} /></Field>
        <Field label="UF">
          <Select value={f.uf ?? ""} onValueChange={(v)=>setF({...f, uf: v, ref_precos: null})}>
            <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
            <SelectContent className="max-h-72">{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Órgão / Concedente"><Input value={f.orgao ?? ""} onChange={(e)=>setF({...f,orgao:e.target.value})} /></Field>
        <Field label="Base de Preços (Referência)">
          <Select value={f.ref_precos || ""} onValueChange={(v)=>setF({...f, ref_precos: v})} disabled={!f.uf}>
            <SelectTrigger><SelectValue placeholder={f.uf ? (bases.length ? "Selecione a base" : "Nenhuma base para esta UF") : "Selecione a UF primeiro"} /></SelectTrigger>
            <SelectContent className="max-h-72">{bases.map(b => { const v = `${b.fonte}|${String(b.mes_ref)}`; return <SelectItem key={v} value={v}>{fmtRef(v)}</SelectItem>; })}</SelectContent>
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
  const [b, setB] = useState({ ac: Number(orc.bdi_ac ?? 4.0), s: Number(orc.bdi_s ?? 0.8), r: Number(orc.bdi_r ?? 0.97), g: Number(orc.bdi_g ?? 8.04), l: Number(orc.bdi_l ?? 6.16), i: Number(orc.bdi_i ?? 5.0), tipo: "Edificações" });
  useEffect(() => {
    setB({ ac: Number(orc.bdi_ac ?? 4.0), s: Number(orc.bdi_s ?? 0.8), r: Number(orc.bdi_r ?? 0.97), g: Number(orc.bdi_g ?? 8.04), l: Number(orc.bdi_l ?? 6.16), i: Number(orc.bdi_i ?? 5.0), tipo: "Edificações" });
  }, [orc.id, orc.bdi_ac, orc.bdi_s, orc.bdi_r, orc.bdi_g, orc.bdi_l, orc.bdi_i]);
  const calc = useMemo(() => {
    const ac = b.ac/100, s=b.s/100, r=b.r/100, g=b.g/100, l=b.l/100, i=b.i/100;
    const bdi = ((1+(ac+s+r+g))*(1+l)*(1+(0))/(1-i)) - 1; // simplificado
    return bdi;
  }, [b]);
  const save = async () => {
    if (b.i >= 100 || [b.ac,b.s,b.r,b.g,b.l,b.i].some(v => !Number.isFinite(v) || v < 0)) {
      return toast.error("Informe coeficientes válidos; Tributos deve ser menor que 100%.");
    }
    const { error } = await (supabase.from("orcamentos") as any).update({ bdi_pct: Number(calc.toFixed(8)), bdi_ac: b.ac, bdi_s: b.s, bdi_r: b.r, bdi_g: b.g, bdi_l: b.l, bdi_i: b.i }).eq("id", orc.id);
    if (error) return toast.error(error.message);
    toast.success(`BDI de ${fmtPct(calc)} aplicado ao orçamento`); await onSaved();
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

/* ---------- PLANILHA LCLPLANMENTÁRIA ---------- */
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
          <ImportExcelDialog orcId={orcId} regime={regime} uf={uf} mesRef={parseRef(refPrecos).mes} nextOrdem={items.length+1} onImported={reload}
            onEtapas={(ns) => setEtapasExtra(prev => Array.from(new Set([...prev, ...ns.filter(n => !etapasExistentes.includes(n))])))} />
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
      <ExplosaoSheet row={explodeRow} onClose={()=>setExplodeRow(null)} regime={regime} uf={uf} mesRef={refPrecos ? parseRef(refPrecos).mes : null} />
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
      const { data, error } = await (supabase as any)
        .from("catalogo_composicao_itens")
        .select("*")
        .eq("fonte", row.fonte!)
        .eq("codigo_composicao", row.codigo!);
      if (error) {
        console.error("Erro ao carregar itens da composição", error);
        setRows([]);
        setLoading(false);
        return;
      }
      const items = data ?? [];
      const insumoCodes = items.filter((r: any) => r.tipo_item !== "COMPOSICAO").map((r: any) => r.codigo_item).filter(Boolean);
      const compCodesForMeta = items.filter((r: any) => r.tipo_item === "COMPOSICAO").map((r: any) => r.codigo_item).filter(Boolean);
      const [{ data: insumoMeta }, { data: compMeta }] = await Promise.all([
        insumoCodes.length
          ? (supabase as any).from("catalogo_insumos").select("codigo,descricao,unidade").eq("fonte", row.fonte!).in("codigo", insumoCodes)
          : Promise.resolve({ data: [] }),
        compCodesForMeta.length
          ? (supabase as any).from("catalogo_composicoes").select("codigo,descricao,unidade").eq("fonte", row.fonte!).in("codigo", compCodesForMeta)
          : Promise.resolve({ data: [] }),
      ]);
      const meta = new Map<string, any>([...(insumoMeta ?? []), ...(compMeta ?? [])].map((r: any) => [String(r.codigo), r]));
      const itemsWithMeta = items.map((r: any) => ({ ...r, descricao: meta.get(String(r.codigo_item))?.descricao ?? "", unidade: meta.get(String(r.codigo_item))?.unidade ?? "" }));
      setRows(itemsWithMeta);

      // Busca preços dos insumos automaticamente (regime + uf do orçamento)
       const codigos = Array.from(new Set(itemsWithMeta.filter((r: any) => r.tipo_item !== "COMPOSICAO").map((r: any) => r.codigo_item).filter(Boolean)));
       const compCodes = Array.from(new Set(itemsWithMeta.filter((r: any) => r.tipo_item === "COMPOSICAO").map((r: any) => r.codigo_item).filter(Boolean)));
      const map: Record<string, number> = {};
      if (codigos.length) {
        const priceCol = regime === "desonerado" ? "preco_desonerado" : "preco_nao_desonerado";
         let q: any = (supabase as any).from("precos_historicos_insumos").select(`codigo_insumo,fonte,uf,${priceCol}`).eq("fonte", row.fonte!).in("codigo_insumo", codigos as string[]);
        if (uf) q = q.in("uf", [uf, 'BR']);
        if (mesRef) q = q.eq("mes_ref", mesRef); else q = q.order("mes_ref", { ascending: false });
        const { data: ins } = await q;
        (ins ?? []).forEach((r: any) => {
          // Previnir que uma versao sem mes de outra UF sobrescreva a correta (gambiarra leve pro sort)
          if (r.codigo_insumo && map[r.codigo_insumo] == null) map[r.codigo_insumo] = Number(r[priceCol] ?? 0);
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
  const priceOf = (r: any) => Number(precos[r.codigo_item ?? ""] ?? 0);
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
                  <td>{r.tipo_item ?? "—"}</td>
                  <td>{r.codigo_item ?? "—"}</td>
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
      const makeQuery = (byCode: boolean) => {
        let x: any = (supabase as any).from("catalogo_composicoes")
          .select("codigo,fonte,descricao,unidade")
          .limit(30);
        if (fonte !== "__all") x = x.eq("fonte", fonte);
        if (q.trim()) x = byCode
          ? x.ilike("codigo", `%${q.trim()}%`)
          : x.ilike("descricao", `%${q.trim()}%`);
        return x;
      };
      const queries = q.trim() ? await Promise.all([makeQuery(true), makeQuery(false)]) : [await makeQuery(false)];
      const data = Array.from(new Map(queries.flatMap((x: any) => x.data ?? []).map((r: any) => [`${r.fonte}|${r.codigo}`, r])).values());
      const rows = (data ?? []).map((r:any) => ({
         codigo: r.codigo,
         fonte: r.fonte,
         descricao: r.descricao,
         unidade: r.unidade,
      }));
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
function normalizeCronogramaEtapa(etapa: string) {
  const value = String(etapa || "").trim();
  return value === "1 - Serviço Preliminares" ? "1 - Serviços Preliminares" : value;
}

function CronogramaTab({ orcId, items, totalComBdi }: { orcId: string; items: Item[]; totalComBdi: number }) {
  const [etapasExtra] = useEtapasExtra(orcId);
  const [persistedEtapas, setPersistedEtapas] = useState<string[]>([]);
  const etapasExistentes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.etapa) set.add(normalizeCronogramaEtapa(i.etapa)); });
    etapasExtra.forEach(e => set.add(normalizeCronogramaEtapa(e)));
    persistedEtapas.forEach(e => set.add(normalizeCronogramaEtapa(e)));
    return Array.from(set);
  }, [items, etapasExtra, persistedEtapas]);
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
  const mesesStorageKey = `orcamento_${orcId}_cronograma_meses`;

  useEffect(() => {
    const savedMonths = Number(window.localStorage.getItem(mesesStorageKey));
    if (Number.isFinite(savedMonths) && savedMonths >= 1) {
      setMeses(Math.min(36, Math.max(1, Math.trunc(savedMonths))));
    }
  }, [mesesStorageKey]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orcamento_cronograma").select("*").eq("orcamento_id", orcId);
      const g: Record<string, Record<number, number>> = {};
      (data ?? []).forEach((r: any) => {
        const etapa = normalizeCronogramaEtapa(r.etapa);
        let percentual = Number(r.percentual);
        // Compatibilidade com registros antigos que armazenavam 20 em vez de 0,20.
        if (percentual > 1 && percentual <= 100) percentual /= 100;
        (g[etapa] ??= {})[r.mes] = percentual;
      });
      setGrid(g);
      // Etapas criadas por outro usuário também passam a aparecer neste navegador.
      // Elas não dependem mais apenas do localStorage de cada usuário.
      setPersistedEtapas(Object.keys(g));
      const maxSavedMonth = (data ?? []).reduce((max: number, r: any) => Math.max(max, Number(r.mes) || 0), 0);
      if (maxSavedMonth > 0) {
        setMeses(current => Math.min(36, Math.max(current, maxSavedMonth)));
      }
    })();
  }, [orcId]);

  const updateCell = (etapa: string, mes: number, val: number) => {
    setGrid(prev => ({ ...prev, [etapa]: { ...(prev[etapa]||{}), [mes]: val } }));
  };

  const saveCell = async (etapa: string, mes: number, percent: number) => {
    const val = Math.max(0, Math.min(100, percent)) / 100;
    const etapaNormalizada = normalizeCronogramaEtapa(etapa);
    updateCell(etapaNormalizada, mes, val);
    const { error } = await supabase.from("orcamento_cronograma").upsert({ orcamento_id: orcId, etapa: etapaNormalizada, mes, percentual: val }, { onConflict: "orcamento_id,etapa,mes" });
    if (error) toast.error(`Não foi possível salvar o cronograma: ${error.message}`);
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
        <Input className="w-24" type="number" min={1} max={36} value={meses} onChange={(e)=>{
          const value = Math.max(1, Math.min(36, Number(e.target.value) || 1));
          setMeses(value);
          window.localStorage.setItem(mesesStorageKey, String(value));
        }} />
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
        <DialogFooter><Button onClick={submit}>Adicionar etapa</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- CONFIRMAÇÃO DE EXCLUSÃO ---------- */
function ConfirmDialog({ open, title, message, onCancel, onConfirm }: { open: boolean; title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o)=>{ if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Excluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- RELATÓRIO ---------- */
const RELATORIO_TABS = [
  { key: "capa", label: "Dados Gerais" },
  { key: "encargos", label: "Encargos" },
  { key: "bdi", label: "BDI" },
  { key: "composicao", label: "Composições analíticas" },
  { key: "planilha", label: "Planilha Orçamentária" },
  { key: "abc", label: "Curva ABC" },
  { key: "memoria", label: "Memória de Cálculo" },
  { key: "resumo", label: "Resumo" },
  { key: "cronograma", label: "Cronograma F/F" },
  { key: "qci", label: "QCI" },
];

function RelatorioTab({ orc, orcId, items, subtotal, totalEncargos, totalComBdi }: any) {
  const [sel, setSel] = useState<Record<string, boolean>>(
    Object.fromEntries(RELATORIO_TABS.map(t => [t.key, true]))
  );
  const [etapasExtra] = useEtapasExtra(orcId);
  const [somenteProprias, setSomenteProprias] = useState(false);
  const [analiticas, setAnaliticas] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    const composicoes = (items as Item[]).filter(i => i.fonte && i.codigo && (!somenteProprias || ["PRÓPRIA", "PROPRIA"].includes(String(i.fonte).toUpperCase())));
    (async () => {
      const result: any[] = [];
      const mes = parseRef(orc.ref_precos).mes;
      for (const item of composicoes) {
        const { data } = await (supabase as any).from("catalogo_composicao_itens").select("tipo_item,codigo_item,coeficiente").eq("fonte", item.fonte).eq("codigo_composicao", item.codigo);
        const rows = data ?? [], codes = rows.map((r: any) => String(r.codigo_item));
        const [{ data: insumoMeta }, { data: composicaoMeta }] = await Promise.all([
          (supabase as any).from("catalogo_insumos").select("codigo,descricao,unidade").eq("fonte", item.fonte).in("codigo", codes),
          (supabase as any).from("catalogo_composicoes").select("codigo,descricao,unidade").eq("fonte", item.fonte).in("codigo", codes),
        ]);
        const meta = new Map<string, { descricao?: string; unidade?: string }>([...(insumoMeta ?? []), ...(composicaoMeta ?? [])].map((m: any) => [String(m.codigo), m] as const));
        const col = orc.regime === "desonerado" ? "preco_desonerado" : "preco_nao_desonerado";
        const { data: priceRows } = await (supabase as any).from("precos_historicos_insumos").select(`codigo_insumo,uf,${col}`).eq("fonte", item.fonte).in("codigo_insumo", codes).in("uf", [orc.uf || "BR", "BR"]).eq("mes_ref", mes || "");
        const prices = new Map<string, number>();
        for (const priceRow of priceRows ?? []) {
          const code = String(priceRow.codigo_insumo);
          const isPreferredUf = String(priceRow.uf).toUpperCase() === String(orc.uf || "BR").toUpperCase();
          if (!prices.has(code) || isPreferredUf) prices.set(code, Number(priceRow[col] ?? 0));
        }
        result.push({ composicao: item.codigo, fonte: item.fonte, codigo_item: "", tipo_item: "ITEM DO ORÇAMENTO", coeficiente: Number(item.quantidade ?? 0), descricao: item.descricao ?? "", unidade: item.unidade ?? "", preco_unitario: Number(item.preco_unitario ?? 0), subtotal: Number(item.quantidade ?? 0) * Number(item.preco_unitario ?? 0), isParent: true });
        for (const row of rows) {
          const m = meta.get(String(row.codigo_item)) ?? {};
          let price = prices.get(String(row.codigo_item)) ?? 0;
          if (String(row.tipo_item).toUpperCase() === "COMPOSICAO") {
            const { data: childPrice } = await supabase.rpc("calcular_custo_composicao", { p_fonte: String(item.fonte), p_codigo: String(row.codigo_item), p_uf: orc.uf || "BR", p_mes_ref: mes || "", p_regime: orc.regime === "desonerado" ? "desonerado" : "nao_desonerado" });
            price = Number(childPrice ?? 0);
          }
          result.push({ composicao: item.codigo, fonte: item.fonte, ...row, descricao: m.descricao ?? "", unidade: m.unidade ?? "", preco_unitario: price, subtotal: Number(item.quantidade ?? 0) * Number(row.coeficiente ?? 0) * price, isParent: false });
        }
      }
      if (!cancelled) setAnaliticas(result);
    })();
    return () => { cancelled = true; };
  }, [items, somenteProprias, orc.ref_precos, orc.uf, orc.regime]);
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
      ["Nome", orc.nome ?? ""], ["Contrato", orc.contrato ?? ""], ["Endereço / localização", orc.localizacao ?? orc.municipio ?? ""], ["UF da base de preços", orc.uf ?? ""],
      ["Órgão", orc.orgao ?? ""], ["Referência de Preços", fmtRef(orc.ref_precos)], ["Regime tributário", orc.regime === "desonerado" ? "Desonerado" : "Não desonerado"], ["Engenheiro", orc.engenheiro ?? ""],
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
      out.push({ key: "composicao", title: "Composições", rows: [
        ["Tipo","Código","Descrição","Un.","Coef.",`Preço Unit. (${orc.regime === "desonerado" ? "Desonerado" : "Não desonerado"})`,"Subtotal"],
        ...analiticas.map(r => [
          r.isParent ? `COMPOSIÇÃO (${r.fonte})` : String(r.tipo_item ?? "INSUMO").toUpperCase(),
          r.isParent ? r.composicao : r.codigo_item,
          r.descricao ?? "",
          r.unidade ?? "",
          Number(r.coeficiente),
          Number(r.preco_unitario ?? 0),
          Number(r.subtotal ?? 0),
        ]),
      ]});
    }
    if (sel.planilha) {
      const rows: (string|number)[][] = [["Item","Fonte","Código","Descrição","Un.","Quant.","Preço Unit.","Preço Unit. c/ BDI","Total"]];
      Object.values(groups).forEach(g => {
        const totalG = g.list.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario)*(1+bdiPct),0);
        rows.push([g.label, "", "", "", "", "", "", "", totalG.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })]);
        g.list.forEach(i => {
          const pu = Number(i.preco_unitario); const puBdi = pu*(1+bdiPct);
          rows.push([i.item ?? "", i.fonte ?? "", i.codigo ?? "", i.descricao, i.unidade ?? "", Number(i.quantidade), pu, puBdi, Number(i.quantidade)*puBdi]);
        });
      });
      rows.push(["", "", "", "", "", "", "", "TOTAL c/ BDI", totalComBdi]);
      out.push({ key: "planilha", title: "Planilha Orçamentária", rows });
    }
    
    if (sel.memoria) {
      const rows: (string|number)[][] = [["Item","Serviço / Descrição","Vez","X1","X2","Y1","Y2","Z1","Z2","Parcial","Total","Geral","Un."]];
      Object.values(groups).forEach(g => {
                const totalG = g.list.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario)*(1+bdiPct),0);
        rows.push([g.label, "", "", "", "", "", "", "", "", "", "", totalG.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), ""]);
        g.list.forEach(i => {
          // Linha Pai
          rows.push([i.item ?? "", i.descricao, "", "", "", "", "", "", "", "", "", Number(i.quantidade), i.unidade ?? ""]);
          // Linhas Filhas (Mems)
          const mems = i.memoria || [];
          mems.forEach((m: any) => {
             const fDim = (d1: number, d2: number) => { if (d1 + d2 === 0) return 1; if (d2 !== 0) return (d1 + d2) / 2; return d1; };
             const p = fDim(m.x1, m.x2) * fDim(m.y1, m.y2) * fDim(m.z1, m.z2);
             rows.push(["", m.descricao, Number(m.vez), Number(m.x1), Number(m.x2), Number(m.y1), Number(m.y2), Number(m.z1), Number(m.z2), p, p * m.vez, "", ""]);
          });
        });
      });
      out.push({ key: "memoria", title: "Memória de Cálculo", rows });
    }
    
    if (sel.abc) {
      const rows: (string|number)[][] = [["Item","Fonte","Código","Descrição","Un.","Qtd","Preço Unit S/BDI","Preço Unit C/BDI","Total","Peso %","Peso Acum %"]];
      
      const map = new Map<string, any>();
      items.filter((i: any) => i.quantidade > 0 && i.preco_unitario > 0).forEach((i: any) => {
        const key = (i.codigo || i.descricao).trim().toUpperCase();
        if (map.has(key)) {
          const existing = map.get(key);
          existing.quantidade += Number(i.quantidade);
        } else {
          map.set(key, { ...i, quantidade: Number(i.quantidade) });
        }
      });

      const list = Array.from(map.values()).map((i: any) => {
        const precoCBdi = i.preco_unitario * (1+bdiPct);
        const total = i.quantidade * precoCBdi;
        return { ...i, precoCBdi, total };
      });

      list.sort((a: any, b: any) => b.total - a.total);
      const totalOrcamento = list.reduce((sum: number, i: any) => sum + i.total, 0);

      let acumulado = 0;
      list.forEach((i: any, index: number) => {
        const peso = (i.total / totalOrcamento) * 100;
        acumulado += peso;
        rows.push([index + 1, i.fonte ?? "", i.codigo ?? "", i.descricao, i.unidade ?? "", Number(i.quantidade), Number(i.preco_unitario), Number(i.precoCBdi), Number(i.total), Number(peso.toFixed(2)), Number(acumulado.toFixed(2))]);
      });
      
      rows.push(["", "", "", "TOTAL GERAL CURVA ABC", "", "", "", "", totalOrcamento, 100, ""]);
      out.push({ key: "abc", title: "Curva ABC", rows });
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
      const cronogramaRows: (string|number)[][] = [
        ["Etapa", ...Array.from({ length: cronoMeses }, (_, i) => `M${i + 1} (%)`), "Σ (%)", "Total estimado"],
      ];
      Object.values(groups).forEach(g => {
        const total = g.list.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario)*(1+bdiPct),0);
        const percentuais = Array.from({ length: cronoMeses }, (_, i) => Number((((crono[g.label]?.[i + 1] ?? 0) * 100)).toFixed(2)));
        cronogramaRows.push([g.label, ...percentuais, Number(percentuais.reduce((s, v) => s + v, 0).toFixed(2)), total]);
      });
      out.push({ key: "cronograma", title: "Cronograma F/F", rows: [
        ...cronogramaRows,
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
    const XLSX = await import("xlsx-js-style");
    const wb = XLSX.utils.book_new();
    const secs = sections();
    
    if (secs.length === 0) return toast.error("Selecione ao menos uma aba");

    secs.forEach(s => {
      const headerInfo: any[][] = [];
      if (orc.orgao) headerInfo.push(['CONCEDENTE / ÓRGÃO:', orc.orgao]);
      if (orc.localizacao || orc.municipio) headerInfo.push(['LOCALIZAÇÃO / UF DA BASE:', `${orc.localizacao || orc.municipio || ''} - ${orc.uf || ''}`]);
      if (orc.contrato) headerInfo.push(['CONTRATO:', orc.contrato]);
      if (orc.nome) headerInfo.push(['OBRA:', orc.nome.toUpperCase()]);
      if (orc.ref_precos) headerInfo.push(['DATA BASE:', orc.ref_precos.split('|')[1] || orc.ref_precos]);
      headerInfo.push(['DESONERAÇÃO:', orc.regime === "desonerado" ? "SIM" : "NÃO"]);
      headerInfo.push([]); // blank line
      headerInfo.push([s.title.toUpperCase()]); // Title of the sheet
      
      const titleRowIndex = headerInfo.length - 1;

      // Prepend the metadata header to the table data
      const finalRows = [...headerInfo, ...s.rows];
      const ws = XLSX.utils.aoa_to_sheet(finalRows);

      const lastCol = Math.max(0, (s.rows[0]?.length ?? 1) - 1);
      const cell = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })] as any;
      const setStyle = (r: number, c: number, style: any) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        // aoa_to_sheet não cria células para posições vazias. Criamos essas
        // células para que a faixa de cor da etapa ocupe a linha inteira.
        if (!ws[ref]) ws[ref] = { v: "", t: "s" };
        const target = ws[ref] as any;
        target.s = { ...(target.s || {}), ...style };
      };
      const blue = "1F3864";
      const rootFill = "D6E0EC";
      const subFill = "EFF3F7";
      const totalFill = "DCE6F1";
      const border = { style: "thin", color: { rgb: "B7C3D0" } };
      const allBorders = { top: border, bottom: border, left: border, right: border };

      // Metadados, título, cabeçalho e linhas de etapa seguem a mesma
      // hierarquia visual do PDF.
      for (let r = 0; r < titleRowIndex; r++) {
        setStyle(r, 0, { font: { bold: true, color: { rgb: blue } }, alignment: { vertical: "center" } });
        if (cell(r, 1)) setStyle(r, 1, { alignment: { vertical: "center" } });
      }
      for (let c = 0; c <= lastCol; c++) {
        setStyle(titleRowIndex, c, {
          fill: { fgColor: { rgb: blue } },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
          alignment: { horizontal: "center", vertical: "center" },
          border: allBorders,
        });
      }

      const hasHead = Array.isArray(s.rows[0]) && typeof s.rows[0][0] === "string" && s.rows.length > 1;
      const dataStart = headerInfo.length;
      if (hasHead) {
        for (let c = 0; c <= lastCol; c++) {
          setStyle(dataStart, c, {
            fill: { fgColor: { rgb: blue } },
            font: { bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: allBorders,
          });
        }
      }
      for (let i = 0; i < s.rows.length; i++) {
        const row = s.rows[i] as any[];
        const excelRow = dataStart + i;
        // O cabeçalho já recebeu fundo azul-marinho, fonte branca e
        // alinhamento centralizado acima. Não deixe a regra das linhas de
        // dados sobrescrever esse estilo.
        if (hasHead && i === 0) continue;
        const first = String(row[0] ?? "").trim();
        const second = String(row[1] ?? "").trim();
        const third = String(row[2] ?? "").trim();
        const isStage = first !== "" && second === "" && third === "";
        const isTotal = first === "SUBTOTAL" || first.includes("BDI (") || first === "TOTAL GERAL";
        const isCompositionItem = s.key === "composicao" && first.startsWith("COMPOSIÇÃO (");
        const prefix = first.match(/^([0-9]+(?:\.[0-9]+)*)/);
        const fill = isTotal ? totalFill : (!prefix || !prefix[1].includes(".")) ? rootFill : subFill;
        for (let c = 0; c <= lastCol; c++) {
          const value = row[c];
          const header = hasHead ? String((s.rows[0] as any[])[c] ?? "").toUpperCase() : "";
          const style: any = { border: allBorders, alignment: { vertical: "center", wrapText: true } };
          if (isStage || isTotal || isCompositionItem) style.fill = { fgColor: { rgb: isCompositionItem ? rootFill : fill } };
          if (isStage || isTotal || isCompositionItem) style.font = { bold: true, color: { rgb: blue } };
          if (typeof value === "number") {
            style.numFmt = /%/.test(header) ? "0.00" : /(PREÇO|CUSTO|TOTAL|INVESTIMENTO|REPASSE|CONTRAPARTIDA|BDI)/.test(header) ? 'R$ #,##0.00' : "#,##0.0000";
            style.alignment = { ...style.alignment, horizontal: "right" };
          }
          setStyle(excelRow, c, style);
        }
      }

      // Larguras compactas e proporcionais ao conteúdo, sem deixar uma
      // descrição isolada expandir toda a planilha.
      ws['!cols'] = Array.from({ length: lastCol + 1 }, (_, c) => {
        const values = s.rows.map(row => String((row as any[])[c] ?? ""));
        const contentWidth = Math.max(0, ...values.map(value => value.length));
        const limit = c === 0 ? 18 : c === 3 ? 42 : 18;
        return { wch: Math.min(limit, Math.max(10, contentWidth + 2)) };
      });
      ws['!rows'] = [{ hpt: 22 }, ...Array.from({ length: finalRows.length - 1 }, () => ({ hpt: 18 }))];
      (ws as any)['!freeze'] = { xSplit: 0, ySplit: dataStart + (hasHead ? 1 : 0) };
      ws['!merges'] = [
        { s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: lastCol } }
      ];
      
      const safeSheetName = s.title.substring(0, 31).split('').filter((char) => !'[]*?/\\:'.includes(char)).join('');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    });
    
    XLSX.writeFile(wb, `${orc.nome || "orcamento"}.xlsx`, { cellStyles: true });
  };

  const exportPdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable;
      if (typeof autoTable !== "function") throw new Error("Módulo de tabelas PDF não foi carregado.");
      const doc = new jsPDF({ orientation: "landscape" });
      const secs = sections();
      if (secs.length === 0) return toast.error("Selecione ao menos uma aba");

    secs.forEach((s, idx) => {
      if (idx > 0) doc.addPage();
      
      let headerY = 10;
      doc.setFontSize(8);
      
      const headerInfo = [];
      if (orc.orgao) headerInfo.push({ label: 'CONCEDENTE / ÓRGÃO:', value: orc.orgao });
      if (orc.municipio) headerInfo.push({ label: 'MUNICÍPIO / UF:', value: `${orc.municipio} - ${orc.uf || ''}` });
      if (orc.contrato) headerInfo.push({ label: 'CONTRATO:', value: orc.contrato });
      if (orc.nome) headerInfo.push({ label: 'OBRA:', value: orc.nome.toUpperCase(), isBold: true });
      if (orc.ref_precos) headerInfo.push({ label: 'DATA BASE:', value: orc.ref_precos.split('|')[1] || orc.ref_precos });
      headerInfo.push({ label: 'DESONERAÇÃO:', value: orc.regime === "desonerado" ? "SIM" : "NÃO", isBold: true });

      headerInfo.forEach(info => {
        doc.setFont("helvetica", "bold");
        doc.text(info.label, 14, headerY);
        doc.setFont("helvetica", info.isBold ? "bold" : "normal");
        doc.text(info.value, 50, headerY);
        headerY += 4;
      });

      // Título da seção sem desenho manual: evita incompatibilidades do
      // jsPDF em tabelas longas com quebra de página.
      doc.setTextColor(31, 56, 100);
      doc.setFontSize(10);
      doc.text(s.title.toUpperCase(), doc.internal.pageSize.width / 2, headerY + 4.5, { align: "center" });

      doc.setTextColor(0, 0, 0);

      const hasHead = Array.isArray(s.rows[0]) && typeof s.rows[0][0] === "string" && s.rows.length > 1;
      const head = hasHead ? [s.rows[0].map(String)] : undefined;
      const body = (hasHead ? s.rows.slice(1) : s.rows).map(r => 
        r.map(c => typeof c === "number" ? c.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(c))
      );

      autoTable(doc, { 
        startY: headerY + 8, 
        head, 
        body, 
        theme: 'grid',
        headStyles: { 
          fillColor: [31, 56, 100], 
          textColor: [255, 255, 255], 
          fontSize: 8, 
          fontStyle: 'bold', 
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: { 
          fontSize: 7, 
          textColor: [0, 0, 0] 
        },
        alternateRowStyles: { 
          fillColor: [255, 255, 255] 
        },
        
        didParseCell: function (data: any) {
          if (data.section === 'body') {
            const firstCol = String(data.row.raw[0] || '').trim();
            const secondCol = String(data.row.raw[1] || '').trim();
            const thirdCol = String(data.row.raw[2] || '').trim();
            const isCompositionItem = s.key === 'composicao' && firstCol.startsWith('COMPOSIÇÃO (');
            const isSubitemMemoria = firstCol === '' && secondCol !== '' && thirdCol !== '';
            const isEtapa = firstCol !== '' && secondCol === '' && thirdCol === '';
            const isTotais = firstCol === "SUBTOTAL" || firstCol.includes("BDI (") || firstCol === "TOTAL GERAL";

            if (isEtapa || firstCol === "Sem etapa" || isTotais || isCompositionItem) {
              const prefixMatch = firstCol.match(/^([0-9]+(?:\.[0-9]+)*)/);
              const isRootEtapa = !prefixMatch || !prefixMatch[1].includes('.');
              // Hachura visual da linha inteira, sem desenho manual: o
              // autoTable mantém este fundo também nas quebras de página.
              data.cell.styles.fillColor = isTotais
                ? [220, 230, 241]
                : isCompositionItem || isRootEtapa ? [214, 224, 236] : [239, 243, 247];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [31, 56, 100];
            }

            if (isSubitemMemoria) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [50, 50, 50];
              if (data.column.index === 1) {
                data.cell.styles.cellPadding = { left: 8, top: 1, bottom: 1, right: 1 };
              }
            } 
            else if (firstCol !== '' && secondCol !== '') {
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
    });
      doc.save(`${orc.nome || "orcamento"}.pdf`);
    } catch (error) {
      console.error("Erro ao exportar relatório PDF", error);
      toast.error(error instanceof Error ? `Não foi possível exportar o PDF: ${error.message}` : "Não foi possível exportar o PDF.");
    }
  };

  /** Transferegov: modalidade PLE (Por Eventos) ou BM (Boletim de Medição). */
  const [tgOpen, setTgOpen] = useState(false);
  const [tgModo, setTgModo] = useState<"" | "PLE" | "BM">("");
  const [tgFrente, setTgFrente] = useState("");
  const [tgErros, setTgErros] = useState<string[] | null>(null);
  const [crono, setCrono] = useState<Record<string, Record<number, number>>>({});
  const [cronoMeses, setCronoMeses] = useState(6);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orcamento_cronograma").select("*").eq("orcamento_id", orcId);
      const g: Record<string, Record<number, number>> = {};
      (data ?? []).forEach((r: any) => { (g[r.etapa] ??= {})[r.mes] = Number(r.percentual); });
      setCrono(g);
      const maxSavedMonth = (data ?? []).reduce((max: number, r: any) => Math.max(max, Number(r.mes) || 0), 0);
      const storedMonths = Number(window.localStorage.getItem(`orcamento_${orcId}_cronograma_meses`));
      setCronoMeses(Math.min(36, Math.max(1, maxSavedMonth, Number.isFinite(storedMonths) && storedMonths > 0 ? Math.trunc(storedMonths) : 6)));
    })();
  }, [orcId, tgOpen]);

  const buildTransferegov = (modo: "PLE" | "BM") => {
    const erros: string[] = [];
    const bdi = Number(orc.bdi_pct);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const frente = tgFrente.trim() || "FRENTE 1";
    if (!orc.nome) erros.push("Dados Gerais: informe o nome do orçamento.");
    if (!orc.uf) erros.push("Dados Gerais: informe a UF.");
    if (!orc.ref_precos) erros.push("Dados Gerais: informe a base/referência de preços.");
    if (!(bdi >= 0) || orc.bdi_pct == null) erros.push("BDI: percentual não informado.");
    const info = etapasExistentes
      .map(e => ({ label: e, pfx: prefixOf(e), desc: e.replace(/^\s*[0-9]+(?:\.[0-9]+)*\s*[-–.:]?\s*/, "").trim() || e }))
      .filter(x => x.pfx);
    const byPfx = new Map(info.map(x => [x.pfx, x.desc]));
    const ancestors = (pfx: string) => {
      const parts = pfx.split(".");
      return parts.map((_, i) => parts.slice(0, i + 1).join(".")).filter(p => byPfx.has(p));
    };
    const tops = info.filter(x => !x.pfx.includes(".")).sort((a, b) => cmpCode(a.pfx, b.pfx));
    const macroservicos: any[] = [];
    Object.entries(groups)
      .filter(([, g]) => g.list.length > 0)
      .sort(([, a], [, b]) => cmpCode(prefixOf(a.label), prefixOf(b.label)))
      .forEach(([, g]) => {
        const pfx = prefixOf(g.label);
        if (!pfx) erros.push(`Itens sem etapa (${g.list.length}): todo item precisa estar dentro de uma etapa.`);
        const chain = pfx ? ancestors(pfx) : [];
        const top = chain[0];
        const evNum = top ? tops.findIndex(t => t.pfx === top) + 1 : 1;
        const evTitulo = top ? byPfx.get(top)! : "SEM ETAPA";
        const descricao = (chain.length ? chain.map(p => byPfx.get(p)).join(" / ") : g.label).slice(0, 100);
        const servicos = g.list.map((i, idx) => {
          const ref = `Item ${i.item || "?"} (${(i.descricao || "").slice(0, 40)})`;
          if (!i.codigo) erros.push(`${ref}: código não informado.`);
          if (!i.fonte) erros.push(`${ref}: fonte não informada.`);
          if (!i.unidade) erros.push(`${ref}: unidade não informada.`);
          if (!(Number(i.quantidade) > 0)) erros.push(`${ref}: quantidade deve ser maior que zero.`);
          if (!(Number(i.preco_unitario) > 0)) erros.push(`${ref}: preço unitário zerado.`);
          const cu = r2(Number(i.preco_unitario));
          const pu = r2(cu * (1 + bdi));
          const q = Number(i.quantidade);
          const cod = String(i.codigo ?? "").trim();
          const base: any = {
            numeroServico: idx + 1,
            fonte: (i.fonte || "OUTROS").toUpperCase(),
            codigo: /^\d+$/.test(cod) ? Number(cod) : cod,
            descricao: i.descricao,
            unidade: (i.unidade || "").toUpperCase(),
            custoUnitarioReferencia: cu,
            custoUnitario: cu,
            bdi: r2(bdi * 100),
            precoUnitario: pu,
            precoTotal: r2(pu * q),
            quantidadeTotal: q,
            observacao: "",
          };
          if (modo === "PLE") {
            base.evento = { numeroEvento: evNum, titulo: evTitulo };
            base.frentesDeObra = [{ numero: 1, nomeFrenteObra: frente, quantidadeItens: q, numeroMesConclusao: 1 }];
          } else {
            base.frentesDeObra = [{ numero: 1, nomeFrenteObra: frente, quantidadeItens: q }];
          }
          return base;
        });
        const ms: any = { numeroMacroservico: macroservicos.length + 1, descricao, servicos };
        if (modo === "BM") {
          const row = crono[g.label] ?? {};
          const parcelas = Object.entries(row)
            .map(([m, v]) => ({ numeroParcela: Number(m), percentualParcela: r2(Number(v) * 100) }))
            .filter(p => p.percentualParcela > 0)
            .sort((a, b) => a.numeroParcela - b.numeroParcela);
          const soma = r2(parcelas.reduce((s, p) => s + p.percentualParcela, 0));
          if (!parcelas.length) erros.push(`Cronograma: etapa "${g.label}" sem percentuais mensais.`);
          else if (Math.abs(soma - 100) > 0.01) erros.push(`Cronograma: etapa "${g.label}" soma ${soma.toLocaleString("pt-BR")}% (deve ser 100%).`);
          ms.parcelas = parcelas;
        }
        macroservicos.push(ms);
      });
    if (!macroservicos.length) erros.push("Planilha Orçamentária sem itens.");
    return { erros: Array.from(new Set(erros)), data: { macroservicos } };
  };

  const exportTransferegov = () => {
    if (!tgModo) return toast.error("Escolha a modalidade de acompanhamento");
    const { erros, data } = buildTransferegov(tgModo);
    if (erros.length) { setTgErros(erros); return; }
    const blob = new Blob([JSON.stringify(data, null, 4)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${orc.nome || "orcamento"}-transferegov-${tgModo}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setTgOpen(false);
    toast.success(`JSON ${tgModo} gerado`);
  };

  const [tgProp, setTgProp] = useState({ nrproposta: "", anoproposta: "", nrmeta: "", nrsubmeta: "" });
  const [tgInfo, setTgInfo] = useState<any>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const consultarFn = useServerFn(consultarPropostaTG);
  const enviarFn = useServerFn(enviarPOTransferegov);
    const consultarProposta = async () => {
    if (!tgProp.nrproposta || !tgProp.anoproposta) return toast.error("Informe número e ano da proposta");
    setTgBusy(true); setTgInfo(null);
    try {
      const r = await consultarFn({ data: { nrproposta: tgProp.nrproposta, anoproposta: tgProp.anoproposta } });
      if (!r.ok) { setTgInfo({ error: `Proposta não encontrada ou sem dados (${r.status}): ${r.mensagem}` }); return; }
      setTgInfo(r);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao consultar"); }
    finally { setTgBusy(false); }
  };
  const enviarTransferegov = async () => {
    if (!tgModo) return toast.error("Escolha a modalidade de acompanhamento");
    if (Object.values(tgProp).some(v => !v)) return toast.error("Preencha proposta, ano, meta e submeta");
    const { erros, data } = buildTransferegov(tgModo);
    if (erros.length) { setTgErros(erros); return; }
    if (!window.confirm(`Enviar a planilha para a proposta ${tgProp.nrproposta}/${tgProp.anoproposta}, meta ${tgProp.nrmeta}, submeta ${tgProp.nrsubmeta}?`)) return;
    setTgBusy(true);
    try {
      const r = await enviarFn({ data: { ...tgProp, payload: data as any } });
      if (r.ok) { toast.success("Planilha enviada ao Transferegov"); setTgOpen(false); }
      else setTgErros([`Transferegov recusou o envio (${r.status}): ${r.mensagem}`]);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao enviar"); }
    finally { setTgBusy(false); }
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
      <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
        <Checkbox checked={somenteProprias} onCheckedChange={(v) => setSomenteProprias(!!v)} />
        <span className="text-sm">No relatório de composições, mostrar somente a fonte PRÓPRIA</span>
      </label>
      <div className="flex gap-3 flex-wrap">
        <Button onClick={exportXlsx}><FileDown className="mr-2 size-4"/>Exportar .xlsx</Button>
        <Button
          variant="outline"
          className="transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          onClick={exportPdf}
        >
          <FileDown className="mr-2 size-4"/>Exportar .pdf
        </Button>
        <Button variant="outline" onClick={()=>{ setTgErros(null); setTgOpen(true); }}><FileDown className="mr-2 size-4"/>JSON Transferegov</Button>
      </div>
      <Dialog open={tgOpen} onOpenChange={setTgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gerar JSON para o Transferegov</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Modalidade de acompanhamento</Label>
              <Select value={tgModo} onValueChange={(v)=>{ setTgModo(v as any); setTgErros(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLE">PLE – Por Eventos</SelectItem>
                  <SelectItem value="BM">BM – Boletim de Medição</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tgModo === "BM" ? "Usa o Cronograma F/F: cada etapa com itens precisa ter percentuais mensais somando 100%."
                  : tgModo === "PLE" ? "Cada serviço é vinculado ao evento da etapa principal."
                  : "Escolha a modalidade antes de gerar o arquivo."}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Nome da frente de obra</Label>
              <Input value={tgFrente} placeholder="FRENTE 1" onChange={e=>setTgFrente(e.target.value)} />
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Envio direto ao Transferegov</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Nº da proposta</Label><Input value={tgProp.nrproposta} onChange={e=>setTgProp({...tgProp,nrproposta:e.target.value.replace(/\D/g,"")})} /></div>
                <div className="space-y-1"><Label>Ano</Label><Input value={tgProp.anoproposta} placeholder="2026" onChange={e=>setTgProp({...tgProp,anoproposta:e.target.value.replace(/\D/g,"")})} /></div>
                <div className="space-y-1"><Label>Nº da meta</Label><Input value={tgProp.nrmeta} onChange={e=>setTgProp({...tgProp,nrmeta:e.target.value.replace(/\D/g,"")})} /></div>
                <div className="space-y-1"><Label>Nº da submeta</Label><Input value={tgProp.nrsubmeta} onChange={e=>setTgProp({...tgProp,nrsubmeta:e.target.value.replace(/\D/g,"")})} /></div>
              </div>
              <Button size="sm" variant="outline" onClick={consultarProposta} disabled={tgBusy}>Consultar proposta</Button>
                            {tgInfo && (
                <div className="mt-4 p-4 bg-green-50/50 border border-green-100 rounded-lg text-sm max-h-80 overflow-y-auto">
                  {tgInfo.error ? (
                    <div className="text-red-600">{tgInfo.error}</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="font-semibold text-green-800">Proposta Encontrada</div>
                      <div className="space-y-1 text-green-900/80">
                        <p><span className="font-medium">Sistema:</span> {tgInfo.sistema}</p>
                        <p><span className="font-medium">Proposta:</span> {tgInfo.proposta}</p>
                      </div>
                      <div className="pt-2 border-t border-green-200/50">
                        <div className="font-medium text-green-800 mb-2">Metas:</div>
                        {tgInfo.metas?.length === 0 ? <p className="text-muted-foreground text-xs">Sem metas cadastradas.</p> : tgInfo.metas?.map((m: any, i: number) => (
                          <div key={i} className="mb-4">
                            <ul className="list-disc pl-4 space-y-2 text-green-900/90">
                              <li>
                                <span className="font-medium">Descrição:</span> {m.descricao}
                                {m.submetas?.map((s: any, j: number) => (
                                  <ul key={j} className="list-circle pl-6 mt-2 space-y-1 text-xs">
                                    <li><span className="font-medium">Submeta:</span> {s.descricao}
                                      <ul className="list-square pl-6 mt-1 space-y-1 text-green-800/80">
                                        <li><span className="font-medium">Regime de Execução de Obras:</span> {s.regimeExecucao || "-"}</li>
                                        <li><span className="font-medium">Número do Lote:</span> {s.numeroLote || "-"}</li>
                                        <li><span className="font-medium">Valor Contrapartida:</span> R$ {s.valorContrapartida}</li>
                                        <li><span className="font-medium">Valor Repasse:</span> R$ {s.valorRepasse}</li>
                                        <li><span className="font-medium">Previsão de Início da Obra:</span> {s.previsaoInicioObra || "-"}</li>
                                        <li><span className="font-medium">Acompanhado por eventos:</span> {s.acompanhamentoPorEventos}</li>
                                        <li><span className="font-medium">Duração da Obra:</span> {s.duracaoObraMeses ? `${s.duracaoObraMeses} meses` : "-"}</li>
                                        <li><span className="font-medium">Data Base:</span> {s.dataBase || "-"}</li>
                                        <li><span className="font-medium">Localidade:</span> {s.ufLocalidade || "-"}</li>
                                        <li><span className="font-medium">Obra Desonerada:</span> {s.obraDesonerada}</li>
                                        <li><span className="font-medium">Submeta via API:</span> {s.submetaViaApi}</li>
                                      </ul>
                                    </li>
                                  </ul>
                                ))}
                              </li>
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {tgErros && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm max-h-60 overflow-auto">
                <p className="font-medium text-destructive mb-1">Corrija antes de gerar ({tgErros.length}):</p>
                <ul className="list-disc pl-5 space-y-0.5">{tgErros.map((e,i)=><li key={i}>{e}</li>)}</ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setTgOpen(false)}>Cancelar</Button>
            <Button variant="outline" onClick={exportTransferegov} disabled={!tgModo || tgBusy}>Baixar JSON</Button>
            <Button onClick={enviarTransferegov} disabled={!tgModo || tgBusy}>{tgBusy ? "Enviando..." : "Enviar ao Transferegov"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



/* ---------- MEMÓRIA DE CÁLCULO ---------- */
function MemoriaTab({ orcId, items, reload }: any) {
  const [etapasExtra] = useEtapasExtra(orcId);
  const etapasExistentes = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i: any) => { if (i.etapa) set.add(i.etapa); });
    etapasExtra.forEach((e: string) => set.add(e));
    return Array.from(set);
  }, [items, etapasExtra]);

  const grouped = useMemo(() => {
    const etapasInfo = etapasExistentes.map(e => ({ etapa: e, label: e, pfx: prefixOf(e) }));
    const etapasPfx = etapasInfo.filter(x => x.pfx).sort((a, b) => b.pfx!.length - a.pfx!.length);
    const etapasOrdenadas = [...etapasInfo].sort((a, b) => {
      if (a.pfx && b.pfx) return cmpCode(a.pfx, b.pfx);
      if (a.pfx) return -1;
      if (b.pfx) return 1;
      return a.label.localeCompare(b.label);
    });
    const map: Record<string, { label: string; list: Item[] }> = {};
    etapasOrdenadas.forEach(e => { map[e.etapa] = { label: e.label, list: [] }; });
    items.forEach((i: any) => {
      const code = (i.item || "").trim();
      const match = etapasPfx.find(({ pfx }) => code === pfx || code.startsWith(pfx + "."));
      const k = match ? match.etapa : "Sem etapa";
      (map[k] ??= { label: "Sem etapa", list: [] }).list.push(i);
    });
    return map;
  }, [items, etapasExistentes]);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border bg-card pb-4">
      
      <table className="w-full text-sm border-collapse">
        <thead className="bg-muted text-muted-foreground border-b">
          <tr>
            <th rowSpan={2} className="p-2 border-r text-left align-middle font-medium w-16">ITEM</th>
            <th rowSpan={2} className="p-2 border-r text-left align-middle font-medium min-w-[200px]">SERVIÇO</th>
            <th rowSpan={2} className="p-2 border-r text-left align-middle font-medium min-w-[150px]">DESCRIÇÃO</th>
            <th rowSpan={2} className="p-2 border-r text-center align-middle font-medium w-12">VEZ</th>
            <th colSpan={6} className="p-1 border-b border-r text-center font-medium">DADOS</th>
            <th colSpan={3} className="p-1 border-b border-r text-center font-medium">RESULTADO</th>
            <th rowSpan={2} className="p-2 border-r text-center align-middle font-medium w-12">UNID</th>
            <th rowSpan={2} className="p-2 text-center align-middle font-medium w-10"></th>
          </tr>
          <tr className="text-xs">
            <th className="p-1 border-r text-center font-medium w-20">X1</th>
            <th className="p-1 border-r text-center font-medium w-20">X2</th>
            <th className="p-1 border-r text-center font-medium w-20">Y1</th>
            <th className="p-1 border-r text-center font-medium w-20">Y2</th>
            <th className="p-1 border-r text-center font-medium w-20">Z1</th>
            <th className="p-1 border-r text-center font-medium w-20">Z2</th>
            <th className="p-1 border-r text-center font-medium w-16">PARCIAL</th>
            <th className="p-1 border-r text-center font-medium w-16">TOTAL</th>
            <th className="p-1 border-r text-center font-medium w-20">GERAL</th>
          </tr>
        </thead>

        <tbody>
          {Object.entries(grouped).filter(([,g]) => g.label !== "Sem etapa" || g.list.length > 0).map(([k, g]) => (
            <React.Fragment key={k}>
              <tr className="bg-muted/50">
                <td colSpan={15} className="p-2 font-semibold text-xs text-muted-foreground uppercase">{g.label}</td>
              </tr>
              {g.list.sort((a,b)=>cmpCode(a.item||'', b.item||'')).map((i: any) => (
                <MemoriaItemRow key={i.id} item={i} reload={reload} />
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemoriaItemRow({ item, reload }: { item: Item; reload: () => void }) {
  const [mems, setMems] = useState<any[]>(item.memoria || []);
  const [saving, setSaving] = useState(false);

  // sync from props
  useEffect(() => { setMems(item.memoria || []); }, [item.memoria]);

  const fDim = (d1: number, d2: number) => {
    if (d1 + d2 === 0) return 1;
    if (d2 !== 0) return (d1 + d2) / 2;
    return d1;
  };

  const memsCalc = mems.map(m => {
    const p = fDim(m.x1, m.x2) * fDim(m.y1, m.y2) * fDim(m.z1, m.z2);
    return { ...m, parcial: p, total: p * m.vez };
  });
  
  const geral = memsCalc.length > 0 ? memsCalc.reduce((a, b) => a + b.total, 0) : item.quantidade;

  const saveToDb = async (newMems: any[]) => {
    setSaving(true);
    const calc = newMems.map(m => {
      const p = fDim(m.x1, m.x2) * fDim(m.y1, m.y2) * fDim(m.z1, m.z2);
      return { ...m, parcial: p, total: p * m.vez };
    });
    const newGeral = calc.length > 0 ? calc.reduce((a, b) => a + b.total, 0) : item.quantidade;
    const { error } = await supabase.from("orcamento_itens").update({ memoria: newMems, quantidade: newGeral }).eq("id", item.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar memória");
    else reload();
  };

  const addMem = () => {
    const n = [...mems, { id: Math.random().toString(36).slice(2), descricao: "", vez: 1, x1: 0, x2: 0, y1: 0, y2: 0, z1: 0, z2: 0 }];
    setMems(n);
    saveToDb(n);
  };

  const updateMem = (id: string, field: string, value: any) => {
    const n = mems.map(m => m.id === id ? { ...m, [field]: value } : m);
    setMems(n);
  };
  
  const commitMem = () => {
    saveToDb(mems);
  };

  const removeMem = (id: string) => {
    const n = mems.filter(m => m.id !== id);
    setMems(n);
    saveToDb(n);
  };

  return (
    <>
      <tr className="border-b hover:bg-muted/20">
        <td className="p-2 border-r font-mono text-xs">{item.item}</td>
        <td colSpan={11} className="p-2 border-r text-xs font-medium bg-muted/5">{item.descricao}</td>
        <td className="p-2 border-r text-center font-bold text-blue-600">{geral.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
        <td className="p-2 border-r text-center text-xs">{item.unidade}</td>
        <td className="p-1 text-center">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={addMem} title="Adicionar Memória" disabled={saving}><Plus className="size-4" /></Button>
        </td>
      </tr>
      {memsCalc.map((m) => (
        <tr key={m.id} className="border-b bg-muted/5">
          <td className="border-r"></td>
          <td colSpan={2} className="p-1 border-r pl-6"><Input className="h-7 text-xs rounded-sm border-transparent hover:border-input focus:border-input w-full" value={m.descricao} onChange={e=>updateMem(m.id, 'descricao', e.target.value)} onBlur={commitMem} placeholder="Descrição do subitem..." /></td>
          <td className="p-1 border-r"><Input type="number" className="h-8 text-sm text-center px-1" value={m.vez} onChange={e=>updateMem(m.id, 'vez', Number(e.target.value))} onBlur={commitMem} /></td>
          <td className="p-1 border-r"><Input type="number" className="h-8 text-sm text-center px-1" value={m.x1} onChange={e=>updateMem(m.id, 'x1', Number(e.target.value))} onBlur={commitMem} /></td>
          <td className="p-1 border-r"><Input type="number" className="h-8 text-sm text-center px-1" value={m.x2} onChange={e=>updateMem(m.id, 'x2', Number(e.target.value))} onBlur={commitMem} /></td>
          <td className="p-1 border-r"><Input type="number" className="h-8 text-sm text-center px-1" value={m.y1} onChange={e=>updateMem(m.id, 'y1', Number(e.target.value))} onBlur={commitMem} /></td>
          <td className="p-1 border-r"><Input type="number" className="h-8 text-sm text-center px-1" value={m.y2} onChange={e=>updateMem(m.id, 'y2', Number(e.target.value))} onBlur={commitMem} /></td>
          <td className="p-1 border-r"><Input type="number" className="h-8 text-sm text-center px-1" value={m.z1} onChange={e=>updateMem(m.id, 'z1', Number(e.target.value))} onBlur={commitMem} /></td>
          <td className="p-1 border-r"><Input type="number" className="h-8 text-sm text-center px-1" value={m.z2} onChange={e=>updateMem(m.id, 'z2', Number(e.target.value))} onBlur={commitMem} /></td>
          <td className="p-2 border-r text-center text-xs font-mono">{m.parcial.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
          <td className="p-2 border-r text-center text-xs font-mono font-medium text-blue-600">{m.total.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
          <td colSpan={2} className="border-r"></td>
          <td className="p-1 text-center">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={()=>removeMem(m.id)}><Trash2 className="size-3" /></Button>
          </td>
        </tr>
      ))}
    </>
  );
}


/* ---------- CURVA ABC ---------- */
function CurvaABCTab({ orcId, items, bdiPct }: any) {
  const bdiMult = 1 + bdiPct;

  const { abcItems, totalGeral } = useMemo(() => {
    // 1. Agrupar itens idênticos (mesmo código ou mesma descrição) para não repetir
    const map = new Map<string, any>();
    
    items.filter((i: any) => i.quantidade > 0 && i.preco_unitario > 0).forEach((i: any) => {
      // Usa o código se tiver, senão usa a descrição como chave de agrupamento
      const key = (i.codigo || i.descricao).trim().toUpperCase();
      
      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantidade += Number(i.quantidade);
      } else {
        map.set(key, { ...i, quantidade: Number(i.quantidade) });
      }
    });

    // 2. Calcular totais com BDI
    const list = Array.from(map.values()).map((i: any) => {
      const precoCBdi = i.preco_unitario * bdiMult;
      const total = i.quantidade * precoCBdi;
      return { ...i, precoCBdi, total };
    });

    // 3. Ordenar do maior para o menor custo total
    list.sort((a: any, b: any) => b.total - a.total);

    // 4. Calcular pesos e acumulados
    const totalOrcamento = list.reduce((sum: number, i: any) => sum + i.total, 0);

    let acumulado = 0;
    const abc = list.map((i: any, index: number) => {
      const peso = (i.total / totalOrcamento) * 100;
      acumulado += peso;
      return { ...i, position: index + 1, peso, acumulado };
    });

    return { abcItems: abc, totalGeral: totalOrcamento };
  }, [items, bdiPct, bdiMult]);

  if (abcItems.length === 0) {
    return <div className="mt-4 p-8 text-center text-muted-foreground border border-dashed rounded-lg">Adicione itens na Planilha Orçamentária para gerar a Curva ABC.</div>;
  }

  // Prepara dados para o gráfico
  // Limitamos aos Top 20 ou até atingir 80% (o que vier primeiro, mas garantindo pelo menos alguns) para o gráfico não ficar ilegível
  // Pega itens da faixa A (até 80%) ou os Top 5, o que for maior, mas limitado a 30 para não estourar a tela
  let chartItems = abcItems.filter((i: any) => i.acumulado <= 80);
  if (chartItems.length === 0 && abcItems.length > 0) chartItems = [abcItems[0]]; // Garante ao menos 1
  if (chartItems.length < 5 && abcItems.length > chartItems.length) chartItems = abcItems.slice(0, 5);
  if (abcItems.length > 0 && chartItems.length === 1 && abcItems.length > 1) chartItems = abcItems.slice(0, Math.min(5, abcItems.length)); // Se só 1 bateu 80%, mas tem mais itens, força mostrar eles no gráfico
  if (chartItems.length > 30) chartItems = chartItems.slice(0, 30);

  const maxVal = chartItems.length > 0 ? chartItems[0].total : 1;

  return (
    <div className="mt-4 space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold mb-4 text-lg text-slate-800">Gráfico Pareto (Itens mais representativos)</h3>
        <div className="h-64 flex items-end gap-2 pb-6 relative pt-10 border-b border-l px-2 mx-16">
          {/* Grid lines */}
          <div className="absolute top-0 left-0 w-full border-t border-dashed border-slate-200"></div>
          <div className="absolute top-1/4 left-0 w-full border-t border-dashed border-slate-200"></div>
          <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-slate-200"></div>
          <div className="absolute top-3/4 left-0 w-full border-t border-dashed border-slate-200"></div>
          
          {/* Eixo Y esquerdo (Valores) */}
          <div className="absolute -left-20 bottom-0 top-0 flex flex-col justify-between text-[10px] text-muted-foreground pb-6">
            <span>{fmtBRL(maxVal)}</span>
            <span>{fmtBRL(maxVal * 0.75)}</span>
            <span>{fmtBRL(maxVal * 0.5)}</span>
            <span>{fmtBRL(maxVal * 0.25)}</span>
            <span>R$ 0</span>
          </div>

          {/* Eixo Y direito (%) */}
          <div className="absolute -right-10 bottom-0 top-0 flex flex-col justify-between text-[10px] text-blue-600 font-medium pb-6 text-right">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          {chartItems.map((i: any, idx: number) => {
            const hPct = (i.total / maxVal) * 100;
            const lineY = 100 - i.acumulado;
            return (
              <div key={i.id} className="relative flex-1 flex flex-col justify-end group h-full z-10">
                <div className="bg-slate-300 hover:bg-slate-400 transition-colors w-full rounded-t-sm" style={{ height: `${Math.max(0, Math.min(100, hPct))}%`, minHeight: '1px' }}></div>
                <div className="absolute -bottom-5 w-full text-center text-[10px] text-muted-foreground truncate" title={`Item ${i.position}`}>{i.position}</div>
                {/* Linha de acumulado (aproximação visual) */}
                <div className="absolute w-2 h-2 rounded-full bg-blue-600 left-1/2 -translate-x-1/2 z-20 shadow-[0_0_0_2px_white]" style={{ top: `${lineY}%` }}></div>
                {idx < chartItems.length - 1 && (
                  <svg className="absolute w-[calc(100%+8px)] h-full overflow-visible left-1/2 top-0 pointer-events-none z-10">
                    <line x1="0" y1={`${lineY}%`} x2="100%" y2={`${100 - chartItems[idx+1].acumulado}%`} stroke="#2563eb" strokeWidth="2" />
                  </svg>
                )}
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-xl z-50 pointer-events-none">
                  <div className="font-bold mb-1">Item {i.position}</div>
                  <div className="truncate mb-1">{i.descricao}</div>
                  <div className="flex justify-between text-blue-200"><span>Total:</span> <span>{fmtBRL(i.total)}</span></div>
                  <div className="flex justify-between text-blue-200"><span>Peso:</span> <span>{i.peso.toFixed(2)}%</span></div>
                  <div className="flex justify-between font-bold text-white border-t border-slate-600 mt-1 pt-1"><span>Acumulado:</span> <span>{i.acumulado.toFixed(2)}%</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="budget-table min-w-[1000px]">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="w-12 text-center">Item</th>
                <th>Código</th>
                <th className="min-w-[300px]">Descrição</th>
                <th className="text-center">Und</th>
                <th className="num">Qtd</th>
                <th className="num">Preço Unit S/BDI</th>
                <th className="num">Preço Unit C/BDI</th>
                <th className="num">Total</th>
                <th className="num">Peso %</th>
                <th className="num">Peso Acum</th>
              </tr>
            </thead>
            <tbody>
              {abcItems.map((i: any) => {
                // Destacar faixas (A: 0-80%, B: 80-95%, C: 95-100%)
                const isA = i.acumulado <= 80;
                const isB = !isA && i.acumulado <= 95;
                const rowClass = isA ? "" : isB ? "text-slate-600" : "text-slate-400";
                
                return (
                  <tr key={i.id} className={`hover:bg-muted/30 ${rowClass}`}>
                    <td className="text-center font-medium">{i.position}</td>
                    <td className="font-mono text-xs">{i.fonte} - {i.codigo}</td>
                    <td className="text-xs">{i.descricao}</td>
                    <td className="text-center">{i.unidade}</td>
                    <td className="num">{i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td className="num">{fmtBRL(i.preco_unitario)}</td>
                    <td className="num font-medium">{fmtBRL(i.precoCBdi)}</td>
                    <td className="num font-bold text-slate-800">{fmtBRL(i.total)}</td>
                    <td className="num">{i.peso.toFixed(2)}%</td>
                    <td className="num font-medium text-blue-700">{i.acumulado.toFixed(2)}%</td>
                  </tr>
                );
              })}
              <tr className="bg-primary/10 font-bold text-sm">
                <td colSpan={7} className="text-right py-3 pr-4">TOTAL GERAL CURVA ABC</td>
                <td className="num text-primary">{fmtBRL(totalGeral)}</td>
                <td className="num text-primary">100%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

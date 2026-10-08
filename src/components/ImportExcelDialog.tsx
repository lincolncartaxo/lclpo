import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtNum } from "@/lib/format";

const FONTES = ["SINAPI","SBC","SICRO3","SICRO2","ORSE","SEDOP","SEINFRA","SETOP","IOPES","SIURB","SIURB INFRA","SUDECAP","CPOS","FDE","AGESUL","AGETOP CIVIL","AGETOP RODOVIARIA","CAEMA","EMBASA","CAERN","COMPESA","EMOP","DERPR","SCO","DER","PRÓPRIA"];

type Row = {
  linha: number; item: string; codigo: string; fonte: string; descricao: string; unidade: string;
  quantidade: number; precoPlanilha: number; precoBase: number | null; descBase: string | null;
  fonteBase: string | null; etapa: boolean;
};

const colIdx = (l: string) => { const s = l.trim().toUpperCase(); return s ? XLSX.utils.decode_col(s) : -1; };
const num = (v: any) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};

export function ImportExcelDialog({ orcId, regime, uf, mesRef, nextOrdem, onImported, onEtapas }: {
  orcId: string; regime: string; uf: string | null; mesRef: string | null; nextOrdem: number;
  onImported: () => void; onEtapas: (nomes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState("");
  const [comPrecos, setComPrecos] = useState(false);
  const [fontes, setFontes] = useState<string[]>(["SINAPI"]);
  const [ini, setIni] = useState("1");
  const [fim, setFim] = useState("20");
  const [cols, setCols] = useState({ item: "A", codigo: "B", fonte: "C", descricao: "D", unidade: "E", quantidade: "F", preco: "G" });
  const [usarDesc, setUsarDesc] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const ufUse = (uf && uf.trim()) || "PB";

  const reset = () => { setStep(1); setWb(null); setFileName(""); setSheet(""); setRows([]); };

  const onFile = async (f?: File) => {
    if (!f) return;
    const w = XLSX.read(await f.arrayBuffer(), { type: "array" });
    setWb(w); setFileName(f.name); setSheet(w.SheetNames[0] ?? "");
    const ref = w.Sheets[w.SheetNames[0]]?.["!ref"];
    if (ref) setFim(String(XLSX.utils.decode_range(ref).e.r + 1));
  };

  const next1 = () => {
    if (!wb || !sheet) return toast.error("Selecione o arquivo e a planilha");
    if (!fontes.length) return toast.error("Selecione ao menos uma fonte");
    const a = parseInt(ini), b = parseInt(fim);
    if (!(a >= 1 && b >= a)) return toast.error("Linhas inválidas");
    setStep(2);
  };

  const next2 = async () => {
    const req = ["item", "codigo", "descricao", "quantidade"] as const;
    if (req.some(k => colIdx(cols[k]) < 0)) return toast.error("Preencha as colunas obrigatórias");
    if (comPrecos && colIdx(cols.preco) < 0) return toast.error("Informe a coluna do preço");
    setBusy(true);
    try {
      const ws = wb!.Sheets[sheet];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
      const get = (r: any[], k: keyof typeof cols) => { const i = colIdx(cols[k]); return i < 0 ? "" : r[i]; };
      const parsed: Row[] = [];
      for (let ln = parseInt(ini); ln <= parseInt(fim); ln++) {
        const r = data[ln - 1]; if (!r) continue;
        const item = String(get(r, "item") ?? "").trim();
        const codigo = String(get(r, "codigo") ?? "").trim();
        const descricao = String(get(r, "descricao") ?? "").trim();
        if (!item && !codigo && !descricao) continue;
        const quantidade = num(get(r, "quantidade"));
        const etapa = !codigo && !quantidade;
        parsed.push({
          linha: ln, item, codigo, descricao, etapa, quantidade,
          fonte: String(get(r, "fonte") ?? "").trim().toUpperCase(),
          unidade: String(get(r, "unidade") ?? "").trim(),
          precoPlanilha: comPrecos ? num(get(r, "preco")) : 0,
          precoBase: null, descBase: null, fonteBase: null,
        });
      }
      if (!parsed.length) { setBusy(false); return toast.error("Nenhuma linha encontrada no intervalo"); }

      if (!comPrecos) {
        const codes = Array.from(new Set(parsed.filter(p => p.codigo).map(p => p.codigo)));
        const comps: any[] = [], ins: any[] = [];
        for (let i = 0; i < codes.length; i += 200) {
          const ch = codes.slice(i, i + 200);
          const [{ data: c }, { data: s }] = await Promise.all([
            supabase.from("base_composicoes").select("fonte,codigo,descricao,unidade").in("codigo", ch).in("fonte", fontes),
            supabase.from("base_insumos").select("fonte,codigo,descricao,unidade,preco_desonerado,preco_nao_desonerado,mes_ref")
              .in("codigo", ch).in("fonte", fontes).eq("uf", ufUse).order("mes_ref", { ascending: false }),
          ]);
          comps.push(...(c ?? [])); ins.push(...(s ?? []));
        }
        const cache = new Map<string, number>();
        for (const p of parsed) {
          if (!p.codigo) continue;
          const pref = (list: any[]) => list.find(x => x.codigo === p.codigo && (!p.fonte || x.fonte === p.fonte))
            ?? list.find(x => x.codigo === p.codigo);
          const c = pref(comps);
          if (c) {
            const k = `${c.fonte}|${c.codigo}`;
            if (!cache.has(k)) {
              const { data } = await supabase.rpc("calcular_custo_composicao", {
                p_fonte: c.fonte, p_codigo: c.codigo, p_uf: ufUse, p_mes_ref: mesRef ?? "", p_regime: regime,
              });
              cache.set(k, Number(data ?? 0));
            }
            Object.assign(p, { precoBase: cache.get(k)!, descBase: c.descricao, fonteBase: c.fonte, unidade: p.unidade || c.unidade || "" });
            continue;
          }
          const list = mesRef ? ins.filter(x => String(x.mes_ref).startsWith(mesRef.slice(0, 7))) : ins;
          const s = pref(list);
          if (s) Object.assign(p, {
            precoBase: Number((regime === "desonerado" ? s.preco_desonerado : s.preco_nao_desonerado) ?? 0),
            descBase: s.descricao, fonteBase: s.fonte, unidade: p.unidade || s.unidade || "",
          });
        }
      }
      setRows(parsed); setStep(3);
    } catch (e: any) { toast.error(e.message ?? "Erro ao ler planilha"); }
    setBusy(false);
  };

  const concluir = async () => {
    setBusy(true);
    const etapas = rows.filter(r => r.etapa).map(r => r.item ? `${r.item} - ${r.descricao}` : r.descricao);
    const itens = rows.filter(r => !r.etapa).map((r, i) => {
      const achou = !comPrecos && r.fonteBase;
      return {
        orcamento_id: orcId, ordem: nextOrdem + i, etapa: null, item: r.item || null,
        fonte: comPrecos ? (r.fonte || "PLANILHA") : (r.fonteBase ?? (r.fonte || "COMP")),
        codigo: r.codigo || null,
        descricao: achou && !usarDesc ? r.descBase! : (r.descricao || r.descBase || "(sem descrição)"),
        unidade: r.unidade || null, quantidade: r.quantidade,
        preco_unitario: comPrecos ? r.precoPlanilha : (r.precoBase ?? 0),
      };
    });
    for (let i = 0; i < itens.length; i += 500) {
      const { error } = await supabase.from("orcamento_itens").insert(itens.slice(i, i + 500));
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    if (etapas.length) onEtapas(etapas);
    const semPreco = itens.filter(i => !i.preco_unitario).length;
    toast.success(`${itens.length} itens e ${etapas.length} etapas importados${semPreco ? ` · ${semPreco} sem preço` : ""}`);
    setBusy(false); setOpen(false); reset(); onImported();
  };

  const Steps = () => (
    <div className="grid grid-cols-3 rounded-md overflow-hidden bg-primary text-primary-foreground text-xs">
      {["Informações do arquivo", "Seleção de colunas", "Comparação de preços"].map((t, i) => (
        <div key={t} className={`px-3 py-2 ${step === i + 1 ? "" : "opacity-50"}`}>
          <div className="text-sm font-medium">Passo {i + 1}</div><div className="uppercase">{t}</div>
        </div>
      ))}
    </div>
  );

  const colField = (k: keyof typeof cols, label: string, req = true) => (
    <div className="grid grid-cols-[1fr_120px] items-center gap-3">
      <Label>Letra da coluna {label}{req && " *"}</Label>
      <Input value={cols[k]} onChange={e => setCols({ ...cols, [k]: e.target.value.toUpperCase() })} placeholder={req ? "" : "Opcional"} />
    </div>
  );

  const nEncontrados = rows.filter(r => !r.etapa && r.fonteBase).length;
  const nItens = rows.filter(r => !r.etapa).length;

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild><Button variant="outline"><FileSpreadsheet className="mr-2 size-4" />Importar Excel</Button></DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação do Excel</DialogTitle>
          <DialogDescription>Passo a passo de importação de itens de um arquivo do Excel</DialogDescription>
        </DialogHeader>
        <Steps />

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Arquivo *</Label><Input type="file" accept=".xlsx,.xls,.xlsm" onChange={e => onFile(e.target.files?.[0])} />
                {fileName && <p className="text-xs text-muted-foreground mt-1">{fileName}</p>}</div>
              <div><Label>Planilha (aba) *</Label>
                <Select value={sheet} onValueChange={setSheet} disabled={!wb}>
                  <SelectTrigger><SelectValue placeholder="Selecione a aba" /></SelectTrigger>
                  <SelectContent className="max-h-72">{wb?.SheetNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={comPrecos} onCheckedChange={v => setComPrecos(!!v)} />
              Importar com preços da planilha (os preços não serão buscados nas bases)
            </label>
            <div>
              <Label>Quais fontes estão presentes neste arquivo?</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {FONTES.map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={fontes.includes(f)} onCheckedChange={v => setFontes(v ? [...fontes, f] : fontes.filter(x => x !== f))} />{f}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div><Label>Linha do primeiro item *</Label><Input type="number" value={ini} onChange={e => setIni(e.target.value)} /></div>
              <div><Label>Linha do último item *</Label><Input type="number" value={fim} onChange={e => setFim(e.target.value)} /></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 max-w-lg">
            {colField("item", "de Itemização")}
            {colField("codigo", "do Código")}
            {colField("fonte", "da Fonte", false)}
            {colField("descricao", "da Descrição")}
            {colField("unidade", "da Unidade", false)}
            {colField("quantidade", "da Quantidade")}
            {comPrecos && colField("preco", "do Preço Unitário")}
            {!comPrecos && (
              <label className="flex items-center gap-2 text-sm pt-2">
                <Checkbox checked={usarDesc} onCheckedChange={v => setUsarDesc(!!v)} />Utilizar descrições do arquivo nas composições
              </label>
            )}
            <p className="text-xs text-muted-foreground">Linhas sem código e sem quantidade são importadas como etapas.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {nItens} itens · {rows.length - nItens} etapas
              {!comPrecos && ` · ${nEncontrados} encontrados nas bases (${ufUse}${mesRef ? " " + mesRef.slice(5, 7) + "/" + mesRef.slice(0, 4) : ""})`}
            </p>
            <div className="overflow-auto max-h-[50vh] border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0"><tr>
                  <th className="p-1 text-left">Linha</th><th className="p-1 text-left">Item</th><th className="p-1 text-left">Fonte</th>
                  <th className="p-1 text-left">Código</th><th className="p-1 text-left">Descrição</th><th className="p-1 text-right">Quant.</th>
                  <th className="p-1 text-right">{comPrecos ? "Preço planilha" : "Preço base"}</th>
                </tr></thead>
                <tbody>{rows.map(r => (
                  <tr key={r.linha} className={`border-t ${r.etapa ? "font-semibold bg-muted/40" : !comPrecos && !r.fonteBase ? "text-destructive" : ""}`}>
                    <td className="p-1">{r.linha}</td><td className="p-1">{r.item}</td>
                    <td className="p-1">{r.etapa ? "ETAPA" : comPrecos ? r.fonte : (r.fonteBase ?? "não encontrado")}</td>
                    <td className="p-1">{r.codigo}</td><td className="p-1 max-w-xs truncate">{r.descricao || r.descBase}</td>
                    <td className="p-1 text-right">{r.etapa ? "" : fmtNum(r.quantidade)}</td>
                    <td className="p-1 text-right">{r.etapa ? "" : fmtBRL(comPrecos ? r.precoPlanilha : r.precoBase)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={step === 1 || busy} onClick={() => setStep(step - 1)}>« Anterior</Button>
          {step === 1 && <Button onClick={next1}>Próximo »</Button>}
          {step === 2 && <Button onClick={next2} disabled={busy}>{busy ? "Buscando preços..." : "Próximo »"}</Button>}
          {step === 3 && <Button onClick={concluir} disabled={busy}>{busy ? "Importando..." : "Concluir"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

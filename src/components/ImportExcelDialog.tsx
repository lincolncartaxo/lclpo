import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtNum } from "@/lib/format";

type Cell = string | number | boolean | null | undefined;
type SheetRow = Cell[];
type DbRow = Record<string, unknown>;
type Row = {
  linha: number;
  item: string;
  codigo: string;
  fonte: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoPlanilha: number;
  precoBase: number | null;
  descBase: string | null;
  fonteBase: string | null;
  etapa: boolean;
  etapaNome: string | null;
};
type Props = {
  orcId: string;
  regime: string;
  uf: string | null;
  mesRef: string | null;
  nextOrdem: number;
  onImported: () => void;
  onEtapas: (nomes: string[]) => void;
};

const colIdx = (letter: string) => {
  const value = letter.trim().toUpperCase();
  return value ? XLSX.utils.decode_col(value) : -1;
};
const text = (value: unknown) => String(value ?? "").trim();
const num = (value: Cell) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const valueText = text(value).replace(/\s/g, "");
  if (!valueText) return 0;
  const parsed = Number(
    valueText.includes(",") ? valueText.replace(/\./g, "").replace(",", ".") : valueText,
  );
  return Number.isFinite(parsed) ? parsed : 0;
};
const unique = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
const isHierarchicalLabel = (value: string) => /^\d+(?:\.\d+)*$/.test(value.trim());
// Supabase ainda não possui as tabelas comerciais no tipo gerado.

const db = supabase as any;

export function ImportExcelDialog({
  orcId,
  regime,
  uf,
  mesRef,
  nextOrdem,
  onImported,
  onEtapas,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState("");
  const [comPrecos, setComPrecos] = useState(false);
  const [fontesDisponiveis, setFontesDisponiveis] = useState<string[]>([]);
  const [fontes, setFontes] = useState<string[]>([]);
  const [ini, setIni] = useState("1");
  const [fim, setFim] = useState("20");
  const [cols, setCols] = useState({
    item: "A",
    codigo: "B",
    fonte: "C",
    descricao: "D",
    unidade: "E",
    quantidade: "F",
    preco: "G",
  });
  const [usarDesc, setUsarDesc] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const ufUse = uf?.trim().toUpperCase() || "";
  const mesUse = mesRef?.slice(0, 7) || "";
  const regimeLabel = regime === "desonerado" ? "Desonerado" : "Não desonerado";

  const reset = () => {
    setStep(1);
    setWb(null);
    setFileName("");
    setSheet("");
    setRows([]);
  };

  useEffect(() => {
    if (!open || !ufUse) return;
    let cancelled = false;
    (async () => {
      const [insumos, composicoes, precosComposicoes] = await Promise.all([
        db.from("precos_historicos_insumos").select("fonte").in("uf", [ufUse, "BR"]).limit(10000),
        db.from("catalogo_composicoes").select("fonte").limit(10000),
        db
          .from("precos_historicos_composicoes")
          .select("fonte")
          .in("uf", [ufUse, "BR"])
          .limit(10000),
      ]);
      const sources = unique([
        ...(insumos.data ?? []).map((row: DbRow) => text(row.fonte).toUpperCase()),
        ...(composicoes.data ?? []).map((row: DbRow) => text(row.fonte).toUpperCase()),
        ...(precosComposicoes.data ?? []).map((row: DbRow) => text(row.fonte).toUpperCase()),
      ]);
      if (!cancelled) {
        setFontesDisponiveis(sources);
        // A fonte varia por item; todas as fontes válidas da base ficam disponíveis.
        setFontes(sources);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, ufUse]);

  const onFile = async (file?: File) => {
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    setWb(workbook);
    setFileName(file.name);
    setSheet(workbook.SheetNames[0] ?? "");
    const range = workbook.Sheets[workbook.SheetNames[0]]?.["!ref"];
    if (range) setFim(String(XLSX.utils.decode_range(range).e.r + 1));
  };

  const next1 = () => {
    if (!wb || !sheet) return toast.error("Selecione o arquivo e a planilha");
    if (!ufUse) return toast.error("Defina a UF do orçamento antes de importar");
    if (!comPrecos && !mesUse)
      return toast.error("Defina a Data Base do orçamento antes de buscar preços");
    if (!comPrecos && !fontes.length)
      return toast.error("Nenhuma fonte disponível foi selecionada");
    const start = Number.parseInt(ini, 10);
    const end = Number.parseInt(fim, 10);
    if (!(start >= 1 && end >= start)) return toast.error("Linhas inválidas");
    setStep(2);
  };

  const resolvePrices = async (parsed: Row[]) => {
    const codes = unique(parsed.filter((row) => !row.etapa && row.codigo).map((row) => row.codigo));
    const [compositions, supplies] = await Promise.all([
      db
        .from("catalogo_composicoes")
        .select("fonte,codigo,descricao,unidade")
        .in("codigo", codes)
        .in("fonte", fontes),
      db
        .from("precos_historicos_insumos")
        .select(
          "fonte,codigo_insumo,preco_desonerado,preco_nao_desonerado,mes_ref,uf,catalogo_insumos!inner(descricao,unidade)",
        )
        .in("codigo_insumo", codes)
        .in("fonte", fontes)
        .in("uf", [ufUse, "BR"])
        .eq("mes_ref", mesUse),
    ]);
    if (compositions.error) throw new Error(compositions.error.message);
    if (supplies.error) throw new Error(supplies.error.message);
    const compositionRows = (compositions.data ?? []) as DbRow[];
    const supplyRows = (supplies.data ?? []) as DbRow[];
    const costs = new Map<string, number>();
    const findExact = (row: Row, list: DbRow[], codeKey: string) =>
      list.find(
        (candidate) =>
          text(candidate[codeKey]) === row.codigo &&
          text(candidate.fonte).toUpperCase() === row.fonte,
      );
    for (const row of parsed) {
      if (row.etapa || !row.codigo) continue;
      const composition = findExact(row, compositionRows, "codigo");
      if (composition) {
        const key = `${text(composition.fonte)}|${text(composition.codigo)}`;
        if (!costs.has(key)) {
          const { data, error } = await db.rpc("calcular_custo_composicao", {
            p_fonte: text(composition.fonte),
            p_codigo: text(composition.codigo),
            p_uf: ufUse,
            p_mes_ref: mesUse,
            p_regime: regime,
          });
          if (error) throw new Error(`Erro ao calcular ${key}: ${error.message}`);
          costs.set(key, Number(data ?? 0));
        }
        row.precoBase = costs.get(key) ?? 0;
        row.descBase = text(composition.descricao) || null;
        row.fonteBase = text(composition.fonte);
        row.unidade = row.unidade || text(composition.unidade);
        continue;
      }
      const supply = findExact(row, supplyRows, "codigo_insumo");
      if (supply) {
        const catalog = (supply.catalogo_insumos ?? {}) as DbRow;
        row.precoBase = Number(
          supply[regime === "desonerado" ? "preco_desonerado" : "preco_nao_desonerado"] ?? 0,
        );
        row.descBase = text(catalog.descricao) || null;
        row.fonteBase = text(supply.fonte);
        row.unidade = row.unidade || text(catalog.unidade);
      }
    }
  };

  const next2 = async () => {
    const required = ["item", "codigo", "fonte", "descricao", "quantidade"] as const;
    if (required.some((key) => colIdx(cols[key]) < 0))
      return toast.error("Preencha as colunas obrigatórias");
    if (comPrecos && colIdx(cols.preco) < 0) return toast.error("Informe a coluna do preço");
    setBusy(true);
    try {
      const data = XLSX.utils.sheet_to_json<SheetRow>(wb!.Sheets[sheet], {
        header: 1,
        raw: true,
        defval: "",
      });
      const get = (row: SheetRow, key: keyof typeof cols): Cell => {
        const index = colIdx(cols[key]);
        return index < 0 ? "" : row[index];
      };
      const parsed: Row[] = [];
      let currentStage: string | null = null;
      for (let line = Number.parseInt(ini, 10); line <= Number.parseInt(fim, 10); line += 1) {
        const row = data[line - 1];
        if (!row) continue;
        const item = text(get(row, "item"));
        const codigo = text(get(row, "codigo"));
        const descricao = text(get(row, "descricao"));
        const quantidade = num(get(row, "quantidade"));
        const fonte = text(get(row, "fonte")).toUpperCase();
        if (!item && !codigo && !descricao) continue;
        // Etapas normalmente não possuem Fonte. Algumas planilhas, porém,
        // trazem código hierárquico e/ou um valor calculado na coluna de
        // quantidade para a etapa. A Fonte só é obrigatória em linhas que
        // realmente representam itens precificados.
        const etapa = !fonte && (
          !codigo ||
          quantidade === 0 ||
          isHierarchicalLabel(item) ||
          isHierarchicalLabel(codigo)
        );
        const etapaNome: string | null = etapa
          ? [item, descricao].filter(Boolean).join(" - ")
          : currentStage;
        if (etapa) currentStage = etapaNome || null;
        parsed.push({
          linha: line,
          item,
          codigo,
          descricao,
          etapa,
          etapaNome,
          quantidade,
          fonte,
          unidade: text(get(row, "unidade")),
          precoPlanilha: comPrecos ? num(get(row, "preco")) : 0,
          precoBase: null,
          descBase: null,
          fonteBase: null,
        });
      }
      if (!parsed.length) return toast.error("Nenhuma linha encontrada no intervalo");
      const missingSource = parsed.filter((row) => !row.etapa && !row.fonte);
      if (missingSource.length) {
        const lines = missingSource.slice(0, 8).map((row) => row.linha).join(", ");
        const suffix = missingSource.length > 8 ? ` e mais ${missingSource.length - 8}` : "";
        return toast.error(`Informe a Fonte nas linhas de itens ${lines}${suffix}`);
      }
      if (!comPrecos) await resolvePrices(parsed);
      setRows(parsed);
      setStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao ler planilha");
    } finally {
      setBusy(false);
    }
  };

  const concluir = async () => {
    setBusy(true);
    const stages = unique(
      rows.filter((row) => row.etapa && row.etapaNome).map((row) => row.etapaNome!),
    );
    const items = rows
      .filter((row) => !row.etapa)
      .map((row, index) => ({
        orcamento_id: orcId,
        ordem: nextOrdem + index,
        etapa: row.etapaNome,
        item: row.item || null,
        fonte: comPrecos ? row.fonte || "PLANILHA" : (row.fonteBase ?? row.fonte) || "COMP",
        codigo: row.codigo || null,
        descricao:
          !comPrecos && row.fonteBase && !usarDesc
            ? row.descBase!
            : row.descricao || row.descBase || "(sem descrição)",
        unidade: row.unidade || null,
        quantidade: row.quantidade,
        preco_unitario: comPrecos ? row.precoPlanilha : (row.precoBase ?? 0),
      }));
    try {
      for (let index = 0; index < items.length; index += 500) {
        const { error } = await db.from("orcamento_itens").insert(items.slice(index, index + 500));
        if (error) throw new Error(error.message);
      }
      if (stages.length) onEtapas(stages);
      const withoutPrice = items.filter((item) => !item.preco_unitario).length;
      toast.success(
        `${items.length} itens e ${stages.length} etapas importados${withoutPrice ? ` · ${withoutPrice} sem preço` : ""}`,
      );
      setOpen(false);
      reset();
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao importar itens");
    } finally {
      setBusy(false);
    }
  };

  const colField = (key: keyof typeof cols, label: string, required = true) => (
    <div className="grid grid-cols-[1fr_120px] items-center gap-3" key={key}>
      <Label>
        Letra da coluna {label}
        {required && " *"}
      </Label>
      <Input
        value={cols[key]}
        onChange={(event) => setCols({ ...cols, [key]: event.target.value.toUpperCase() })}
        placeholder={required ? "" : "Opcional"}
      />
    </div>
  );
  const nItems = rows.filter((row) => !row.etapa).length;
  const nFound = rows.filter((row) => !row.etapa && row.fonteBase).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 size-4" />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação do Excel</DialogTitle>
          <DialogDescription>
            Importe etapas, itens, quantidades e preços do orçamento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 rounded-md overflow-hidden bg-primary text-primary-foreground text-xs">
          {["Informações do arquivo", "Seleção de colunas", "Comparação de preços"].map(
            (label, index) => (
              <div key={label} className={`px-3 py-2 ${step === index + 1 ? "" : "opacity-50"}`}>
                <div className="text-sm font-medium">Passo {index + 1}</div>
                <div className="uppercase">{label}</div>
              </div>
            ),
          )}
        </div>
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Arquivo *</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  onChange={(event) => onFile(event.target.files?.[0])}
                />
                {fileName && <p className="text-xs text-muted-foreground mt-1">{fileName}</p>}
              </div>
              <div>
                <Label>Planilha (aba) *</Label>
                <Select value={sheet} onValueChange={setSheet} disabled={!wb}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a aba" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {wb?.SheetNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={comPrecos} onCheckedChange={(value) => setComPrecos(!!value)} />
              Importar com preços da planilha (ignora a busca na base)
            </label>
            {!comPrecos && (
              <div>
                <Label>Fontes disponíveis para esta UF</Label>
                {!fontesDisponiveis.length ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Nenhuma fonte possui preços para a UF selecionada.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {fontesDisponiveis.map((source) => (
                      <label key={source} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fontes.includes(source)}
                          onCheckedChange={(value) =>
                            setFontes(
                              value
                                ? [...fontes, source]
                                : fontes.filter((item) => item !== source),
                            )
                          }
                        />
                        {source}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="rounded border bg-muted/30 p-3 text-xs">
              Base do orçamento: <strong>{ufUse || "UF não definida"}</strong> ·{" "}
              <strong>{mesUse || "Data Base não definida"}</strong> · <strong>{regimeLabel}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div>
                <Label>Linha do primeiro item *</Label>
                <Input type="number" value={ini} onChange={(event) => setIni(event.target.value)} />
              </div>
              <div>
                <Label>Linha do último item *</Label>
                <Input type="number" value={fim} onChange={(event) => setFim(event.target.value)} />
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3 max-w-lg">
            {colField("item", "de Itemização")}
            {colField("codigo", "do Código")}
            {colField("fonte", "da Fonte")}
            {colField("descricao", "da Descrição")}
            {colField("unidade", "da Unidade", false)}
            {colField("quantidade", "da Quantidade")}
            {comPrecos && colField("preco", "do Preço Unitário")}
            {!comPrecos && (
              <label className="flex items-center gap-2 text-sm pt-2">
                <Checkbox checked={usarDesc} onCheckedChange={(value) => setUsarDesc(!!value)} />
                Utilizar descrições do arquivo nas composições
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              Linhas sem quantidade são detectadas como etapas e os itens seguintes são vinculados à
              etapa anterior.
            </p>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {nItems} itens · {rows.length - nItems} etapas
              {!comPrecos &&
                ` · ${nFound} encontrados nas bases (${ufUse} ${mesUse} · ${regimeLabel})`}
            </p>
            <div className="overflow-auto max-h-[50vh] border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-1 text-left">Linha</th>
                    <th className="p-1 text-left">Item</th>
                    <th className="p-1 text-left">Etapa/Fonte</th>
                    <th className="p-1 text-left">Código</th>
                    <th className="p-1 text-left">Descrição</th>
                    <th className="p-1 text-right">Quant.</th>
                    <th className="p-1 text-right">
                      {comPrecos ? "Preço planilha" : "Preço base"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.linha}
                      className={`border-t ${row.etapa ? "font-semibold bg-muted/40" : !comPrecos && !row.fonteBase ? "text-destructive" : ""}`}
                    >
                      <td className="p-1">{row.linha}</td>
                      <td className="p-1">{row.item}</td>
                      <td className="p-1">
                        {row.etapa
                          ? "ETAPA"
                          : comPrecos
                            ? row.fonte
                            : (row.fonteBase ?? "não encontrado")}
                      </td>
                      <td className="p-1">{row.codigo}</td>
                      <td className="p-1 max-w-xs truncate">{row.descricao || row.descBase}</td>
                      <td className="p-1 text-right">{row.etapa ? "" : fmtNum(row.quantidade)}</td>
                      <td className="p-1 text-right">
                        {row.etapa ? "" : fmtBRL(comPrecos ? row.precoPlanilha : row.precoBase)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={step === 1 || busy} onClick={() => setStep(step - 1)}>
            « Anterior
          </Button>
          {step === 1 && <Button onClick={next1}>Próximo »</Button>}
          {step === 2 && (
            <Button onClick={next2} disabled={busy}>
              {busy ? "Buscando preços..." : "Próximo »"}
            </Button>
          )}
          {step === 3 && (
            <Button onClick={concluir} disabled={busy}>
              {busy ? "Importando..." : "Concluir"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

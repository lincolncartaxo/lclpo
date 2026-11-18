import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtNum } from "@/lib/format";
import { measurementAmount, measurementBalance } from "@/lib/contract-calculations";

type Item = { id: string; item: string | null; codigo: string | null; descricao: string; unidade: string | null; quantidade: number };
type Measurement = { id: string; numero: number; data_medicao: string; observacao: string };
type Line = { medicao_id: string; item_id: string; quantidade: number; preco_unitario: number; bdi: number };

export function MeasurementsTab({ orcId, items, name }: { orcId: string; items: Item[]; name: string }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [selected, setSelected] = useState("new");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("orcamento_medicoes").select("id,numero,data_medicao,observacao").eq("orcamento_id", orcId).order("numero");
    if (error) throw error;
    const rows = data ?? []; setMeasurements(rows);
    if (!rows.length) { setLines([]); return; }
    const details = await supabase.from("orcamento_medicao_itens").select("medicao_id,item_id,quantidade,preco_unitario,bdi").in("medicao_id", rows.map(row => row.id));
    if (details.error) throw details.error;
    setLines(details.data ?? []);
  }, [orcId]);
  useEffect(() => { setDate(new Date().toISOString().slice(0, 10)); void load().catch(error => toast.error(error.message)); }, [load]);
  const current = measurements.find(row => row.id === selected);
  const rows = items.map(item => {
    const previous = lines.filter(line => line.item_id === item.id && (selected === "new" || (measurements.find(m => m.id === line.medicao_id)?.numero ?? 0) < (current?.numero ?? 0))).reduce((sum, line) => sum + Number(line.quantidade), 0);
    const detail = lines.find(line => line.medicao_id === selected && line.item_id === item.id);
    const quantity = selected === "new" ? Number((quantities[item.id] ?? "0").replace(",", ".")) : Number(detail?.quantidade ?? 0);
    return { item, previous, quantity, accumulated: previous + quantity, remaining: Number(item.quantidade) - previous - quantity, amount: detail ? measurementAmount(Number(detail.quantidade), Number(detail.preco_unitario), Number(detail.bdi)) : 0 };
  });
  const save = async () => {
    if (!date) return toast.error("Informe a data da medição.");
    try {
      for (const row of rows) measurementBalance(Number(row.item.quantidade), row.previous, row.quantity);
      const input = rows.filter(row => row.quantity > 0).map(row => ({ item_id: row.item.id, quantidade: row.quantity }));
      if (!input.length) return toast.error("Informe ao menos uma quantidade medida.");
      setBusy(true);
      const { data, error } = await supabase.rpc("registrar_medicao", { p_orcamento_id: orcId, p_data: date, p_observacao: note, p_itens: input });
      if (error) throw error;
      await load(); setSelected(data); setQuantities({}); toast.success("Boletim registrado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível registrar a medição."); }
    finally { setBusy(false); }
  };
  const reportRows = () => rows.map(row => [row.item.item ?? "", row.item.codigo ?? "", row.item.descricao, row.item.unidade ?? "", Number(row.item.quantidade), row.previous, row.quantity, row.accumulated, row.remaining, row.amount]);
  const title = `${name} — BM${String(current?.numero ?? 0).padStart(2, "0")}`;
  const exportFile = async (format: "xlsx" | "pdf") => {
    const headers = ["Item", "Código", "Descrição", "Un.", "Contratada", "Anterior", "Medida", "Acumulada", "Saldo", "Valor medido"];
    if (format === "xlsx") {
      const XLSX = await import("xlsx-js-style"); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[title], ["Data", current?.data_medicao ?? ""], headers, ...reportRows()]), "Medição"); XLSX.writeFile(wb, `${title}.xlsx`);
    } else {
      const { jsPDF } = await import("jspdf"); const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" }); doc.setFontSize(12); doc.text(title.slice(0, 100), 14, 15); autoTable(doc, { startY: 22, head: [headers], body: reportRows(), styles: { fontSize: 7 } }); doc.save(`${title}.pdf`);
    }
  };
  return <div className="mt-4 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Boletins de medição</h2><Button variant="outline" onClick={() => { setSelected("new"); setQuantities({}); setNote(""); }}><Plus className="size-4" />Nova medição</Button></div>
    <div className="grid gap-4 md:grid-cols-3"><div><Label>Boletim</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Nova medição</SelectItem>{measurements.map(row => <SelectItem key={row.id} value={row.id}>BM{String(row.numero).padStart(2, "0")} · {row.data_medicao}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="measurement-date">Data da medição</Label><Input id="measurement-date" type="date" value={current?.data_medicao ?? date} onChange={event => setDate(event.target.value)} disabled={selected !== "new"} /></div><div><Label htmlFor="measurement-note">Observação</Label><Input id="measurement-note" maxLength={2000} value={current?.observacao ?? note} onChange={event => setNote(event.target.value)} disabled={selected !== "new"} /></div></div>
    <div className="overflow-x-auto border rounded"><table className="w-full text-sm"><thead className="bg-muted"><tr>{["Item", "Descrição", "Contratada", "Anterior", "Medida", "Acumulada", "Saldo", "Valor"].map(header => <th key={header} className="p-2 text-left">{header}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.item.id} className="border-t"><td className="p-2">{row.item.item ?? "—"}</td><td className="p-2 min-w-56">{row.item.descricao}</td><td className="p-2">{fmtNum(Number(row.item.quantidade), 4)}</td><td className="p-2">{fmtNum(row.previous, 4)}</td><td className="p-2">{selected === "new" ? <Input aria-label={`Quantidade medida ${row.item.item ?? row.item.id}`} type="number" min={0} max={Math.max(0, Number(row.item.quantidade) - row.previous)} step="any" className="w-28" value={quantities[row.item.id] ?? ""} onChange={event => setQuantities({ ...quantities, [row.item.id]: event.target.value })} /> : fmtNum(row.quantity, 4)}</td><td className="p-2">{fmtNum(row.accumulated, 4)}</td><td className={`p-2 ${row.remaining < 0 ? "text-destructive" : ""}`}>{fmtNum(row.remaining, 4)}</td><td className="p-2">{selected === "new" ? "—" : fmtBRL(row.amount)}</td></tr>)}</tbody></table></div>
    {selected === "new" ? <Button onClick={save} disabled={busy}><Save className="size-4" />{busy ? "Registrando…" : "Registrar medição"}</Button> : <div className="flex flex-wrap items-center gap-3"><strong>Total medido: {fmtBRL(rows.reduce((sum, row) => sum + row.amount, 0))}</strong><Button variant="outline" onClick={() => exportFile("xlsx")}><FileDown className="size-4" />Excel</Button><Button variant="outline" onClick={() => exportFile("pdf")}><FileDown className="size-4" />PDF</Button></div>}
  </div>;
}
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtNum } from "@/lib/format";

type Item = { id: string; item: string | null; codigo: string | null; descricao: string; quantidade: number; evento_id?: string | null };
type EventRow = { id: string; numero: number; titulo: string };
type FrontRow = { id: string; numero: number; nome: string };
type Allocation = { id?: string; item_id: string; frente_id: string; quantidade: number; mes_conclusao: number | null };
const db = supabase as any;

export function PleStructureTab({ orcId, items }: { orcId: string; items: Item[] }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [fronts, setFronts] = useState<FrontRow[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [frontName, setFrontName] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedFront, setSelectedFront] = useState("");
  const [quantity, setQuantity] = useState("");
  const [month, setMonth] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = items.find(i => i.id === selectedItem);
  const itemAllocations = useMemo(() => allocations.filter(a => a.item_id === selectedItem), [allocations, selectedItem]);
  const allocatedTotal = itemAllocations.reduce((sum, a) => sum + Number(a.quantidade || 0), 0);

  const load = async () => {
    const [ev, fr, al] = await Promise.all([
      db.from("orcamento_eventos").select("id,numero,titulo").eq("orcamento_id", orcId).order("numero"),
      db.from("orcamento_frentes").select("id,numero,nome").eq("orcamento_id", orcId).order("numero"),
      db.from("orcamento_item_frentes").select("id,item_id,frente_id,quantidade,mes_conclusao").eq("orcamento_id", orcId),
    ]);
    if (ev.error || fr.error || al.error) return toast.error((ev.error || fr.error || al.error).message);
    setEvents(ev.data ?? []); setFronts(fr.data ?? []); setAllocations(al.data ?? []);
  };
  useEffect(() => { load(); }, [orcId]);

  const addEvent = async () => {
    const titulo = eventTitle.trim();
    if (!titulo) return toast.error("Informe o título do evento");
    setBusy(true);
    const { error } = await db.from("orcamento_eventos").insert({ orcamento_id: orcId, numero: events.length + 1, titulo });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEventTitle(""); await load(); toast.success("Evento cadastrado");
  };
  const addFront = async () => {
    const nome = frontName.trim();
    if (!nome) return toast.error("Informe o nome da frente");
    setBusy(true);
    const { error } = await db.from("orcamento_frentes").insert({ orcamento_id: orcId, numero: fronts.length + 1, nome });
    setBusy(false);
    if (error) return toast.error(error.message);
    setFrontName(""); await load(); toast.success("Frente cadastrada");
  };
  const saveEvent = async () => {
    if (!selectedItem || !selectedEvent) return toast.error("Selecione o item e o evento");
    const { error } = await db.from("orcamento_itens").update({ evento_id: selectedEvent }).eq("id", selectedItem);
    if (error) return toast.error(error.message);
    toast.success("Evento associado ao item");
  };
  const addAllocation = async () => {
    if (!selected || !selectedFront) return toast.error("Selecione o item e a frente");
    const q = Number(quantity.replace(",", "."));
    if (!(q > 0)) return toast.error("Informe uma quantidade maior que zero");
    if (allocatedTotal + q > Number(selected.quantidade) + 0.0001) return toast.error("A soma das frentes não pode exceder a quantidade total do item");
    const { error } = await db.from("orcamento_item_frentes").upsert({ orcamento_id: orcId, item_id: selectedItem, frente_id: selectedFront, quantidade: q, mes_conclusao: month ? Number(month) : null }, { onConflict: "item_id,frente_id" });
    if (error) return toast.error(error.message);
    setQuantity(""); setMonth(""); await load(); toast.success("Distribuição salva");
  };
  const removeAllocation = async (id?: string) => {
    if (!id) return;
    const { error } = await db.from("orcamento_item_frentes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };
  const removeEvent = async (id: string) => {
    const used = items.some(i => i.evento_id === id);
    if (used) return toast.error("Não é possível excluir um evento associado a itens");
    const { error } = await db.from("orcamento_eventos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };
  const removeFront = async (id: string) => {
    if (allocations.some(a => a.frente_id === id)) return toast.error("Não é possível excluir uma frente com distribuições");
    const { error } = await db.from("orcamento_frentes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  return <div className="mt-4 space-y-6">
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">Eventos PLE</h3>
        <div className="flex gap-2"><Input value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Ex.: Fundações e Contenções" /><Button onClick={addEvent} disabled={busy}><Plus className="mr-1 size-4" />Adicionar</Button></div>
        <div className="space-y-1">{events.map(e => <div key={e.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span><b>{e.numero}.</b> {e.titulo}</span><Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeEvent(e.id)}><Trash2 className="size-4" /></Button></div>)}{!events.length && <p className="text-sm text-muted-foreground">Nenhum evento cadastrado.</p>}</div>
      </section>
      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">Frentes de obra</h3>
        <div className="flex gap-2"><Input value={frontName} onChange={e => setFrontName(e.target.value)} placeholder="Ex.: Habitação 1" /><Button onClick={addFront} disabled={busy}><Plus className="mr-1 size-4" />Adicionar</Button></div>
        <div className="space-y-1">{fronts.map(f => <div key={f.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span><b>{f.numero}.</b> {f.nome}</span><Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeFront(f.id)}><Trash2 className="size-4" /></Button></div>)}{!fronts.length && <p className="text-sm text-muted-foreground">Nenhuma frente cadastrada.</p>}</div>
      </section>
    </div>
    <section className="rounded-lg border p-4 space-y-4">
      <div><h3 className="font-semibold">Associação dos itens</h3><p className="text-sm text-muted-foreground">Associe cada item a um evento e distribua sua quantidade entre as frentes de obra.</p></div>
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-2"><Label>Item do orçamento</Label><Select value={selectedItem} onValueChange={v => { setSelectedItem(v); const i = items.find(x => x.id === v); setSelectedEvent(i?.evento_id ?? ""); }}><SelectTrigger><SelectValue placeholder="Selecione um item" /></SelectTrigger><SelectContent className="max-h-80">{items.filter(i => i.codigo).map(i => <SelectItem key={i.id} value={i.id}>{i.item || "—"} · {i.codigo} · {i.descricao.slice(0, 55)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Evento</Label><Select value={selectedEvent} onValueChange={setSelectedEvent}><SelectTrigger><SelectValue placeholder="Evento" /></SelectTrigger><SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.numero} · {e.titulo}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-end"><Button onClick={saveEvent} disabled={!selectedItem || !selectedEvent}><Save className="mr-1 size-4" />Salvar evento</Button></div>
      </div>
      {selected && <div className="rounded border bg-muted/20 p-3 space-y-3">
        <p className="text-sm"><b>{selected.item || "—"} · {selected.codigo}</b> — quantidade total: <b>{fmtNum(Number(selected.quantidade), 4)}</b> · distribuída: <b>{fmtNum(allocatedTotal, 4)}</b></p>
        <div className="grid gap-3 md:grid-cols-4"><div><Label>Frente</Label><Select value={selectedFront} onValueChange={setSelectedFront}><SelectTrigger><SelectValue placeholder="Frente" /></SelectTrigger><SelectContent>{fronts.map(f => <SelectItem key={f.id} value={f.id}>{f.numero} · {f.nome}</SelectItem>)}</SelectContent></Select></div><div><Label>Quantidade</Label><Input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0,00" /></div><div><Label>Mês de conclusão</Label><Input type="number" min="1" value={month} onChange={e => setMonth(e.target.value)} placeholder="Ex.: 1" /></div><div className="flex items-end"><Button onClick={addAllocation}><Save className="mr-1 size-4" />Salvar distribuição</Button></div></div>
        <div className="space-y-1">{itemAllocations.map(a => { const f = fronts.find(x => x.id === a.frente_id); return <div key={a.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>{f?.nome || "Frente removida"}: {fmtNum(Number(a.quantidade), 4)} · mês {a.mes_conclusao || "—"}</span><Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeAllocation(a.id)}><Trash2 className="size-4" /></Button></div>; })}</div>
      </div>}
    </section>
  </div>;
}

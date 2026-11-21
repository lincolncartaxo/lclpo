import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

type Target = { kind: "orcamento"; id: string; label: string } | { kind: "composicao"; fonte: string; codigo: string; label: string };
type Share = { organization_id: string; empresa_nome: string; permission: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ShareDialog({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [perm, setPerm] = useState("view");
  const [shares, setShares] = useState<Share[]>([]);
  const [busy, setBusy] = useState(false);
  const db = supabase as any;

  const load = useCallback(async () => {
    if (!target) return;
    const { data, error } = target.kind === "orcamento"
      ? await db.rpc("listar_compartilhamentos_orcamento", { p_orcamento_id: target.id })
      : await db.rpc("listar_compartilhamentos_composicao", { p_fonte: target.fonte, p_codigo: target.codigo });
    if (error) toast.error("Não foi possível carregar os compartilhamentos.");
    setShares(data ?? []);
  }, [target]);
  useEffect(() => { setCode(""); setPerm("view"); void load(); }, [load]);

  const share = async () => {
    if (!target) return;
    const org = code.trim();
    if (!UUID.test(org)) return toast.error("Código da empresa inválido. Peça o código na página Minha Empresa da outra empresa.");
    setBusy(true);
    const { error } = target.kind === "orcamento"
      ? await db.rpc("compartilhar_orcamento", { p_orcamento_id: target.id, p_organization_id: org, p_permission: perm })
      : await db.rpc("compartilhar_composicao", { p_fonte: target.fonte, p_codigo: target.codigo, p_organization_id: org, p_permission: "view" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Compartilhado com sucesso."); setCode(""); void load();
  };

  const revoke = async (org: string) => {
    if (!target || !confirm("Remover o acesso desta empresa?")) return;
    const { error } = target.kind === "orcamento"
      ? await db.rpc("revogar_compartilhamento_orcamento", { p_orcamento_id: target.id, p_organization_id: org })
      : await db.rpc("revogar_compartilhamento_composicao", { p_fonte: target.fonte, p_codigo: target.codigo, p_organization_id: org });
    if (error) return toast.error(error.message);
    toast.success("Acesso removido."); void load();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar com outra empresa</DialogTitle>
          <DialogDescription>{target?.label}. Sua empresa continua dona e pode remover o acesso a qualquer momento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Código da empresa</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: 3f2a…-…" /></div>
          {target?.kind === "orcamento"
            ? <div><Label>Acesso</Label><Select value={perm} onValueChange={setPerm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="view">Somente ver</SelectItem><SelectItem value="edit">Ver e editar</SelectItem></SelectContent></Select></div>
            : <p className="text-xs text-muted-foreground">A outra empresa poderá usar a composição nos orçamentos dela, sem editá-la.</p>}
          <Button onClick={share} disabled={busy} className="w-full">Compartilhar</Button>
        </div>
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Empresas com acesso</h4>
          {shares.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma ainda.</p> : (
            <ul className="divide-y border rounded-md">{shares.map((s) => (
              <li key={s.organization_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{s.empresa_nome} <span className="text-muted-foreground">· {s.permission === "edit" ? "ver e editar" : "somente ver"}</span></span>
                <button onClick={() => revoke(s.organization_id)} className="text-destructive" title="Remover acesso"><Trash2 className="size-4" /></button>
              </li>))}</ul>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

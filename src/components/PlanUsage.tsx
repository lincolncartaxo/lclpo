import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const PLAN_NAMES: Record<string, string> = { free: "Free", pro: "Pro", business: "Equipe", enterprise: "Empresa" };

export function friendlyLimitError(message: string) {
  if (/Limite do plano atingido/i.test(message)) return "Você atingiu o limite de orçamentos do seu plano. Exclua um orçamento ou mude de plano em Planos.";
  if (/não possui uma assinatura ativa/i.test(message)) return "A assinatura da sua empresa não está ativa. Regularize em Planos para criar novos orçamentos.";
  return message;
}

type Usage = { plan: string; used: number; max: number };

export function PlanUsage({ refreshKey }: { refreshKey: number }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sub } = await supabase.from("organization_subscriptions").select("organization_id,plan_code").limit(1).maybeSingle();
      if (!sub) return;
      const [{ data: plan }, { count }] = await Promise.all([
        supabase.from("plan_definitions").select("max_budgets").eq("code", sub.plan_code).maybeSingle(),
        supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("organization_id", sub.organization_id),
      ]);
      if (active && plan) setUsage({ plan: sub.plan_code, used: count ?? 0, max: plan.max_budgets });
    })();
    return () => { active = false; };
  }, [refreshKey]);

  if (!usage) return null;
  const pct = Math.min(100, Math.round((usage.used / Math.max(usage.max, 1)) * 100));
  const atLimit = usage.used >= usage.max;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
      <div className="min-w-56 flex-1">
        <p className="text-sm">
          Plano <strong>{PLAN_NAMES[usage.plan] ?? usage.plan}</strong> · {usage.used.toLocaleString("pt-BR")} de {usage.max.toLocaleString("pt-BR")} orçamentos
        </p>
        <Progress value={pct} className="mt-2 h-2" aria-label="Uso de orçamentos do plano" />
        {atLimit && <p className="mt-2 text-xs text-destructive">Limite atingido. Para criar mais orçamentos, mude de plano.</p>}
      </div>
      {usage.plan === "free" && <Button variant={atLimit ? "default" : "outline"} size="sm" asChild><Link to="/planos">Ver planos</Link></Button>}
    </div>
  );
}

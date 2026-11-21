import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PLAN_NAMES: Record<string, string> = { free: "Free", pro: "Pro", business: "Equipe", enterprise: "Empresa" };

export function friendlyLimitError(message: string) {
  if (/Limite do plano atingido/i.test(message)) return "Você atingiu o limite de orçamentos do seu plano. Exclua um orçamento ou mude de plano em Planos.";
  if (/não possui uma assinatura ativa/i.test(message)) return "A assinatura da sua empresa não está ativa. Regularize em Planos para criar novos orçamentos.";
  return message;
}

type Usage = { plan: string; used: number; max: number };

export function PlanUsage({ refreshKey }: { refreshKey: number }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente para consultar o uso do plano.");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id_empresa")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.id_empresa) throw new Error("Sua conta ainda não está vinculada a uma empresa.");

        const { data: sub, error: subscriptionError } = await supabase
          .from("organization_subscriptions")
          .select("organization_id,plan_code,status,current_period_end,trial_ends_at")
          .eq("organization_id", profile.id_empresa)
          .maybeSingle();
        if (subscriptionError) throw subscriptionError;
        if (!sub) throw new Error("Não foi encontrada uma assinatura para sua empresa.");

        const now = Date.now();
        const periodIsValid = sub.status === "active"
          ? !sub.current_period_end || new Date(sub.current_period_end).getTime() > now
          : sub.status === "trialing"
            ? !sub.trial_ends_at || new Date(sub.trial_ends_at).getTime() > now
            : false;
        if (!periodIsValid) throw new Error("A assinatura da sua empresa não está ativa. Regularize em Planos para criar novos orçamentos.");

        const [{ data: plan, error: planError }, { count, error: budgetsError }] = await Promise.all([
          supabase.from("plan_definitions").select("max_budgets").eq("code", sub.plan_code).eq("active", true).maybeSingle(),
          supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("organization_id", profile.id_empresa),
        ]);
        if (planError) throw planError;
        if (budgetsError) throw budgetsError;
        if (!plan) throw new Error("A configuração do seu plano não foi encontrada.");

        if (active) setUsage({ plan: sub.plan_code, used: count ?? 0, max: plan.max_budgets });
      } catch (cause) {
        if (active) {
          setUsage(null);
          setError(cause instanceof Error ? cause.message : "Não foi possível consultar o uso do plano.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshKey, retryKey]);

  if (loading) return <div className="mb-6 rounded-lg border bg-card p-4 text-sm text-muted-foreground">Carregando uso do plano…</div>;
  if (error) {
    return (
      <Alert variant="destructive" className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <AlertDescription>{error}</AlertDescription>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setRetryKey((value) => value + 1)}>Tentar novamente</Button>
          <Button variant="outline" size="sm" asChild><Link to="/planos">Ver planos</Link></Button>
        </div>
      </Alert>
    );
  }
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
      {(usage.plan === "free" || atLimit) && <Button variant={atLimit ? "default" : "outline"} size="sm" asChild><Link to="/planos">Ver planos</Link></Button>}
    </div>
  );
}

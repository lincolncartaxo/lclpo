import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BILLING_PLANS, type PaidPlanCode } from "@/lib/billing-plans";
import { createCheckout, syncSubscription, openCustomerPortal } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos e assinatura | LclPlan" },
      { name: "description", content: "Escolha o plano do LclPlan para orçamentos de obras públicas." },
      { property: "og:title", content: "Planos e assinatura | LclPlan" },
      { property: "og:description", content: "Escolha o plano do LclPlan para orçamentos de obras públicas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanosPage,
});

function PlanosPage() {
  const [current, setCurrent] = useState<{ plan: string; subscribed: boolean; end: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const checkout = useServerFn(createCheckout);
  const portal = useServerFn(openCustomerPortal);
  const subscription = useServerFn(syncSubscription);

  const refresh = async () => {
    try { setCurrent(await subscription()); } catch (e: any) { toast.error(e.message ?? "Erro ao verificar assinatura"); }
  };
  useEffect(() => {
    const st = new URLSearchParams(window.location.search).get("status");
    if (st === "sucesso") toast.success("Assinatura confirmada!");
    refresh();
  }, []);

  const openPayment = async (operation: string, request: () => Promise<{ url: string }>) => {
    setBusy(operation);
    setPaymentUrl(null);
    // Open synchronously during the click so popup blockers permit the new tab.
    const paymentWindow = window.open("about:blank", "_blank");
    if (paymentWindow) paymentWindow.opener = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const { url } = await Promise.race([
        request(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("O Stripe demorou a responder. Tente novamente em instantes.")), 30000);
        }),
      ]);
      const raw = typeof url === "string" ? url.trim() : "";
      if (!raw) throw new Error("O Stripe não retornou o link de pagamento.");
      const destination = new URL(raw);
      if (destination.protocol !== "https:" || !(destination.hostname === "stripe.com" || destination.hostname.endsWith(".stripe.com"))) {
        throw new Error("Não foi possível abrir o pagamento.");
      }
      setPaymentUrl(destination.href);
      let opened = false;
      try {
        if (paymentWindow && !paymentWindow.closed) { paymentWindow.location.href = destination.href; opened = true; }
      } catch { opened = false; }
      if (!opened) {
        try { paymentWindow?.close(); } catch { /* ignore */ }
        toast.info("Clique em \"Abrir Stripe\" para continuar o pagamento.");
      }
    } catch (e: unknown) {
      try { paymentWindow?.close(); } catch { /* ignore */ }
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o Stripe.");
    } finally {
      clearTimeout(timeout);
      setBusy(null);
    }
  };
  const assinar = (plan: PaidPlanCode) => openPayment(plan, () => checkout({ data: { plan, origin: window.location.origin } }));
  const gerenciar = () => openPayment("portal", () => portal({ data: { origin: window.location.origin } }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Planos</h1>
          <p className="text-muted-foreground">Plano atual: <strong>{current ? (BILLING_PLANS[current.plan as PaidPlanCode]?.name ?? "Free") : "…"}</strong>
            {current?.end && <> · renova em {new Date(current.end).toLocaleDateString("pt-BR")}</>}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>Atualizar status</Button>
          {current?.subscribed && <Button onClick={gerenciar} disabled={!!busy}>Gerenciar assinatura</Button>}
        </div>
      </div>
      {paymentUrl && <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
        <span>Seu acesso ao Stripe está pronto.</span>
        <Button variant="outline" asChild><a href={paymentUrl} target="_blank" rel="noopener noreferrer">Abrir Stripe</a></Button>
      </div>}
      <div className="grid md:grid-cols-3 gap-4">
        {(Object.entries(BILLING_PLANS) as [PaidPlanCode, (typeof BILLING_PLANS)[PaidPlanCode]][]).map(([code, p]) => {
          const ativo = current?.plan === code;
          return (
            <Card key={code} className={ativo ? "border-primary border-2" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between"><CardTitle>{p.name}</CardTitle>{ativo && <Badge>Seu plano</Badge>}</div>
                <CardDescription>{p.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">R$ {p.amount}<span className="text-base font-normal text-muted-foreground">/mês</span></p>
                <p className="mt-3 text-sm flex items-center gap-2"><Check className="size-4 text-primary" /> Bases SINAPI e exportações</p>
              </CardContent>
              <CardFooter>
                <Button className="w-full" disabled={ativo || !!busy} onClick={() => (current?.subscribed ? gerenciar() : assinar(code))}>
                  {ativo ? "Plano atual" : busy === code ? "Abrindo…" : current?.subscribed ? "Trocar plano" : "Assinar"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

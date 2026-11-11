import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_PLANS, planFromProduct } from "./billing-plans";

async function stripe(path: string, method: "GET" | "POST", params?: Record<string, string>) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe não configurado.");
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? body : undefined,
  });
  const json: any = await r.json();
  if (!r.ok) throw new Error(json?.error?.message ?? `Erro Stripe ${r.status}`);
  return json;
}

async function findCustomer(email: string) {
  const res = await stripe("customers", "GET", { email, limit: "1" });
  return (res.data?.[0]?.id as string | undefined) ?? null;
}

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id_empresa").eq("id", userId).maybeSingle();
  return (data?.id_empresa as string | null) ?? null;
}

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan: z.enum(["pro", "business", "enterprise"]), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims as any).email as string | undefined;
    if (!email) throw new Error("Usuário sem e-mail.");
    const customer = await findCustomer(email);
    const params: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": BILLING_PLANS[data.plan].priceId,
      "line_items[0][quantity]": "1",
      success_url: `${data.origin}/planos?status=sucesso`,
      cancel_url: `${data.origin}/planos?status=cancelado`,
      "metadata[user_id]": context.userId,
    };
    if (customer) params.customer = customer; else params.customer_email = email;
    const session = await stripe("checkout/sessions", "POST", params);
    return { url: session.url as string };
  });

export const syncSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as any).email as string | undefined;
    if (!email) return { plan: "free" as const, subscribed: false, end: null as string | null };
    const customer = await findCustomer(email);
    let plan: string = "free";
    let end: string | null = null;
    let subId: string | null = null;
    if (customer) {
      const subs = await stripe("subscriptions", "GET", { customer, status: "active", limit: "1" });
      const s = subs.data?.[0];
      if (s) {
        plan = planFromProduct(s.items?.data?.[0]?.price?.product) ?? "free";
        const pe = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
        end = pe ? new Date(pe * 1000).toISOString() : null;
        subId = s.id;
      }
    }
    // Atualiza o plano da empresa do usuário (somente a própria empresa).
    const orgId = await getOrgId(context.supabase, context.userId);
    if (orgId) {
      const { data: member } = await context.supabase.rpc("is_organization_member", { p_organization_id: orgId });
      if (member) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cur } = await supabaseAdmin.from("organization_subscriptions").select("provider").eq("organization_id", orgId).maybeSingle();
        // Não rebaixa planos concedidos manualmente pelo administrador.
        if (subId || cur?.provider === "stripe") {
          await supabaseAdmin.from("organization_subscriptions").upsert({
            organization_id: orgId,
            plan_code: plan,
            status: subId ? "active" : "canceled",
            current_period_end: end,
            provider: "stripe",
            provider_customer_id: customer,
            provider_subscription_id: subId,
            updated_at: new Date().toISOString(),
          } as any);
        }
      }
    }
    return { plan, subscribed: !!subId, end };
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims as any).email as string | undefined;
    const customer = email ? await findCustomer(email) : null;
    if (!customer) throw new Error("Nenhuma assinatura encontrada.");
    const s = await stripe("billing_portal/sessions", "POST", { customer, return_url: `${data.origin}/planos` });
    return { url: s.url as string };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_PLANS } from "./billing-plans";
import { subscriptionState } from "./billing-domain";

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan: z.enum(["pro", "business", "enterprise"]), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { organizationBilling, ensureCustomer, stripeRequest, currentStripeSubscription, checkoutOrigin } = await import("./billing.server");
    const billing = await organizationBilling(context.supabase, context.userId, true);
    const email = z.string().email().optional().parse(context.claims.email);
    if (!email) throw new Error("Usuário sem e-mail.");
    const origin = checkoutOrigin(data.origin, getRequest().url);
    const customer = await ensureCustomer(billing.orgId, billing.subscription.provider_customer_id, email);
    const existing = await currentStripeSubscription(customer, billing.subscription.provider_subscription_id);
    if (existing && !["canceled", "incomplete_expired"].includes(existing.status)) throw new Error("Já existe uma assinatura. Use Gerenciar assinatura para alterar o plano.");
    const params: Record<string, string> = {
      mode: "subscription", customer,
      "line_items[0][price]": BILLING_PLANS[data.plan].priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/planos?status=sucesso`,
      cancel_url: `${origin}/planos?status=cancelado`,
      client_reference_id: billing.orgId,
      "metadata[organization_id]": billing.orgId,
      "subscription_data[metadata][organization_id]": billing.orgId,
    };
    const session = z.object({ url: z.string().url() }).parse(await stripeRequest("checkout/sessions", "POST", params, `checkout-${billing.orgId}-${data.plan}-${Math.floor(Date.now() / 60000)}`));
    return { url: session.url };
  });

export const syncSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { organizationBilling, currentStripeSubscription, applySubscription } = await import("./billing.server");
    const { orgId, subscription, canManage } = await organizationBilling(context.supabase, context.userId);
    let providerStatus: string | null = null;
    let cancelAtPeriodEnd = false;
    if (canManage && subscription.provider_customer_id) {
      const stripeSub = await currentStripeSubscription(subscription.provider_customer_id, subscription.provider_subscription_id);
      if (stripeSub) {
        const state = subscriptionState(stripeSub);
        providerStatus = state.status;
        cancelAtPeriodEnd = state.cancelAtPeriodEnd;
        await applySubscription(orgId, stripeSub, `sync_${crypto.randomUUID()}`, "app.sync", Math.floor(Date.now() / 1000));
      }
    }
    const { data: current, error } = await context.supabase.from("organization_subscriptions").select("*").eq("organization_id", orgId).single();
    if (error) throw new Error("Não foi possível atualizar o status da assinatura.");
    const { data: events, error: eventsError } = canManage
      ? await context.supabase.from("billing_events").select("event_type,outcome,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(5)
      : { data: [], error: null };
    if (eventsError) throw new Error("Não foi possível consultar o histórico da cobrança.");
    return { plan: current.plan_code, subscribed: current.provider === "stripe" && ["active", "trialing"].includes(current.status),
      end: current.current_period_end, status: current.status, canManage, providerStatus, cancelAtPeriodEnd,
      hasCustomer: Boolean(current.provider_customer_id), manual: current.provider !== "stripe" && current.plan_code !== "free", events: events ?? [] };
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { organizationBilling, stripeRequest, checkoutOrigin } = await import("./billing.server");
    const billing = await organizationBilling(context.supabase, context.userId, true);
    const customer = billing.subscription.provider_customer_id;
    if (!customer) throw new Error("Nenhuma assinatura encontrada.");
    const origin = checkoutOrigin(data.origin, getRequest().url);
    const session = z.object({ url: z.string().url() }).parse(await stripeRequest("billing_portal/sessions", "POST", { customer, return_url: `${origin}/planos` }));
    return { url: session.url };
  });

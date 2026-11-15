import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { canManageBilling, stripeSubscriptionSchema, subscriptionState } from "./billing-domain";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function stripeRequest(path: string, method: "GET" | "POST", params?: Record<string, string>, idempotencyKey?: string): Promise<unknown> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe não configurado.");
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const response = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2025-08-27.basil", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    console.error("Stripe request failed", { status: response.status, resource: path.split("/")[0] });
    throw new Error("Não foi possível consultar o Stripe. Tente novamente.");
  }
  return response.json();
}

export async function organizationBilling(client: SupabaseClient<Database>, userId: string, requireManager = false) {
  const { data: profile, error: profileError } = await client.from("profiles").select("id_empresa").eq("id", userId).maybeSingle();
  if (profileError) throw new Error("Não foi possível consultar sua empresa.");
  if (!profile?.id_empresa) throw new Error("Vincule sua conta a uma empresa antes de assinar.");
  const orgId = profile.id_empresa;
  const { data: member, error: memberError } = await client.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (memberError || !member) throw new Error("Você não tem acesso à assinatura desta empresa.");
  const canManage = canManageBilling(member.role);
  if (requireManager && !canManage) throw new Error("Somente o responsável ou administrador da empresa pode gerenciar a assinatura.");
  const { data: subscription, error } = await client.from("organization_subscriptions").select("*").eq("organization_id", orgId).single();
  if (error) throw new Error("Não foi possível consultar a assinatura da empresa.");
  return { orgId, subscription, canManage };
}

export async function ensureCustomer(orgId: string, existing: string | null, email: string) {
  if (existing) return existing;
  const customer = z.object({ id: z.string().regex(/^cus_[A-Za-z0-9]+$/) }).parse(await stripeRequest("customers", "POST", {
    email, "metadata[organization_id]": orgId,
  }, `lclplan-customer-${orgId}`));
  const { data, error } = await supabaseAdmin.rpc("bind_stripe_customer", { p_organization_id: orgId, p_customer_id: customer.id });
  if (error || !data) throw new Error("Não foi possível vincular a cobrança à empresa.");
  return data;
}

export async function currentStripeSubscription(customer: string, subscriptionId: string | null) {
  if (subscriptionId) {
    const subscription = stripeSubscriptionSchema.parse(await stripeRequest(`subscriptions/${encodeURIComponent(subscriptionId)}`, "GET"));
    if (subscription.customer !== customer) throw new Error("Assinatura de outra empresa.");
    return subscription;
  }
  const list = z.object({ data: z.array(stripeSubscriptionSchema) }).parse(await stripeRequest("subscriptions", "GET", { customer, status: "all", limit: "100" }));
  return list.data.find(s => s.customer === customer && ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(s.status)
    && s.items.data.some(item => { try { subscriptionState({ ...s, items: { data: [item] } }); return true; } catch { return false; } })) ?? null;
}

export async function applySubscription(orgId: string, subscription: ReturnType<typeof stripeSubscriptionSchema.parse>, eventId: string, eventType: string, eventCreated: number) {
  const state = subscriptionState(subscription);
  const { data, error } = await supabaseAdmin.rpc("apply_stripe_billing_event", {
    p_event_id: eventId, p_event_type: eventType, p_event_created: eventCreated,
    p_organization_id: orgId, p_customer_id: subscription.customer, p_subscription_id: subscription.id,
    // Generated RPC types do not express nullable SQL arguments; preserve SQL NULL.
    p_plan_code: state.plan, p_status: state.status, p_period_end: state.end as string, p_trial_end: state.trialEnd as string,
  });
  if (error) throw new Error("Não foi possível atualizar a assinatura.");
  return data;
}

export function checkoutOrigin(value: string, requestUrl: string) {
  const origin = new URL(value);
  const request = new URL(requestUrl);
  if (origin.origin !== request.origin || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("Endereço de retorno inválido.");
  return origin.origin;
}
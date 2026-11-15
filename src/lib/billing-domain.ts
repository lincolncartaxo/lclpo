import { z } from "zod";
import { planFromProduct } from "./billing-plans";

export function canManageBilling(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export const stripeSubscriptionSchema = z.object({
  id: z.string().regex(/^sub_[A-Za-z0-9]+$/),
  customer: z.string().regex(/^cus_[A-Za-z0-9]+$/),
  status: z.enum(["active", "trialing", "past_due", "canceled", "paused", "unpaid", "incomplete", "incomplete_expired"]),
  metadata: z.record(z.string(), z.string()).default({}),
  current_period_end: z.number().optional(),
  trial_end: z.number().nullable().optional(),
  cancel_at_period_end: z.boolean().default(false),
  items: z.object({ data: z.array(z.object({ current_period_end: z.number().optional(), price: z.object({ product: z.string() }) })) }),
});
export type StripeSubscription = z.infer<typeof stripeSubscriptionSchema>;

export function subscriptionState(subscription: StripeSubscription) {
  const plan = subscription.items.data.map(item => planFromProduct(item.price.product)).find(Boolean);
  if (!plan) throw new Error("Plano Stripe não reconhecido.");
  const status = subscription.status === "unpaid" ? "past_due"
    : subscription.status === "incomplete" ? "paused"
    : subscription.status === "incomplete_expired" ? "canceled" : subscription.status;
  const period = subscription.current_period_end ?? subscription.items.data[0]?.current_period_end;
  return {
    plan, status,
    end: period ? new Date(period * 1000).toISOString() : null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscribed: status === "active" || status === "trialing",
  };
}

// Web Crypto works in both the Worker and the test runner; no Node dependencies.
export async function verifyStripeSignature(body: string, header: string | null, secret: string, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = header.split(",").map(part => part.trim().split("="));
  const timestamp = parts.find(([name]) => name === "t")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
  return parts.filter(([name]) => name === "v1").some(([, signature]) => {
    if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
    let difference = 0;
    for (let i = 0; i < digest.length; i++) difference |= digest[i] ^ Number.parseInt(signature.slice(i * 2, i * 2 + 2), 16);
    return difference === 0;
  });
}

export const stripeEventSchema = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9]+$/),
  type: z.string().max(150),
  created: z.number().int().positive(),
  livemode: z.boolean(),
  data: z.object({ object: z.object({
    id: z.string(),
    customer: z.string().nullable().optional(),
    subscription: z.string().nullable().optional(),
    parent: z.object({ subscription_details: z.object({ subscription: z.string().nullable().optional() }).nullable().optional() }).nullable().optional(),
  }).passthrough() }),
});
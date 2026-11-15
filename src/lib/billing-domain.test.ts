import { describe, expect, it } from "vitest";
import { BILLING_PLANS } from "./billing-plans";
import { canManageBilling, stripeSubscriptionSchema, subscriptionState, verifyStripeSignature } from "./billing-domain";

const subscription = stripeSubscriptionSchema.parse({ id: "sub_test", customer: "cus_test", status: "active", current_period_end: 1800000000,
  items: { data: [{ price: { product: BILLING_PLANS.pro.productId } }] } });

describe("approved monthly prices", () => {
  it("Pro costs R$129", () => expect(BILLING_PLANS.pro.amount).toBe(129));
  it("Equipe costs R$349", () => expect(BILLING_PLANS.business.amount).toBe(349));
  it("Empresa costs R$799", () => expect(BILLING_PLANS.enterprise.amount).toBe(799));
});
describe("organization billing authorization", () => {
  it("allows the owner", () => expect(canManageBilling("owner")).toBe(true));
  it("allows the company administrator", () => expect(canManageBilling("admin")).toBe(true));
  it.each(["editor", "viewer", "member", null])("rejects role %s", role => expect(canManageBilling(role)).toBe(false));
});
describe("subscription lifecycle", () => {
  it("maps Pro to the approved product", () => expect(subscriptionState(subscription).plan).toBe("pro"));
  it("retains access until cancellation takes effect", () => expect(subscriptionState({ ...subscription, cancel_at_period_end: true }).subscribed).toBe(true));
  it("does not mark an unpaid subscription as active", () => expect(subscriptionState({ ...subscription, status: "unpaid" })).toMatchObject({ status: "past_due", subscribed: false }));
  it("does not mark cancellation as paid", () => expect(subscriptionState({ ...subscription, status: "canceled" }).subscribed).toBe(false));
  it("does not infer a plan from an unknown product", () => expect(() => subscriptionState({ ...subscription, items: { data: [{ price: { product: "prod_unknown" } }] } })).toThrow());
});
describe("Stripe webhook authenticity", () => {
  const now = 1800000000000;
  const body = '{"id":"evt_test"}';
  const secret = "test-only-signing-secret";
  async function header(timestamp = now / 1000) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return `t=${timestamp},v1=${hex}`;
  }
  it("accepts a signature over the original body", async () => expect(await verifyStripeSignature(body, await header(), secret, now)).toBe(true));
  it("rejects an altered body", async () => expect(await verifyStripeSignature(body + " ", await header(), secret, now)).toBe(false));
  it("rejects deliveries more than five minutes old", async () => expect(await verifyStripeSignature(body, await header(now / 1000 - 301), secret, now)).toBe(false));
  it("rejects absent signatures", async () => expect(await verifyStripeSignature(body, null, secret, now)).toBe(false));
});
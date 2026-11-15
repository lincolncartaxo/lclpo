import { createFileRoute } from "@tanstack/react-router";
import { stripeEventSchema, verifyStripeSignature } from "@/lib/billing-domain";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return new Response("Webhook not configured", { status: 503 });
    if (Number(request.headers.get("content-length")) > 1048576) return new Response("Payload too large", { status: 413 });
    const body = await request.text();
    if (body.length > 1048576) return new Response("Payload too large", { status: 413 });
    if (!await verifyStripeSignature(body, request.headers.get("stripe-signature"), secret)) return new Response("Invalid signature", { status: 401 });
    let event;
    try { event = stripeEventSchema.parse(JSON.parse(body)); }
    catch { return new Response("Invalid event", { status: 400 }); }
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || event.livemode !== stripeKey.startsWith("sk_live_")) return new Response("Wrong billing mode", { status: 400 });
    if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"].includes(event.type)) return Response.json({ received: true });
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const object = event.data.object;
      const subscriptionId = event.type.startsWith("customer.subscription.") ? object.id : object.subscription ?? object.parent?.subscription_details?.subscription;
      if (!object.customer || !subscriptionId) return Response.json({ received: true });
      const { data: organization, error } = await supabaseAdmin.from("organization_subscriptions").select("organization_id").eq("provider_customer_id", object.customer).maybeSingle();
      if (error) throw error;
      if (!organization) return Response.json({ received: true }); // Other products on the same Stripe account.
      const { currentStripeSubscription, applySubscription } = await import("@/lib/billing.server");
      // Read current state rather than trust an older delivery's subscription object.
      const subscription = await currentStripeSubscription(object.customer, subscriptionId);
      if (!subscription) throw new Error("Subscription unavailable");
      await applySubscription(organization.organization_id, subscription, event.id, event.type, event.created);
      return Response.json({ received: true });
    } catch {
      console.error("Stripe webhook processing failed", { eventId: event.id, eventType: event.type });
      return new Response("Retry later", { status: 500 });
    }
  } } },
});
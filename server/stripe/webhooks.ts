import type { Express, Request, Response } from "express";
import type Stripe from "stripe";
import { checkoutResourceId, verifyStripeWebhook } from "./billing";
import { upsertStripeSubscriptionReference } from "../db";

function positiveMetadata(metadata: Stripe.Metadata | null, name: string) {
  const value = Number(metadata?.[name]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function syncSubscription(event: Stripe.Event) {
  const resource = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
  const metadata = resource.metadata;
  const ownerUserId = positiveMetadata(metadata, "workspace_owner_id");
  const clientId = positiveMetadata(metadata, "client_id");
  const planId = positiveMetadata(metadata, "plan_id");
  if (!ownerUserId || !clientId || !planId) return;

  const isCheckout = event.type === "checkout.session.completed";
  const customerId = checkoutResourceId(isCheckout ? (resource as Stripe.Checkout.Session).customer : (resource as Stripe.Subscription).customer);
  const subscriptionId = checkoutResourceId(isCheckout ? (resource as Stripe.Checkout.Session).subscription : resource as Stripe.Subscription);
  if (!subscriptionId) return;
  const stripeStatus = isCheckout ? "active" : (resource as Stripe.Subscription).status;
  const status = stripeStatus === "trialing" ? "trialing" : stripeStatus === "past_due" ? "past_due" : stripeStatus === "paused" ? "paused" : stripeStatus === "canceled" || stripeStatus === "unpaid" ? "canceled" : "active";
  const priceId = isCheckout ? null : (resource as Stripe.Subscription).items.data[0]?.price?.id ?? null;
  await upsertStripeSubscriptionReference({ ownerUserId, clientId, planId, stripeCustomerId: customerId, externalSubscriptionId: subscriptionId, stripePriceId: priceId, status });
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    try {
      const payload = req.body as Buffer;
      const event = verifyStripeWebhook(payload, req.header("stripe-signature") || undefined);
      if (event.id.startsWith("evt_test_")) return res.json({ verified: true });
      if (["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) await syncSubscription(event);
      return res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook Stripe inválido.";
      return res.status(400).json({ error: message });
    }
  });
}

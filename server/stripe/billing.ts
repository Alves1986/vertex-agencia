import Stripe from "stripe";
import { buildAnnualPlanLineItems, type AnnualSaasPlanForCheckout, annualCheckoutMetadata } from "./products";

type CheckoutInput = {
  plan: AnnualSaasPlanForCheckout;
  ownerUserId: number;
  clientId: number;
  customerEmail?: string | null;
  customerName?: string | null;
  origin: string;
};

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("A cobrança Stripe ainda não está configurada para esta VERTEX.");
  return new Stripe(key);
}

function trustedOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function createAnnualPlanCheckout(input: CheckoutInput) {
  const metadata = annualCheckoutMetadata({ ownerUserId: input.ownerUserId, clientId: input.clientId, planId: input.plan.id });
  const origin = trustedOrigin(input.origin);
  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: buildAnnualPlanLineItems(input.plan),
    customer_email: input.customerEmail || undefined,
    client_reference_id: String(input.ownerUserId),
    metadata: { ...metadata, customer_name: input.customerName || "" },
    subscription_data: { metadata },
    allow_promotion_codes: true,
    success_url: `${origin}/atendimento?checkout=success&client=${input.clientId}`,
    cancel_url: `${origin}/atendimento?checkout=cancelled&client=${input.clientId}`,
  });
  if (!session.url) throw new Error("O Stripe não retornou uma URL de checkout.");
  return session.url;
}

export function verifyStripeWebhook(payload: Buffer, signature: string | undefined) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("O segredo de webhook Stripe ainda não está configurado.");
  if (!signature) throw new Error("Assinatura Stripe ausente.");
  return stripeClient().webhooks.constructEvent(payload, signature, secret);
}

export function checkoutResourceId(value: { id?: string } | string | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

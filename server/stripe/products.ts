export type AnnualSaasPlanForCheckout = {
  id: number;
  code: string;
  name: string;
  annualPriceCents: number;
  stripePriceId?: string | null;
};

/** A cobrança é anual por definição; o catálogo operacional continua no banco do workspace. */
export function buildAnnualPlanLineItems(plan: AnnualSaasPlanForCheckout) {
  if (plan.stripePriceId) return [{ price: plan.stripePriceId, quantity: 1 }];
  return [{
    price_data: {
      currency: "brl",
      product_data: { name: `VERTEX Atendimento — ${plan.name}` },
      unit_amount: plan.annualPriceCents,
      recurring: { interval: "year" as const },
    },
    quantity: 1,
  }];
}

export function annualCheckoutMetadata(input: { ownerUserId: number; clientId: number; planId: number }) {
  return {
    workspace_owner_id: String(input.ownerUserId),
    client_id: String(input.clientId),
    plan_id: String(input.planId),
  };
}

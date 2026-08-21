import { describe, expect, it } from "vitest";
import { annualCheckoutMetadata, buildAnnualPlanLineItems } from "./products";

describe("catálogo anual Stripe", () => {
  it("prefere o preço Stripe configurado no plano", () => {
    expect(buildAnnualPlanLineItems({ id: 3, code: "scale", name: "Scale", annualPriceCents: 120000, stripePriceId: "price_123" })).toEqual([{ price: "price_123", quantity: 1 }]);
  });

  it("monta preço anual em BRL quando o plano ainda não possui preço Stripe", () => {
    expect(buildAnnualPlanLineItems({ id: 3, code: "scale", name: "Scale", annualPriceCents: 120000 })).toEqual([{ price_data: { currency: "brl", product_data: { name: "VERTEX Atendimento — Scale" }, unit_amount: 120000, recurring: { interval: "year" } }, quantity: 1 }]);
  });

  it("mantém no metadata apenas vínculos internos necessários", () => {
    expect(annualCheckoutMetadata({ ownerUserId: 7, clientId: 2, planId: 3 })).toEqual({ workspace_owner_id: "7", client_id: "2", plan_id: "3" });
  });
});

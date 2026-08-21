import { describe, expect, it } from "vitest";
import { calculateManagedAiQuote } from "./db";

describe("simulação comercial da IA VERTEX", () => {
  it("não cobra excedente quando a projeção permanece dentro da franquia", () => {
    const quote = calculateManagedAiQuote({
      currentMonthlyMessages: 220,
      projectedAdditionalMessages: 180,
      includedMonthlyMessages: 500,
      costPerThousandCents: 120,
      markupPercent: 80,
      overagePricePerThousandCents: 216,
    });
    expect(quote).toMatchObject({ totalMonthlyMessages: 400, overageMessages: 0, projectedOverageRevenueCents: 0, projectedOverageGrossMarginCents: 0 });
  });

  it("calcula custo e margem somente sobre o excedente", () => {
    const quote = calculateManagedAiQuote({
      currentMonthlyMessages: 400,
      projectedAdditionalMessages: 1_600,
      includedMonthlyMessages: 500,
      costPerThousandCents: 120,
      markupPercent: 80,
      overagePricePerThousandCents: 216,
    });
    expect(quote).toMatchObject({ totalMonthlyMessages: 2_000, overageMessages: 1_500, projectedCostCents: 240, projectedOverageRevenueCents: 432, projectedOverageGrossMarginCents: 192 });
  });

  it("deriva o preço de excedente com markup quando ele não foi informado", () => {
    const quote = calculateManagedAiQuote({
      currentMonthlyMessages: 1_100,
      projectedAdditionalMessages: 0,
      includedMonthlyMessages: 0,
      costPerThousandCents: 125,
      markupPercent: 60,
      overagePricePerThousandCents: 0,
    });
    expect(quote.overagePricePerThousandCents).toBe(200);
    expect(quote.projectedOverageGrossMarginCents).toBe(150);
  });
});

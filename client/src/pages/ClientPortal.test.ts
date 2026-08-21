import { describe, expect, it } from "vitest";
import { clientSubscriptionStatusCopy } from "./ClientPortal";

describe("visão do cliente", () => {
  it("expõe somente textos comerciais de assinatura para o portal", () => {
    expect(clientSubscriptionStatusCopy("active")).toContain("ativa");
    expect(clientSubscriptionStatusCopy("past_due")).toContain("financeira");
    expect(clientSubscriptionStatusCopy(null)).toContain("Sem assinatura");
  });
});

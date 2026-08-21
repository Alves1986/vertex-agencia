import { describe, expect, it } from "vitest";
import { canOpenAnnualCheckout, channelProviderSwitchCopy, clientPortalMemberAction, formatAnnualPlanPrice, formatManagedAiCents, getAiModeCopy, inboxStatusCopy, whatsappChannelProviders } from "./WhatsApp";

describe("catálogo de atendimento SaaS", () => {
  it("expõe os dois conectores de WhatsApp na ativação", () => {
    expect(whatsappChannelProviders.map(item => item.value)).toEqual(["meta_cloud", "twilio"]);
  });

  it("distingue a IA do cliente da IA gerenciada pela VERTEX", () => {
    expect(getAiModeCopy("client_api_key").title).toContain("próprio cliente");
    expect(getAiModeCopy("vertex_managed").title).toContain("VERTEX");
  });

  it("mantém a triagem e a revisão humana como estados distintos da caixa de entrada", () => {
    expect(inboxStatusCopy("waiting_human")).toContain("Aguardando humano");
    expect(inboxStatusCopy("human_active")).toContain("revisão humana");
  });

  it("formata valores internos da IA VERTEX em centavos sem exibir credenciais", () => {
    expect(formatManagedAiCents(216)).toContain("2,16");
    expect(formatManagedAiCents(null)).toContain("0,00");
  });

  it("formata o contrato anual e bloqueia checkout sem cliente ou preço Stripe", () => {
    expect(formatAnnualPlanPrice(120000)).toContain("1.200,00");
    expect(canOpenAnnualCheckout(1, "price_anual")).toBe(true);
    expect(canOpenAnnualCheckout(null, "price_anual")).toBe(false);
    expect(canOpenAnnualCheckout(1, null)).toBe(false);
    expect(canOpenAnnualCheckout(1, "   ")).toBe(false);
  });

  it("mostra a ação reversível apropriada para cada estado de acesso ao portal", () => {
    expect(clientPortalMemberAction("active")).toBe("Suspender acesso");
    expect(clientPortalMemberAction("suspended")).toBe("Reativar acesso");
  });

  it("explica a troca segura entre conectores oficiais e BSP", () => {
    expect(channelProviderSwitchCopy("meta_cloud")).toContain("API oficial da Meta");
    expect(channelProviderSwitchCopy("twilio")).toContain("BSP");
  });
});

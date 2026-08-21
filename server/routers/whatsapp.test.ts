import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  createWhatsAppChannel: vi.fn(),
  updateWhatsAppChannelProvider: vi.fn(),
  getWhatsAppAiPolicy: vi.fn(),
  listWhatsAppAutomationRules: vi.fn(),
  listWhatsAppChannels: vi.fn(),
  upsertWhatsAppAiPolicy: vi.fn(),
  upsertWhatsAppAutomationRule: vi.fn(),
  listWhatsAppInbox: vi.fn(),
  listWhatsAppConversationMessages: vi.fn(),
  activateWhatsAppHumanHandoff: vi.fn(),
  createWhatsAppDraft: vi.fn(),
  calculateManagedAiQuote: vi.fn(),
  getManagedAiBillingOverview: vi.fn(),
  getAnnualCheckoutContext: vi.fn(),
  listAnnualSaasPlans: vi.fn(),
  upsertAnnualSaasPlan: vi.fn(),
  createAnnualPlanCheckout: vi.fn(),
  getClientPortalOverview: vi.fn(),
  listClientPortalConversationMessages: vi.fn(),
  listClientPortalMembers: vi.fn(),
  grantClientPortalMember: vi.fn(),
  updateClientPortalMemberStatus: vi.fn(),
  getOperationalUserId: vi.fn(),
}));

vi.mock("../db", () => mocks);
vi.mock("./helpers", () => ({ getOperationalUserId: mocks.getOperationalUserId }));
vi.mock("../stripe/billing", () => ({ createAnnualPlanCheckout: mocks.createAnnualPlanCheckout }));

import { whatsappRouter } from "./whatsapp";

function createContext(role: "admin" | "user" = "admin"): TrpcContext {
  return { user: { id: 1, openId: "whatsapp-test", name: "Teste", email: "teste@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("contratos de WhatsApp SaaS", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloqueia perfis de cliente do console operacional e da margem interna", async () => {
    const caller = whatsappRouter.createCaller(createContext("user"));
    await expect(caller.managedAiBilling({ clientId: 3, projectedAdditionalMessages: 1 })).rejects.toThrow("restritas à equipe da agência");
    expect(mocks.getManagedAiBillingOverview).not.toHaveBeenCalled();
  });

  it("permite que o cliente leia somente sua visão sanitizada de portal", async () => {
    mocks.getClientPortalOverview.mockResolvedValue({ client: { id: 3, name: "Globo" }, policy: { aiAccessMode: "vertex_managed" }, conversations: [] });
    const caller = whatsappRouter.createCaller(createContext("user"));
    await expect(caller.clientPortalOverview({ clientId: 3 })).resolves.toMatchObject({ client: { id: 3, name: "Globo" }, policy: { aiAccessMode: "vertex_managed" } });
    expect(mocks.getClientPortalOverview).toHaveBeenCalledWith("whatsapp-test", 3);
  });

  it("mantém a associação de portal restrita à administração da agência", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.grantClientPortalMember.mockResolvedValue(14);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.grantPortalMember({ clientId: 3, email: "cliente@example.com", role: "client_admin" })).resolves.toEqual({ userId: 14 });
    expect(mocks.grantClientPortalMember).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, role: "client_admin" }));
    await expect(whatsappRouter.createCaller(createContext("user")).grantPortalMember({ clientId: 3, email: "cliente@example.com", role: "viewer" })).rejects.toThrow("restritas à equipe da agência");
  });

  it("lista apenas o canal sanitizado do cliente solicitado", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listWhatsAppChannels.mockResolvedValue([{ id: 13, clientId: 3, label: "Comercial", provider: "meta_cloud", encryptedConfig: "ciphertext", secret: "never-return" }]);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.channels({ clientId: 3 })).resolves.toEqual([{ id: 13, clientId: 3, label: "Comercial", provider: "meta_cloud" }]);
    expect(mocks.listWhatsAppChannels).toHaveBeenCalledWith(7, 3);
  });

  it("cria um canal rascunho no cliente pertencente ao espaço atual", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createWhatsAppChannel.mockResolvedValue(13);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.createChannel({ clientId: 3, label: "Comercial", provider: "meta_cloud", displayPhoneNumber: "+5511999999999" })).resolves.toEqual({ id: 13 });
    expect(mocks.createWhatsAppChannel).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, provider: "meta_cloud" }));
  });

  it("troca o conector somente pelo console da agência e preserva o vínculo do cliente informado", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.updateWhatsAppChannelProvider.mockResolvedValue(13);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.updateChannelProvider({ clientId: 3, channelId: 13, provider: "twilio", displayPhoneNumber: "+5511999999999" })).resolves.toEqual({ id: 13 });
    expect(mocks.updateWhatsAppChannelProvider).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, channelId: 13, provider: "twilio" }));
    await expect(whatsappRouter.createCaller(createContext("user")).updateChannelProvider({ clientId: 3, channelId: 13, provider: "meta_cloud" })).rejects.toThrow("restritas à equipe da agência");
  });

  it("exige conexão ativa para chave própria e limite contratado para IA VERTEX", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.savePolicy({ clientId: 3, aiAccessMode: "client_api_key", workflowMode: "draft_for_approval" })).rejects.toThrow("Selecione uma conexão de IA ativa");
    await expect(caller.savePolicy({ clientId: 3, aiAccessMode: "vertex_managed", workflowMode: "draft_for_approval" })).rejects.toThrow("Informe o limite mensal contratado");
    mocks.upsertWhatsAppAiPolicy.mockResolvedValue(22);
    await expect(caller.savePolicy({ clientId: 3, aiAccessMode: "vertex_managed", workflowMode: "draft_for_approval", monthlyManagedMessageLimit: 500, managedAiCostPerThousandCents: 120, managedAiMarkupPercent: 80, managedAiOveragePricePerThousandCents: 216 })).resolves.toEqual({ id: 22 });
    expect(mocks.upsertWhatsAppAiPolicy).toHaveBeenCalledWith(7, expect.objectContaining({ aiAccessMode: "vertex_managed", monthlyManagedMessageLimit: 500, managedAiMarkupPercent: 80 }));
  });

  it("calcula a simulação de IA VERTEX somente no cliente solicitado", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getManagedAiBillingOverview.mockResolvedValue({ aiAccessMode: "vertex_managed", quote: { overageMessages: 200, projectedOverageGrossMarginCents: 192 } });
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.managedAiBilling({ clientId: 3, projectedAdditionalMessages: 700 })).resolves.toMatchObject({ aiAccessMode: "vertex_managed", quote: { overageMessages: 200 } });
    expect(mocks.getManagedAiBillingOverview).toHaveBeenCalledWith(7, 3, 700);
  });

  it("pré-visualiza a margem com valores não salvos apenas para a equipe da agência", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getManagedAiBillingOverview.mockResolvedValue({ subscription: null, quote: { currentMonthlyMessages: 80 } });
    mocks.calculateManagedAiQuote.mockReturnValue({ totalMonthlyMessages: 1080, overageMessages: 580, projectedOverageGrossMarginCents: 125 });
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.managedAiBillingPreview({ clientId: 3, projectedAdditionalMessages: 1000, includedMonthlyMessages: 500, costPerThousandCents: 120, markupPercent: 80, overagePricePerThousandCents: 216 })).resolves.toMatchObject({ aiAccessMode: "vertex_managed", quote: { overageMessages: 580 } });
    expect(mocks.getManagedAiBillingOverview).toHaveBeenCalledWith(7, 3, 0);
    expect(mocks.calculateManagedAiQuote).toHaveBeenCalledWith(expect.objectContaining({ currentMonthlyMessages: 80, projectedAdditionalMessages: 1000, includedMonthlyMessages: 500 }));
    await expect(whatsappRouter.createCaller(createContext("user")).managedAiBillingPreview({ clientId: 3, projectedAdditionalMessages: 1, includedMonthlyMessages: 1, costPerThousandCents: 1, markupPercent: 1, overagePricePerThousandCents: 1 })).rejects.toThrow("restritas à equipe da agência");
  });

  it("cria checkout anual somente após resolver plano e cliente do workspace", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getAnnualCheckoutContext.mockResolvedValue({ plan: { id: 9, code: "pro", name: "Pro", annualPriceCents: 120000, stripePriceId: null }, client: { id: 3, name: "Globo", contactEmail: "contato@globo.test" } });
    mocks.createAnnualPlanCheckout.mockResolvedValue("https://checkout.stripe.test/session");
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.checkoutAnnualPlan({ clientId: 3, planId: 9 })).resolves.toEqual({ url: "https://checkout.stripe.test/session" });
    expect(mocks.getAnnualCheckoutContext).toHaveBeenCalledWith(7, 3, 9);
    expect(mocks.createAnnualPlanCheckout).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: 7, clientId: 3, customerEmail: "teste@example.com" }));
    await expect(whatsappRouter.createCaller(createContext("user")).checkoutAnnualPlan({ clientId: 3, planId: 9 })).rejects.toThrow("restritas à equipe da agência");
  });

  it("lista e salva o catálogo anual somente para a equipe da agência", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listAnnualSaasPlans.mockResolvedValue([{ id: 9, code: "pro", name: "Pro", annualPriceCents: 120000 }]);
    mocks.upsertAnnualSaasPlan.mockResolvedValue(9);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.annualPlans()).resolves.toEqual([{ id: 9, code: "pro", name: "Pro", annualPriceCents: 120000 }]);
    await expect(caller.saveAnnualPlan({ code: "pro", name: "Pro", annualPriceCents: 120000, includedChannels: 1, includedHumanSeats: 2, includedManagedAiMessages: 1000, managedAiCostPerThousandCents: 120, managedAiMarkupPercent: 80, managedAiOveragePricePerThousandCents: 216, isActive: true })).resolves.toEqual({ id: 9 });
    expect(mocks.upsertAnnualSaasPlan).toHaveBeenCalledWith(7, expect.objectContaining({ code: "pro", isActive: true }));
    await expect(whatsappRouter.createCaller(createContext("user")).annualPlans()).rejects.toThrow("restritas à equipe da agência");
  });

  it("bloqueia resposta automática ativa quando a regra ainda exige aprovação humana", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.saveAutomation({ clientId: 3, name: "Triagem", triggerType: "inbound_message", actionType: "ai_reply", requiresApproval: true, status: "active" })).rejects.toThrow("não pode exigir aprovação");
    mocks.upsertWhatsAppAutomationRule.mockResolvedValue(31);
    await expect(caller.saveAutomation({ clientId: 3, name: "Handoff", triggerType: "keyword", actionType: "handoff_human", requiresApproval: true, status: "active", triggerConfigJson: '{"keywords":["humano"]}' })).resolves.toEqual({ id: 31 });
    expect(mocks.upsertWhatsAppAutomationRule).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, actionType: "handoff_human" }));
  });

  it("consulta inbox e linha do tempo somente no cliente solicitado", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listWhatsAppInbox.mockResolvedValue([{ id: 41, status: "waiting_human" }]);
    mocks.listWhatsAppConversationMessages.mockResolvedValue([{ id: 99, body: "Preciso de ajuda" }]);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.inbox({ clientId: 3 })).resolves.toEqual([{ id: 41, status: "waiting_human" }]);
    await expect(caller.conversationMessages({ clientId: 3, conversationId: 41 })).resolves.toEqual([{ id: 99, body: "Preciso de ajuda" }]);
    expect(mocks.listWhatsAppInbox).toHaveBeenCalledWith(7, 3);
    expect(mocks.listWhatsAppConversationMessages).toHaveBeenCalledWith(7, 3, 41);
  });

  it("assume a revisão humana e salva somente rascunho local, sem enviar ao provedor", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.activateWhatsAppHumanHandoff.mockResolvedValue(41);
    mocks.createWhatsAppDraft.mockResolvedValue(101);
    const caller = whatsappRouter.createCaller(createContext());
    await expect(caller.assumeHumanReview({ clientId: 3, conversationId: 41 })).resolves.toEqual({ id: 41, mode: "human_review" });
    await expect(caller.saveDraft({ clientId: 3, conversationId: 41, body: "Vou verificar e retorno em breve." })).resolves.toEqual({ id: 101, externalDelivery: "disabled" });
    expect(mocks.activateWhatsAppHumanHandoff).toHaveBeenCalledWith(7, 3, 41);
    expect(mocks.createWhatsAppDraft).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, conversationId: 41 }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  completeAiGeneration: vi.fn(), createAdCampaign: vi.fn(), createAiGeneration: vi.fn(), createCreativeApproval: vi.fn(), createCreativeVersion: vi.fn(), createClientAiConnection: vi.fn(), createContentBrief: vi.fn(), createStrategyDecision: vi.fn(), createTrendSignal: vi.fn(), createVideoScript: vi.fn(), getAdCampaign: vi.fn(), getClientAgencyProfile: vi.fn(), getClientAiConnection: vi.fn(), getClientAiConnectionSecret: vi.fn(), listAdCampaigns: vi.fn(), listAgencyBriefs: vi.fn(), listClientAiConnections: vi.fn(), listClientCredentialStatuses: vi.fn(), listClientApiUsage: vi.fn(), listCreativeApprovals: vi.fn(), listCreativeVersions: vi.fn(), listStrategyDecisions: vi.fn(), listTrendSignals: vi.fn(), listVideoScripts: vi.fn(), recordClientAiConnectionTest: vi.fn(), replaceCarouselSlides: vi.fn(), setClientAiConnectionStatus: vi.fn(), updateAdCampaignStatus: vi.fn(), updateAdCampaignProvider: vi.fn(), updateClientAiConnection: vi.fn(), upsertClientAgencyProfile: vi.fn(), getOperationalUserId: vi.fn(), buildAgencyPrompt: vi.fn(), generateAgencyOutput: vi.fn(), testAgencyConnection: vi.fn(), issueConnectionVerification: vi.fn(), verifyConnectionVerification: vi.fn(),
}));

vi.mock("../db", () => mocks);
vi.mock("./helpers", () => ({ getOperationalUserId: mocks.getOperationalUserId }));
vi.mock("../aiAds/agencyGeneration", () => ({ buildAgencyPrompt: mocks.buildAgencyPrompt, generateAgencyOutput: mocks.generateAgencyOutput, testAgencyConnection: mocks.testAgencyConnection }));
vi.mock("../aiAds/connectionVerification", () => ({ issueConnectionVerification: mocks.issueConnectionVerification, verifyConnectionVerification: mocks.verifyConnectionVerification }));

import { agencyRouter } from "./agency";

function createContext(): TrpcContext {
  return { user: { id: 1, openId: "agency-test", name: "Agency Test", email: "agency@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("agency generation review contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persiste uma versão revisável após uma geração integrada", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getAdCampaign.mockResolvedValue({ campaign: { id: 11, clientId: 3, providerConnectionId: null, briefingJson: JSON.stringify({ text: "Oferta com fatos aprovados" }), name: "Campanha integrada", objective: "Gerar conversas" }, client: { name: "Globo Acabamentos" } });
    mocks.getClientAgencyProfile.mockResolvedValue(null);
    mocks.buildAgencyPrompt.mockReturnValue("prompt protegido");
    mocks.createAiGeneration.mockResolvedValue(41);
    const carousel = [{ slideNumber: 1, role: "cover", headline: "Banheiros com personalidade", body: "Uma ideia aprovada", visualDirection: "Textura mineral", imagePrompt: "Banheiro contemporâneo com porcelanato" }];
    const ads = [{ angle: "curadoria", primaryText: "Escolhas que transformam", headline: "Acabamentos para viver bem", cta: "Conheça a coleção" }];
    mocks.generateAgencyOutput.mockResolvedValue({ provider: "manus", model: "gpt-5-mini", output: { ads, carousel, strategy: null, video: null, council: null } });
    mocks.createCreativeVersion.mockResolvedValue(93);
    mocks.updateAdCampaignStatus.mockResolvedValue(undefined);
    mocks.completeAiGeneration.mockResolvedValue(undefined);

    const caller = agencyRouter.createCaller(createContext());
    const result = await caller.generate({ campaignId: 11, mode: "bundle" });

    expect(result.versionId).toBe(93);
    expect(mocks.createCreativeVersion).toHaveBeenCalledWith(7, expect.objectContaining({ campaignId: 11, generationId: 41, kind: "bundle", payloadJson: expect.any(String) }));
    const persistedVersion = mocks.createCreativeVersion.mock.calls[0][1];
    expect(JSON.parse(persistedVersion.payloadJson)).toMatchObject({ ads, carousel });
    expect(mocks.replaceCarouselSlides).toHaveBeenCalledWith(7, 11, 41, carousel);
    expect(mocks.completeAiGeneration).toHaveBeenCalledWith(7, 41, expect.objectContaining({ status: "succeeded" }));
  });

  it("registra decisões humanas e lista o histórico somente pelo contrato protegido", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listCreativeVersions.mockResolvedValue([{ id: 93, campaignId: 11, versionNumber: 1, status: "review" }]);
    mocks.createCreativeApproval.mockResolvedValue(17);

    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.versions({ campaignId: 11 })).resolves.toEqual([{ id: 93, campaignId: 11, versionNumber: 1, status: "review" }]);
    await expect(caller.approveVersion({ creativeVersionId: 93, decision: "approved", note: "Aprovado após revisão" })).resolves.toEqual({ id: 17 });
    expect(mocks.createCreativeApproval).toHaveBeenCalledWith(7, { creativeVersionId: 93, decision: "approved", note: "Aprovado após revisão" });
  });

  it("remove qualquer campo de segredo da resposta de conexões por cliente", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getClientAgencyProfile.mockResolvedValue(null);
    mocks.listClientAiConnections.mockResolvedValue([{ id: 4, clientId: 3, label: "OpenAI do cliente", provider: "openai", defaultModel: "gpt-5-mini", keyHint: "••••1234", encryptedApiKey: "ciphertext", apiKey: "sk-supersecret-1234", secret: "internal-only" }]);
    mocks.listAdCampaigns.mockResolvedValue([]);
    mocks.listAgencyBriefs.mockResolvedValue([]);
    mocks.listTrendSignals.mockResolvedValue([]);
    mocks.listVideoScripts.mockResolvedValue([]);
    mocks.listStrategyDecisions.mockResolvedValue([]);

    const caller = agencyRouter.createCaller(createContext());
    const overview = await caller.overview({ clientId: 3 });

    expect(overview.connections).toEqual([{ id: 4, clientId: 3, label: "OpenAI do cliente", provider: "openai", defaultModel: "gpt-5-mini", keyHint: "••••1234" }]);
    expect(JSON.stringify(overview)).not.toContain("ciphertext");
    expect(JSON.stringify(overview)).not.toContain("sk-supersecret-1234");
    expect(JSON.stringify(overview)).not.toContain("internal-only");
  });

  it("permite atualizar a configuração e suspender uma conexão sem devolver sua chave", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.updateClientAiConnection.mockResolvedValue(4);
    mocks.setClientAiConnectionStatus.mockResolvedValue(4);
    mocks.getClientAiConnection.mockResolvedValue({ id: 4, provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5-mini" });

    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.updateProvider({ connectionId: 4, label: "OpenAI da criação", provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5-mini", defaultImageModel: null })).resolves.toEqual({ id: 4 });
    await expect(caller.setProviderStatus({ connectionId: 4, status: "disabled" })).resolves.toEqual({ id: 4 });

    expect(mocks.updateClientAiConnection).toHaveBeenCalledWith(7, 4, expect.objectContaining({ label: "OpenAI da criação", provider: "openai", defaultModel: "gpt-5-mini" }));
    expect(mocks.setClientAiConnectionStatus).toHaveBeenCalledWith(7, 4, "disabled");
  });

  it("bloqueia a geração quando a campanha está vinculada a uma conexão desativada", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getAdCampaign.mockResolvedValue({ campaign: { id: 11, clientId: 3, providerConnectionId: 4, briefingJson: JSON.stringify({ text: "Briefing aprovado" }), name: "Campanha vinculada", objective: "Gerar conversas" }, client: { name: "Globo Acabamentos" }, connection: { id: 4, status: "disabled" } });

    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.generate({ campaignId: 11, mode: "ads" })).rejects.toThrow("conexão de IA desta campanha está desativada");
    expect(mocks.createAiGeneration).not.toHaveBeenCalled();
    expect(mocks.generateAgencyOutput).not.toHaveBeenCalled();
  });

  it("testa uma chave sem persistir o segredo e troca apenas o vínculo do provedor da campanha", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.testAgencyConnection.mockResolvedValue({ provider: "openai", message: "Conexão validada." });
    mocks.issueConnectionVerification.mockReturnValue("proof-token");
    mocks.updateAdCampaignProvider.mockResolvedValue(11);
    const caller = agencyRouter.createCaller(createContext());

    await expect(caller.testProviderConnection({ provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5-mini", apiKey: "sk-test-secret" })).resolves.toEqual({ provider: "openai", message: "Conexão validada.", verificationToken: "proof-token" });
    await expect(caller.updateCampaignProvider({ campaignId: 11, providerConnectionId: 4 })).resolves.toEqual({ id: 11 });

    expect(mocks.testAgencyConnection).toHaveBeenCalledWith(expect.objectContaining({ provider: "openai", apiKey: "sk-test-secret" }));
    expect(mocks.createClientAiConnection).not.toHaveBeenCalled();
    expect(mocks.updateAdCampaignProvider).toHaveBeenCalledWith(7, 11, 4);
  });

  it("registra a data do teste somente para a configuração salva da conexão", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getClientAiConnection.mockResolvedValue({ id: 4, provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5-mini" });
    mocks.testAgencyConnection.mockResolvedValue({ provider: "openai", message: "Conexão validada." });
    mocks.issueConnectionVerification.mockReturnValue("proof-token");
    const caller = agencyRouter.createCaller(createContext());

    await expect(caller.testProviderConnection({ connectionId: 4, provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5-mini", apiKey: "sk-test-secret" })).resolves.toEqual({ provider: "openai", message: "Conexão validada.", verificationToken: "proof-token" });
    expect(mocks.recordClientAiConnectionTest).toHaveBeenCalledWith(7, 4);
    await expect(caller.testProviderConnection({ connectionId: 4, provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5", apiKey: "sk-test-secret" })).rejects.toThrow("Salve a nova configuração");
    expect(mocks.recordClientAiConnectionTest).toHaveBeenCalledTimes(1);
  });

  it("bloqueia a troca de modelo em uma conexão existente sem uma nova chave validada", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getClientAiConnection.mockResolvedValue({ id: 4, provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5-mini" });
    const caller = agencyRouter.createCaller(createContext());

    await expect(caller.updateProvider({ connectionId: 4, label: "OpenAI da criação", provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5", defaultImageModel: null })).rejects.toThrow("Informe e teste uma nova chave");
    expect(mocks.updateClientAiConnection).not.toHaveBeenCalled();
  });

  it("retorna somente indicadores agregados de credenciais por cliente", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listClientCredentialStatuses.mockResolvedValue([{ id: 3, name: "Globo Acabamentos", activeCount: 1, disabledCount: 0, status: "active" }]);
    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.credentialStatuses()).resolves.toEqual([{ id: 3, name: "Globo Acabamentos", activeCount: 1, disabledCount: 0, status: "active" }]);
    expect(JSON.stringify(mocks.listClientCredentialStatuses.mock.results)).not.toContain("encryptedApiKey");
  });

  it("expõe o consumo de cada cliente sem inventar custo quando não há telemetria oficial", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listClientApiUsage.mockResolvedValue([{ id: 3, name: "Globo Acabamentos", requestCount: 2, successfulCount: 1, failedCount: 1, inputTokens: 18, outputTokens: 12, totalTokens: 30, averageDurationMs: 840, telemetryAvailable: true, costStatus: "unavailable", lastUsedAt: new Date("2026-08-20T12:00:00Z") }]);
    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.usageByClient()).resolves.toMatchObject([{ id: 3, totalTokens: 30, costStatus: "unavailable" }]);
    expect(mocks.listClientApiUsage).toHaveBeenCalledWith(7);
  });
});

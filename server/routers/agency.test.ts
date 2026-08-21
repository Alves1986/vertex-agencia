import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  completeAiGeneration: vi.fn(), createAdCampaign: vi.fn(), createAiGeneration: vi.fn(), createCreativeApproval: vi.fn(), createCreativeVersion: vi.fn(), createClientAiConnection: vi.fn(), createContentBrief: vi.fn(), createStrategyDecision: vi.fn(), createTrendSignal: vi.fn(), createVideoScript: vi.fn(), getAdCampaign: vi.fn(), getClientAgencyProfile: vi.fn(), getClientAiConnection: vi.fn(), getClientAiConnectionSecret: vi.fn(), listAdCampaigns: vi.fn(), listAgencyBriefs: vi.fn(), listClientAiConnections: vi.fn(), listClientCredentialStatuses: vi.fn(), listClientApiUsage: vi.fn(), listCreativeApprovals: vi.fn(), listCampaignApprovalHistory: vi.fn(), listCreativeVersions: vi.fn(), listStrategyDecisions: vi.fn(), listTrendSignals: vi.fn(), listVideoScripts: vi.fn(), recordClientAiConnectionTest: vi.fn(), recordApprovalHistoryEmailDelivery: vi.fn(), replaceCarouselSlides: vi.fn(), setClientAiConnectionStatus: vi.fn(), updateAdCampaignStatus: vi.fn(), updateAdCampaignProvider: vi.fn(), updateClientAiConnection: vi.fn(), updateClientMonthlyApiCallLimit: vi.fn(), upsertClientAgencyProfile: vi.fn(), listCarouselBriefTemplates: vi.fn(), createCarouselBriefTemplate: vi.fn(), deleteCarouselBriefTemplate: vi.fn(), listClientBrandAssets: vi.fn(), createClientBrandAsset: vi.fn(), setClientBrandAssetStatus: vi.fn(), listClientBrandAssetCollections: vi.fn(), createClientBrandAssetCollection: vi.fn(), updateClientBrandAssetCollection: vi.fn(), deleteClientBrandAssetCollection: vi.fn(), setClientBrandAssetCollection: vi.fn(), listCarouselSlides: vi.fn(), approveCarouselSlidesBatch: vi.fn(), createApprovalHistoryExport: vi.fn(), sendApprovalHistoryReportEmail: vi.fn(), getOperationalUserId: vi.fn(), buildAgencyPrompt: vi.fn(), generateAgencyOutput: vi.fn(), testAgencyConnection: vi.fn(), issueConnectionVerification: vi.fn(), verifyConnectionVerification: vi.fn(), storagePut: vi.fn(),
}));

vi.mock("../db", () => mocks);
vi.mock("./helpers", () => ({ getOperationalUserId: mocks.getOperationalUserId }));
vi.mock("../aiAds/agencyGeneration", () => ({ buildAgencyPrompt: mocks.buildAgencyPrompt, generateAgencyOutput: mocks.generateAgencyOutput, testAgencyConnection: mocks.testAgencyConnection }));
vi.mock("../aiAds/connectionVerification", () => ({ issueConnectionVerification: mocks.issueConnectionVerification, verifyConnectionVerification: mocks.verifyConnectionVerification }));
vi.mock("../storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("../exports/approvalHistoryExport", () => ({ createApprovalHistoryExport: mocks.createApprovalHistoryExport }));
vi.mock("../email/approvalHistoryReportMailer", () => ({ sendApprovalHistoryReportEmail: mocks.sendApprovalHistoryReportEmail }));

import { agencyRouter } from "./agency";

function createContext(): TrpcContext {
  return { user: { id: 1, openId: "agency-test", name: "Agency Test", email: "agency@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("agency generation review contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expõe o histórico de aprovações somente para a campanha solicitada pelo usuário operacional", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listCampaignApprovalHistory.mockResolvedValue([{ id: 18, creativeVersionId: 12, reviewerUserId: 7, reviewerName: "Anderson Alves", decision: "approved", note: "Narrativa revisada", source: "carousel_batch", slideNumbers: [1, 2, 3], createdAt: new Date("2026-08-21T12:00:00.000Z") }]);

    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.approvalHistory({ campaignId: 44, reviewerUserId: 7, decision: "approved", startDate: "2026-08-01", endDate: "2026-08-31" })).resolves.toMatchObject([{ source: "carousel_batch", slideNumbers: [1, 2, 3], reviewerName: "Anderson Alves" }]);
    expect(mocks.listCampaignApprovalHistory).toHaveBeenCalledWith(7, 44, { reviewerUserId: 7, decision: "approved", startDate: "2026-08-01", endDate: "2026-08-31" });
  });

  it("exporta somente o histórico filtrado da campanha pertencente ao usuário operacional", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getAdCampaign.mockResolvedValue({ campaign: { id: 44, name: "Carrossel de acabamentos" }, client: { name: "Globo Acabamentos" } });
    const entries = [{ id: 18, creativeVersionId: 12, reviewerUserId: 7, reviewerName: "Anderson Alves", decision: "approved", note: "Narrativa revisada", source: "carousel_batch", slideNumbers: [1, 2, 3], createdAt: new Date("2026-08-21T12:00:00.000Z") }];
    mocks.listCampaignApprovalHistory.mockResolvedValue(entries);
    mocks.createApprovalHistoryExport.mockResolvedValue({ fileName: "historico.csv", mimeType: "text/csv;charset=utf-8", contentBase64: "YQ==", recordCount: 1 });

    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.exportApprovalHistory({ campaignId: 44, reviewerUserId: 7, decision: "approved", startDate: "2026-08-01", endDate: "2026-08-31", format: "csv" })).resolves.toMatchObject({ fileName: "historico.csv", recordCount: 1 });
    expect(mocks.listCampaignApprovalHistory).toHaveBeenLastCalledWith(7, 44, { reviewerUserId: 7, decision: "approved", startDate: "2026-08-01", endDate: "2026-08-31" });
    expect(mocks.createApprovalHistoryExport).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 44, campaignName: "Carrossel de acabamentos", format: "csv", entries, filters: expect.objectContaining({ decision: "approved" }) }));
  });

  it("envia o PDF somente ao contato cadastrado da campanha e audita a tentativa", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.getAdCampaign.mockResolvedValue({ campaign: { id: 44, name: "Carrossel de acabamentos" }, client: { id: 3, name: "Globo Acabamentos", contactName: "Contato Globo", contactEmail: "contato@globoacabamentos.com.br" } });
    mocks.listCampaignApprovalHistory.mockResolvedValue([{ id: 18, creativeVersionId: 12, reviewerUserId: 7, reviewerName: "Anderson Alves", decision: "approved", note: "Narrativa revisada", source: "carousel_batch", slideNumbers: [1, 2, 3], createdAt: new Date("2026-08-21T12:00:00.000Z") }]);
    mocks.createApprovalHistoryExport.mockResolvedValue({ fileName: "historico.pdf", mimeType: "application/pdf", contentBase64: "cGRm", recordCount: 1 });
    mocks.sendApprovalHistoryReportEmail.mockResolvedValue({ messageId: "re_msg_1", subject: "Relatório de aprovações — Carrossel de acabamentos" });
    const caller = agencyRouter.createCaller(createContext());

    await expect(caller.sendApprovalHistoryReport({ campaignId: 44, decision: "approved" })).resolves.toMatchObject({ recipientEmail: "contato@globoacabamentos.com.br", recordCount: 1 });
    expect(mocks.sendApprovalHistoryReportEmail).toHaveBeenCalledWith(expect.objectContaining({ recipientEmail: "contato@globoacabamentos.com.br", report: expect.objectContaining({ fileName: "historico.pdf" }) }));
    expect(mocks.recordApprovalHistoryEmailDelivery).toHaveBeenCalledWith(7, expect.objectContaining({ campaignId: 44, status: "sent", providerMessageId: "re_msg_1" }));
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

  it("preserva o modo de serviço guiado no briefing e o devolve para retomar a criação correta", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createAdCampaign.mockResolvedValue(31);
    mocks.getClientAgencyProfile.mockResolvedValue(null);
    mocks.listClientAiConnections.mockResolvedValue([]);
    mocks.listAdCampaigns.mockResolvedValue([
      { campaign: { id: 31, clientId: 3, mode: "bundle", briefingJson: JSON.stringify({ text: "Briefing de roteiro", generationMode: "video", serviceKey: "video" }) }, client: { name: "Globo Acabamentos" }, connection: null },
      { campaign: { id: 32, clientId: 3, mode: "ads", briefingJson: "Briefing legado" }, client: { name: "Globo Acabamentos" }, connection: null },
    ]);
    mocks.listAgencyBriefs.mockResolvedValue([]);
    mocks.listTrendSignals.mockResolvedValue([]);
    mocks.listVideoScripts.mockResolvedValue([]);
    mocks.listStrategyDecisions.mockResolvedValue([]);

    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.createCampaign({ clientId: 3, name: "Roteiro de lançamento", objective: "Apresentar coleção", briefing: "Gancho e cenas aprovadas para o vídeo", mode: "bundle", generationMode: "video", serviceKey: "video" })).resolves.toEqual({ id: 31 });
    const overview = await caller.overview({ clientId: 3 });

    expect(mocks.createAdCampaign).toHaveBeenCalledWith(7, expect.objectContaining({ mode: "bundle", briefingJson: expect.stringContaining('"generationMode":"video"') }));
    expect(overview.campaigns.map(item => item.generationMode)).toEqual(["video", "ads"]);
  });

  it("ativa a capacidade de carrossel do serviço guiado e persiste seus slides para revisão", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createAdCampaign.mockResolvedValue(44);
    mocks.getAdCampaign.mockResolvedValue({ campaign: { id: 44, clientId: 3, providerConnectionId: null, briefingJson: JSON.stringify({ text: "Narrativa de 6 slides", generationMode: "carousel", serviceKey: "carousel" }), name: "Carrossel de acabamentos", objective: "Gerar salvamentos" }, client: { name: "Globo Acabamentos" } });
    mocks.getClientAgencyProfile.mockResolvedValue(null);
    mocks.buildAgencyPrompt.mockReturnValue("prompt de carrossel");
    mocks.createAiGeneration.mockResolvedValue(54);
    const carousel = [{ slideNumber: 1, role: "cover", headline: "Escolha seu acabamento", body: "Comece pela necessidade", visualDirection: "Tons minerais", imagePrompt: "Ambiente contemporâneo" }];
    mocks.generateAgencyOutput.mockResolvedValue({ provider: "manus", model: "gpt-5-mini", output: { ads: [], carousel, strategy: null, video: null, council: null } });
    mocks.createCreativeVersion.mockResolvedValue(94);
    mocks.updateAdCampaignStatus.mockResolvedValue(undefined);
    mocks.completeAiGeneration.mockResolvedValue(undefined);

    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.createCampaign({ clientId: 3, name: "Carrossel de acabamentos", objective: "Gerar salvamentos", briefing: "Narrativa de 6 slides com visual mineral", mode: "carousel", generationMode: "carousel", serviceKey: "carousel" })).resolves.toEqual({ id: 44 });
    await expect(caller.generate({ campaignId: 44, mode: "carousel" })).resolves.toMatchObject({ generationId: 54, versionId: 94 });

    expect(mocks.createAdCampaign).toHaveBeenCalledWith(7, expect.objectContaining({ mode: "carousel", briefingJson: expect.stringContaining('"serviceKey":"carousel"') }));
    expect(mocks.createAiGeneration).toHaveBeenCalledWith(7, expect.objectContaining({ campaignId: 44, kind: "carousel" }));
    expect(mocks.replaceCarouselSlides).toHaveBeenCalledWith(7, 44, 54, carousel);
    expect(mocks.createCreativeVersion).toHaveBeenCalledWith(7, expect.objectContaining({ campaignId: 44, kind: "carousel" }));
  });

  it("persiste uma prévia editável como versão revisável antes da geração final", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createCreativeVersion.mockResolvedValue(121);
    const slides = [
      { slideNumber: 1, role: "cover", headline: "Guia de acabamentos", body: "Comece pelo uso", visualDirection: "Texturas naturais", imagePrompt: "Capa editorial" },
      { slideNumber: 2, role: "context", headline: "Compare materiais", body: "Avalie resistência", visualDirection: "Texturas naturais", imagePrompt: "Comparativo editorial" },
      { slideNumber: 3, role: "cta", headline: "Solicite o catálogo", body: "Conte com a VERTEX", visualDirection: "Texturas naturais", imagePrompt: "CTA editorial" },
    ];
    const caller = agencyRouter.createCaller(createContext());

    await expect(caller.saveCarouselPreview({ campaignId: 44, slides })).resolves.toEqual({ id: 121 });
    expect(mocks.createCreativeVersion).toHaveBeenCalledWith(7, expect.objectContaining({ campaignId: 44, kind: "carousel", summary: expect.stringContaining("Prévia editável") }));
    expect(JSON.parse(mocks.createCreativeVersion.mock.calls[0][1].payloadJson)).toMatchObject({ source: "manual_preview", slides });
  });

  it("salva e consulta modelos e ativos dentro do cliente solicitado", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createCarouselBriefTemplate.mockResolvedValue(32);
    mocks.listCarouselBriefTemplates.mockResolvedValue([{ id: 32, clientId: 3, name: "Institucional", fieldsJson: "{}" }]);
    mocks.storagePut.mockResolvedValue({ key: "brand-assets/client-3/logo.png", url: "https://storage.example/logo.png" });
    mocks.createClientBrandAsset.mockResolvedValue(65);
    mocks.listClientBrandAssets.mockResolvedValue([{ id: 65, clientId: 3, name: "Logo aprovado", status: "authorized" }]);
    const caller = agencyRouter.createCaller(createContext());

    await expect(caller.saveCarouselTemplate({ clientId: 3, name: "Institucional", fields: { keyMessage: "Escolha com confiança", audience: "Arquitetos" } })).resolves.toEqual({ id: 32 });
    await expect(caller.carouselTemplates({ clientId: 3 })).resolves.toEqual([{ id: 32, clientId: 3, name: "Institucional", fieldsJson: "{}" }]);
    await expect(caller.uploadBrandAsset({ clientId: 3, name: "Logo aprovado", assetType: "logo", mimeType: "image/png", contentBase64: "aGVsbG8gd29ybGQgYnJhbmQgYXNzZXQ=" })).resolves.toEqual({ id: 65 });
    await expect(caller.brandAssets({ clientId: 3 })).resolves.toEqual([{ id: 65, clientId: 3, name: "Logo aprovado", status: "authorized" }]);

    expect(mocks.createCarouselBriefTemplate).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, name: "Institucional" }));
    expect(mocks.listCarouselBriefTemplates).toHaveBeenCalledWith(7, 3);
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringContaining("brand-assets/client-3/"), expect.any(Buffer), "image/png");
    expect(mocks.createClientBrandAsset).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, name: "Logo aprovado", assetType: "logo" }));
    expect(mocks.listClientBrandAssets).toHaveBeenCalledWith(7, 3);
  });

  it("mantém coleções, ativos e aprovação em lote restritos ao cliente e à versão selecionados", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createClientBrandAssetCollection.mockResolvedValue(81);
    mocks.listClientBrandAssetCollections.mockResolvedValue([{ id: 81, clientId: 3, name: "Identidade 2026", description: "Logo e aplicações" }]);
    mocks.setClientBrandAssetCollection.mockResolvedValue(65);
    mocks.listCarouselSlides.mockResolvedValue([{ id: 301, slideNumber: 1, headline: "Capa" }, { id: 302, slideNumber: 2, headline: "Contexto" }]);
    mocks.approveCarouselSlidesBatch.mockResolvedValue({ approvalId: 501, approvedSlides: 2, status: "approved" });
    const caller = agencyRouter.createCaller(createContext());

    await expect(caller.createBrandAssetCollection({ clientId: 3, name: "Identidade 2026", description: "Logo e aplicações" })).resolves.toEqual({ id: 81 });
    await expect(caller.brandAssetCollections({ clientId: 3 })).resolves.toEqual([{ id: 81, clientId: 3, name: "Identidade 2026", description: "Logo e aplicações" }]);
    await expect(caller.setBrandAssetCollection({ clientId: 3, assetId: 65, collectionId: 81 })).resolves.toEqual({ id: 65 });
    await expect(caller.carouselSlides({ campaignId: 44 })).resolves.toHaveLength(2);
    await expect(caller.approveCarouselSlidesBatch({ clientId: 3, creativeVersionId: 121, slideNumbers: [1, 2], note: "Aprovação do responsável" })).resolves.toEqual({ approvalId: 501, approvedSlides: 2, status: "approved" });

    expect(mocks.createClientBrandAssetCollection).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, name: "Identidade 2026" }));
    expect(mocks.setClientBrandAssetCollection).toHaveBeenCalledWith(7, { clientId: 3, assetId: 65, collectionId: 81 });
    expect(mocks.listCarouselSlides).toHaveBeenCalledWith(7, 44);
    expect(mocks.approveCarouselSlidesBatch).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, creativeVersionId: 121, slideNumbers: [1, 2] }));
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

  it("expõe o consumo de cada cliente nos períodos de 7, 15 e 30 dias sem inventar custo", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.listClientApiUsage.mockResolvedValue([{ id: 3, name: "Globo Acabamentos", requestCount: 2, successfulCount: 1, failedCount: 1, inputTokens: 18, outputTokens: 12, totalTokens: 30, averageDurationMs: 840, telemetryAvailable: true, costStatus: "unavailable", lastUsedAt: new Date("2026-08-20T12:00:00Z") }]);
    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.usageByClient({ periodDays: 7 })).resolves.toMatchObject([{ id: 3, totalTokens: 30, costStatus: "unavailable" }]);
    await expect(caller.usageByClient({ periodDays: 15 })).resolves.toMatchObject([{ id: 3, totalTokens: 30, costStatus: "unavailable" }]);
    await expect(caller.usageByClient({ periodDays: 30 })).resolves.toMatchObject([{ id: 3, totalTokens: 30, costStatus: "unavailable" }]);
    expect(mocks.listClientApiUsage).toHaveBeenNthCalledWith(1, 7, 7);
    expect(mocks.listClientApiUsage).toHaveBeenNthCalledWith(2, 7, 15);
    expect(mocks.listClientApiUsage).toHaveBeenNthCalledWith(3, 7, 30);
  });

  it("salva ou remove o limite mensal somente para um cliente do workspace", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.updateClientMonthlyApiCallLimit.mockResolvedValue(3);
    const caller = agencyRouter.createCaller(createContext());
    await expect(caller.setMonthlyApiLimit({ clientId: 3, monthlyApiCallLimit: 500 })).resolves.toBe(3);
    await expect(caller.setMonthlyApiLimit({ clientId: 3, monthlyApiCallLimit: null })).resolves.toBe(3);
    expect(mocks.updateClientMonthlyApiCallLimit).toHaveBeenNthCalledWith(1, 7, 3, 500);
    expect(mocks.updateClientMonthlyApiCallLimit).toHaveBeenNthCalledWith(2, 7, 3, null);
  });
});

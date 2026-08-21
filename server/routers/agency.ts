import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  completeAiGeneration,
  createAdCampaign,
  createAiGeneration,
  createCarouselBriefTemplate,
  createClientBrandAssetCollection,
  createClientBrandAsset,
  createCreativeApproval,
  createCreativeVersion,
  createClientAiConnection,
  createContentBrief,
  createStrategyDecision,
  createTrendSignal,
  createVideoScript,
  getAdCampaign,
  getClientAgencyProfile,
  getClientAiConnection,
  getClientAiConnectionSecret,
  listAdCampaigns,
  listAgencyBriefs,
  listCarouselBriefTemplates,
  listCarouselSlides,
  listClientBrandAssetCollections,
  listClientBrandAssets,
  listClientAiConnections,
  listClientCredentialStatuses,
  listClientApiUsage,
  listCampaignApprovalHistory,
  recordClientAiConnectionTest,
  listCreativeApprovals,
  listCreativeVersions,
  listStrategyDecisions,
  listTrendSignals,
  listVideoScripts,
  replaceCarouselSlides,
  deleteCarouselBriefTemplate,
  deleteClientBrandAssetCollection,
  approveCarouselSlidesBatch,
  setClientAiConnectionStatus,
  setClientBrandAssetCollection,
  setClientBrandAssetStatus,
  updateAdCampaignStatus,
  updateAdCampaignProvider,
  updateClientBrandAssetCollection,
  updateClientAiConnection,
  updateClientMonthlyApiCallLimit,
  upsertClientAgencyProfile,
} from "../db";
import { storagePut } from "../storage";
import { encryptProviderKey, getKeyHint } from "../aiAds/crypto";
import { buildAgencyPrompt, generateAgencyOutput, testAgencyConnection, type AgencyGenerationMode } from "../aiAds/agencyGeneration";
import { issueConnectionVerification, verifyConnectionVerification } from "../aiAds/connectionVerification";
import { getOperationalUserId } from "./helpers";

const providerSchema = z.enum(["manus", "openai", "openai_compatible", "gemini", "anthropic"]);
const modeSchema = z.enum(["ads", "carousel", "bundle", "strategy", "video", "council"]);
const profileSchema = z.object({ clientId: z.number().int().positive(), positioning: z.string().max(4000).optional().nullable(), voice: z.string().max(240).optional().nullable(), audience: z.string().max(4000).optional().nullable(), offers: z.string().max(4000).optional().nullable(), proofPolicy: z.string().max(4000).optional().nullable(), visualSystem: z.string().max(4000).optional().nullable(), departmentContextJson: z.string().max(12000).optional().nullable() });
const carouselSlideSchema = z.object({ slideNumber: z.number().int().min(1).max(10), role: z.enum(["cover", "context", "insight", "proof", "solution", "cta"]), headline: z.string().trim().min(1).max(500), body: z.string().max(2000).optional().nullable(), visualDirection: z.string().max(2000).optional().nullable(), imagePrompt: z.string().max(2000).optional().nullable() });
const carouselFieldsSchema = z.object({ keyMessage: z.string().max(4000).optional(), audience: z.string().max(2000).optional(), slideCount: z.string().max(4).optional(), format: z.string().max(240).optional(), visualDirection: z.string().max(4000).optional(), callToAction: z.string().max(1200).optional(), assetIds: z.array(z.number().int().positive()).max(20).optional() });

function toCampaignMode(mode: AgencyGenerationMode) {
  return mode === "carousel" ? "carousel" : mode === "ads" ? "ads" : "bundle" as const;
}

function toCreativeKind(mode: AgencyGenerationMode) {
  return mode === "ads" ? "ads" : mode === "carousel" ? "carousel" : mode === "video" ? "video" : mode === "strategy" || mode === "council" ? "strategy" : "bundle" as const;
}

function getStoredGenerationMode(briefingJson: string, fallback: "ads" | "carousel" | "bundle"): AgencyGenerationMode {
  try {
    const parsed = JSON.parse(briefingJson) as { generationMode?: unknown };
    if (parsed.generationMode === "ads" || parsed.generationMode === "carousel" || parsed.generationMode === "bundle" || parsed.generationMode === "strategy" || parsed.generationMode === "video" || parsed.generationMode === "council") return parsed.generationMode;
  } catch {
    // Campanhas anteriores podem conter texto puro; o modo persistido continua sendo seguro.
  }
  return fallback;
}

function toPublicConnection<T extends object>(connection: T): T {
  const publicConnection = { ...connection } as T & { encryptedApiKey?: unknown; apiKey?: unknown; secret?: unknown };
  delete publicConnection.encryptedApiKey;
  delete publicConnection.apiKey;
  delete publicConnection.secret;
  return publicConnection;
}

function toPublicCampaign<T extends { connection?: object | null }>(item: T): T {
  return {
    ...item,
    connection: item.connection ? toPublicConnection(item.connection) : item.connection,
  };
}

export const agencyRouter = router({
  overview: protectedProcedure.input(z.object({ clientId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const [profile, connections, campaigns, briefs, trends, videos, decisions] = await Promise.all([
      getClientAgencyProfile(userId, input.clientId), listClientAiConnections(userId, input.clientId), listAdCampaigns(userId, input.clientId), listAgencyBriefs(userId, input.clientId), listTrendSignals(userId, input.clientId), listVideoScripts(userId, input.clientId), listStrategyDecisions(userId, input.clientId),
    ]);
    return {
      profile,
      connections: connections.map(toPublicConnection),
      campaigns: campaigns.map(item => ({ ...toPublicCampaign(item), generationMode: getStoredGenerationMode(item.campaign.briefingJson, item.campaign.mode) })),
      briefs,
      trends,
      videos,
      decisions,
    };
  }),

  credentialStatuses: protectedProcedure.query(async ({ ctx }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listClientCredentialStatuses(userId);
  }),

  usageByClient: protectedProcedure.input(z.object({ periodDays: z.union([z.literal(7), z.literal(15), z.literal(30)]).default(30) }).default({ periodDays: 30 })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listClientApiUsage(userId, input.periodDays);
  }),

  setMonthlyApiLimit: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), monthlyApiCallLimit: z.number().int().min(1).max(10_000_000).nullable() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return updateClientMonthlyApiCallLimit(userId, input.clientId, input.monthlyApiCallLimit);
  }),

  saveProfile: protectedProcedure.input(profileSchema).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return upsertClientAgencyProfile(userId, input);
  }),

  carouselTemplates: protectedProcedure.input(z.object({ clientId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listCarouselBriefTemplates(userId, input.clientId);
  }),

  saveCarouselTemplate: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), name: z.string().trim().min(2).max(180), description: z.string().trim().max(500).optional(), fields: carouselFieldsSchema })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createCarouselBriefTemplate(userId, { clientId: input.clientId, name: input.name, description: input.description || null, fieldsJson: JSON.stringify(input.fields) }) };
  }),

  deleteCarouselTemplate: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), templateId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await deleteCarouselBriefTemplate(userId, input) };
  }),

  brandAssets: protectedProcedure.input(z.object({ clientId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listClientBrandAssets(userId, input.clientId);
  }),

  uploadBrandAsset: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), name: z.string().trim().min(2).max(220), assetType: z.enum(["logo", "product", "reference", "palette", "other"]), mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]), contentBase64: z.string().min(20).max(7_000_000) })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const raw = Buffer.from(input.contentBase64, "base64");
    if (!raw.length || raw.length > 5 * 1024 * 1024) throw new Error("Envie uma imagem válida de até 5 MB.");
    const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/webp" ? "webp" : "gif";
    const safeName = input.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "referencia";
    const stored = await storagePut(`brand-assets/client-${input.clientId}/${Date.now()}-${safeName}.${extension}`, raw, input.mimeType);
    return { id: await createClientBrandAsset(userId, { clientId: input.clientId, name: input.name, assetType: input.assetType, storageKey: stored.key, assetUrl: stored.url, mimeType: input.mimeType, byteSize: raw.length }) };
  }),

  setBrandAssetStatus: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), assetId: z.number().int().positive(), status: z.enum(["authorized", "archived"]) })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await setClientBrandAssetStatus(userId, input) };
  }),

  brandAssetCollections: protectedProcedure.input(z.object({ clientId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listClientBrandAssetCollections(userId, input.clientId);
  }),

  createBrandAssetCollection: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), name: z.string().trim().min(2).max(160), description: z.string().trim().max(700).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createClientBrandAssetCollection(userId, { ...input, description: input.description || null }) };
  }),

  updateBrandAssetCollection: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), collectionId: z.number().int().positive(), name: z.string().trim().min(2).max(160), description: z.string().trim().max(700).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await updateClientBrandAssetCollection(userId, { ...input, description: input.description || null }) };
  }),

  deleteBrandAssetCollection: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), collectionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await deleteClientBrandAssetCollection(userId, input) };
  }),

  setBrandAssetCollection: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), assetId: z.number().int().positive(), collectionId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await setClientBrandAssetCollection(userId, input) };
  }),

  connectProvider: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), label: z.string().trim().min(2).max(120), provider: providerSchema, apiBaseUrl: z.string().url().max(1200).optional().nullable(), defaultModel: z.string().trim().min(1).max(180), defaultImageModel: z.string().max(180).optional().nullable(), apiKey: z.string().min(8).max(1200).optional(), verificationToken: z.string().min(20).max(4000).optional() })).mutation(async ({ ctx, input }) => {
    if (input.provider !== "manus" && !input.apiKey) throw new Error("Informe a chave de API do provedor selecionado");
    const userId = await getOperationalUserId(ctx.user);
    const apiKey = input.apiKey?.trim();
    if (input.provider !== "manus" && (!apiKey || !verifyConnectionVerification(userId, { provider: input.provider, apiBaseUrl: input.apiBaseUrl || null, defaultModel: input.defaultModel, apiKey }, input.verificationToken))) throw new Error("Teste a chave desta configuração antes de salvar.");
    const id = await createClientAiConnection(userId, { ...input, encryptedApiKey: apiKey ? encryptProviderKey(apiKey) : null, keyHint: apiKey ? getKeyHint(apiKey) : "integrado", lastTestedAt: input.provider === "manus" || apiKey ? new Date() : null });
    return { id };
  }),

  updateProvider: protectedProcedure.input(z.object({ connectionId: z.number().int().positive(), label: z.string().trim().min(2).max(120), provider: providerSchema, apiBaseUrl: z.string().url().max(1200).optional().nullable(), defaultModel: z.string().trim().min(1).max(180), defaultImageModel: z.string().max(180).optional().nullable(), apiKey: z.string().trim().min(8).max(1200).optional(), verificationToken: z.string().min(20).max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const apiKey = input.apiKey?.trim();
    const existing = await getClientAiConnection(userId, input.connectionId);
    if (!existing) throw new Error("Conexão não encontrada");
    const configChanged = existing.provider !== input.provider || (existing.apiBaseUrl || null) !== (input.apiBaseUrl || null) || existing.defaultModel !== input.defaultModel;
    if (input.provider !== "manus" && ((configChanged && !apiKey) || (apiKey && !verifyConnectionVerification(userId, { provider: input.provider, apiBaseUrl: input.apiBaseUrl || null, defaultModel: input.defaultModel, apiKey }, input.verificationToken)))) throw new Error(configChanged && !apiKey ? "Informe e teste uma nova chave ao trocar provedor, URL ou modelo." : "Teste a chave desta configuração antes de salvar.");
    const id = await updateClientAiConnection(userId, input.connectionId, {
      label: input.label,
      provider: input.provider,
      apiBaseUrl: input.apiBaseUrl,
      defaultModel: input.defaultModel,
      defaultImageModel: input.defaultImageModel,
      ...(apiKey ? { encryptedApiKey: encryptProviderKey(apiKey), keyHint: getKeyHint(apiKey), lastTestedAt: new Date() } : {}),
    });
    return { id };
  }),

  setProviderStatus: protectedProcedure.input(z.object({ connectionId: z.number().int().positive(), status: z.enum(["active", "disabled"]) })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await setClientAiConnectionStatus(userId, input.connectionId, input.status) };
  }),

  testProviderConnection: protectedProcedure.input(z.object({ connectionId: z.number().int().positive().optional(), provider: providerSchema, apiBaseUrl: z.string().url().max(1200).optional().nullable(), defaultModel: z.string().trim().min(1).max(180), apiKey: z.string().trim().min(8).max(1200).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    if (input.connectionId) {
      const connection = await getClientAiConnection(userId, input.connectionId);
      if (!connection) throw new Error("Conexão não encontrada");
      const configurationMatches = connection.provider === input.provider && (connection.apiBaseUrl || null) === (input.apiBaseUrl || null) && connection.defaultModel === input.defaultModel;
      if (!configurationMatches) throw new Error("Salve a nova configuração após testá-la para registrar esta validação.");
    }
    const result = await testAgencyConnection({ provider: input.provider, apiBaseUrl: input.apiBaseUrl || null, defaultModel: input.defaultModel, apiKey: input.apiKey });
    if (input.connectionId) await recordClientAiConnectionTest(userId, input.connectionId);
    return input.provider === "manus" || !input.apiKey ? result : { ...result, verificationToken: issueConnectionVerification(userId, { provider: input.provider, apiBaseUrl: input.apiBaseUrl || null, defaultModel: input.defaultModel, apiKey: input.apiKey }) };
  }),

  createBrief: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), campaignId: z.number().int().positive().optional(), title: z.string().trim().min(3).max(220), sourceType: z.enum(["briefing", "idea", "trend", "reference", "decision"]), objective: z.string().max(240).optional(), content: z.string().trim().min(10).max(20000) })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createContentBrief(userId, { ...input, objective: input.objective || null }) };
  }),

  captureTrend: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), campaignId: z.number().int().positive().optional(), platform: z.enum(["instagram", "youtube", "x", "tiktok", "other"]), sourceUrl: z.string().url().max(1200).optional(), title: z.string().trim().min(3).max(260), reactionNotes: z.string().max(8000).optional(), score: z.number().int().min(0).max(100).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createTrendSignal(userId, { ...input, sourceUrl: input.sourceUrl || null, reactionNotes: input.reactionNotes || null, score: input.score ?? null }) };
  }),

  createCampaign: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), providerConnectionId: z.number().int().positive().optional(), name: z.string().trim().min(3).max(220), mode: z.enum(["ads", "carousel", "bundle"]), generationMode: modeSchema.optional(), serviceKey: z.string().trim().min(2).max(80).optional(), objective: z.string().trim().min(3).max(240), briefing: z.string().trim().min(10).max(20000) })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createAdCampaign(userId, { ...input, providerConnectionId: input.providerConnectionId || null, briefingJson: JSON.stringify({ text: input.briefing, generationMode: input.generationMode || input.mode, serviceKey: input.serviceKey || null }) }) };
  }),

  updateCampaignProvider: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), providerConnectionId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await updateAdCampaignProvider(userId, input.campaignId, input.providerConnectionId) };
  }),

  versions: protectedProcedure.input(z.object({ campaignId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listCreativeVersions(userId, input.campaignId);
  }),

  approvals: protectedProcedure.input(z.object({ creativeVersionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listCreativeApprovals(userId, input.creativeVersionId);
  }),

  approvalHistory: protectedProcedure.input(z.object({ campaignId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listCampaignApprovalHistory(userId, input.campaignId);
  }),

  carouselSlides: protectedProcedure.input(z.object({ campaignId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listCarouselSlides(userId, input.campaignId);
  }),

  approveCarouselSlidesBatch: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), creativeVersionId: z.number().int().positive(), slideNumbers: z.array(z.number().int().min(1).max(10)).min(1).max(10), note: z.string().trim().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return approveCarouselSlidesBatch(userId, { ...input, note: input.note || null });
  }),

  approveVersion: protectedProcedure.input(z.object({ creativeVersionId: z.number().int().positive(), decision: z.enum(["approved", "changes_requested", "rejected"]), note: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createCreativeApproval(userId, { ...input, note: input.note || null }) };
  }),

  saveCarouselPreview: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), slides: z.array(carouselSlideSchema).min(3).max(10) })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const payloadJson = JSON.stringify({ mode: "carousel", source: "manual_preview", slides: input.slides });
    return { id: await createCreativeVersion(userId, { campaignId: input.campaignId, kind: "carousel", summary: "Prévia editável revisada antes da geração final", payloadJson }) };
  }),

  generate: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), mode: modeSchema, carouselPreview: z.array(carouselSlideSchema).min(3).max(10).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const record = await getAdCampaign(userId, input.campaignId);
    if (!record) throw new Error("Campanha não encontrada");
    if (record.campaign.providerConnectionId && record.connection?.status === "disabled") {
      throw new Error("A conexão de IA desta campanha está desativada. Reative-a ou escolha outro provedor antes de gerar.");
    }
    const profile = await getClientAgencyProfile(userId, record.campaign.clientId);
    const connection = record.campaign.providerConnectionId ? await getClientAiConnectionSecret(userId, record.campaign.providerConnectionId) : null;
    if (record.campaign.providerConnectionId && !connection) {
      throw new Error("A conexão de IA desta campanha não está disponível. Verifique o provedor antes de gerar.");
    }
    const briefing = (() => { try { return JSON.parse(record.campaign.briefingJson).text || record.campaign.briefingJson; } catch { return record.campaign.briefingJson; } })();
    const previewContext = input.mode === "carousel" && input.carouselPreview?.length
      ? `\n\nPRÉVIA EDITÁVEL APROVADA PARA REFINAMENTO:\n${input.carouselPreview.map(slide => `Slide ${slide.slideNumber} (${slide.role})\nTítulo: ${slide.headline}\nTexto: ${slide.body || ""}\nDireção: ${slide.visualDirection || ""}`).join("\n\n")}\n\nPreserve a intenção, a ordem e os fatos fornecidos; melhore apenas clareza e consistência.`
      : "";
    const prompt = buildAgencyPrompt({ mode: input.mode, clientName: record.client.name, campaignName: record.campaign.name, objective: record.campaign.objective, briefing: `${briefing}${previewContext}`, profile });
    await updateAdCampaignStatus(userId, input.campaignId, "generating");
    const generationId = await createAiGeneration(userId, { campaignId: input.campaignId, kind: input.mode === "carousel" ? "carousel" : input.mode === "ads" ? "ads" : "bundle", provider: connection?.provider || "manus", model: connection?.defaultModel || "gpt-5-mini", promptSnapshot: prompt });
    const generationStartedAt = Date.now();
    try {
      const result = await generateAgencyOutput(connection, prompt);
      const outputJson = JSON.stringify(result.output);
      await completeAiGeneration(userId, generationId, { status: "succeeded", outputJson, inputTokens: result.usage?.inputTokens ?? null, outputTokens: result.usage?.outputTokens ?? null, totalTokens: result.usage?.totalTokens ?? null, requestDurationMs: Date.now() - generationStartedAt });
      const versionId = await createCreativeVersion(userId, { campaignId: input.campaignId, generationId, kind: toCreativeKind(input.mode), summary: `${input.mode} · ${record.campaign.name}`, payloadJson: outputJson });
      if (result.output.carousel?.length) await replaceCarouselSlides(userId, input.campaignId, generationId, result.output.carousel);
      if (result.output.video) await createVideoScript(userId, { clientId: record.campaign.clientId, campaignId: input.campaignId, title: result.output.video.title, scriptJson: JSON.stringify(result.output.video.scenes), editPlan: result.output.video.editPlan });
      if (result.output.council) await createStrategyDecision(userId, { clientId: record.campaign.clientId, campaignId: input.campaignId, question: record.campaign.objective, lensOutputJson: JSON.stringify(result.output.council.lenses), recommendation: result.output.council.recommendation, primaryRisk: result.output.council.primaryRisk });
      await updateAdCampaignStatus(userId, input.campaignId, "ready");
      return { generationId, versionId, output: result.output, provider: result.provider, model: result.model };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar";
      await completeAiGeneration(userId, generationId, { status: "failed", errorMessage: message, requestDurationMs: Date.now() - generationStartedAt });
      await updateAdCampaignStatus(userId, input.campaignId, "failed");
      throw new Error(message);
    }
  }),

  createDecision: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), campaignId: z.number().int().positive().optional(), question: z.string().trim().min(10).max(8000), lenses: z.array(z.object({ lens: z.string(), assessment: z.string() })).min(1), recommendation: z.string().trim().min(5).max(8000), primaryRisk: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createStrategyDecision(userId, { clientId: input.clientId, campaignId: input.campaignId || null, question: input.question, lensOutputJson: JSON.stringify(input.lenses), recommendation: input.recommendation, primaryRisk: input.primaryRisk || null }) };
  }),
});

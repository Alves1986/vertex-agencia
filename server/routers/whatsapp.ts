import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { activateWhatsAppHumanHandoff, calculateManagedAiQuote, claimApprovedWhatsAppDispatch, completeApprovedWhatsAppDispatch, configureWhatsAppChannel, createWhatsAppChannel, createWhatsAppDraft, failApprovedWhatsAppDispatch, getAnnualCheckoutContext, getClientPortalOverview, getManagedAiBillingOverview, getWhatsAppAiPolicy, grantClientPortalMember, listAnnualSaasPlans, listClientPortalConversationMessages, listClientPortalMembers, listClientPortalWorkspaces, listWhatsAppAutomationRules, listWhatsAppChannels, listWhatsAppConversationMessages, listWhatsAppInbox, updateClientPortalMemberStatus, updateWhatsAppChannelProvider, upsertAnnualSaasPlan, upsertWhatsAppAiPolicy, upsertWhatsAppAutomationRule } from "../db";
import { getOperationalUserId } from "./helpers";
import { createAnnualPlanCheckout } from "../stripe/billing";
import { dispatchApprovedWhatsAppMessage, isWhatsAppExternalDeliveryEnabled } from "../whatsapp/delivery";

const clientIdSchema = z.number().int().positive();
const channelProviderSchema = z.enum(["meta_cloud", "twilio"]);
const workflowSchema = z.enum(["auto_reply", "draft_for_approval", "handoff_only"]);
const triggerSchema = z.enum(["inbound_message", "keyword", "outside_business_hours", "handoff_requested"]);
const actionSchema = z.enum(["ai_reply", "draft_for_approval", "handoff_human", "tag_conversation"]);

const agencyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "A operação de canais e a margem VERTEX são restritas à equipe da agência." });
  return next();
});

function toPublicChannel<T extends object>(channel: T): T {
  const result = { ...channel } as T & { encryptedConfig?: unknown; config?: unknown; secret?: unknown };
  delete result.encryptedConfig;
  delete result.config;
  delete result.secret;
  return result;
}

export const whatsappRouter = router({
  clientPortalWorkspaces: protectedProcedure.query(({ ctx }) => listClientPortalWorkspaces(ctx.user.openId)),

  clientPortalOverview: protectedProcedure.input(z.object({ clientId: clientIdSchema })).query(({ ctx, input }) => getClientPortalOverview(ctx.user.openId, input.clientId)),

  clientPortalConversationMessages: protectedProcedure.input(z.object({ clientId: clientIdSchema, conversationId: z.number().int().positive() })).query(({ ctx, input }) => listClientPortalConversationMessages(ctx.user.openId, input)),

  portalMembers: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => listClientPortalMembers(await getOperationalUserId(ctx.user), input.clientId)),

  grantPortalMember: agencyProcedure.input(z.object({ clientId: clientIdSchema, email: z.string().trim().email().max(320), role: z.enum(["client_admin", "manager", "agent", "viewer"]) })).mutation(async ({ ctx, input }) => ({ userId: await grantClientPortalMember(await getOperationalUserId(ctx.user), input) })),

  updatePortalMemberStatus: agencyProcedure.input(z.object({ clientId: clientIdSchema, memberId: z.number().int().positive(), status: z.enum(["active", "suspended"]) })).mutation(async ({ ctx, input }) => ({ id: await updateClientPortalMemberStatus(await getOperationalUserId(ctx.user), input) })),

  channels: agencyProcedure.input(z.object({ clientId: clientIdSchema.optional() }).optional()).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const channels = await listWhatsAppChannels(userId, input?.clientId);
    return channels.map(toPublicChannel);
  }),

  overview: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const [channels, policy, automations] = await Promise.all([
      listWhatsAppChannels(userId, input.clientId),
      getWhatsAppAiPolicy(userId, input.clientId),
      listWhatsAppAutomationRules(userId, input.clientId),
    ]);
    return { channels: channels.map(toPublicChannel), policy, automations };
  }),

  createChannel: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    label: z.string().trim().min(2).max(140),
    provider: channelProviderSchema,
    displayPhoneNumber: z.string().trim().min(5).max(40).optional().nullable(),
    externalAccountId: z.string().trim().min(2).max(220).optional().nullable(),
    externalSenderId: z.string().trim().min(2).max(220).optional().nullable(),
  })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createWhatsAppChannel(userId, input) };
  }),

  updateChannelProvider: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    channelId: z.number().int().positive(),
    provider: channelProviderSchema,
    displayPhoneNumber: z.string().trim().min(5).max(40).optional().nullable(),
    externalAccountId: z.string().trim().min(2).max(220).optional().nullable(),
    externalSenderId: z.string().trim().min(2).max(220).optional().nullable(),
  })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await updateWhatsAppChannelProvider(userId, input) };
  }),

  configureChannel: agencyProcedure.input(z.object({ clientId: clientIdSchema, channelId: z.number().int().positive(), config: z.object({ accessToken: z.string().max(2000).optional(), verifyToken: z.string().max(500).optional(), phoneNumberId: z.string().max(300).optional(), graphVersion: z.string().max(40).optional(), accountSid: z.string().max(300).optional(), authToken: z.string().max(1000).optional(), messagingServiceSid: z.string().max(300).optional(), from: z.string().max(80).optional() }) })).mutation(async ({ ctx, input }) => ({ id: await configureWhatsAppChannel(await getOperationalUserId(ctx.user), input) })),

  policy: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return getWhatsAppAiPolicy(userId, input.clientId);
  }),

  savePolicy: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    aiAccessMode: z.enum(["client_api_key", "vertex_managed"]),
    providerConnectionId: z.number().int().positive().optional().nullable(),
    workflowMode: workflowSchema,
    systemInstructions: z.string().max(12000).optional().nullable(),
    businessHoursJson: z.string().max(6000).optional().nullable(),
    handoffKeywordsJson: z.string().max(6000).optional().nullable(),
    monthlyManagedMessageLimit: z.number().int().min(1).max(10_000_000).optional().nullable(),
    managedAiCostPerThousandCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
    managedAiMarkupPercent: z.number().int().min(0).max(1_000).optional().nullable(),
    managedAiOveragePricePerThousandCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
  })).mutation(async ({ ctx, input }) => {
    if (input.aiAccessMode === "client_api_key" && !input.providerConnectionId) throw new Error("Selecione uma conexão de IA ativa do cliente.");
    if (input.aiAccessMode === "vertex_managed" && input.monthlyManagedMessageLimit == null) throw new Error("Informe o limite mensal contratado para a IA gerenciada pela VERTEX.");
    const userId = await getOperationalUserId(ctx.user);
    return { id: await upsertWhatsAppAiPolicy(userId, input) };
  }),

  managedAiBilling: agencyProcedure.input(z.object({ clientId: clientIdSchema, projectedAdditionalMessages: z.number().int().min(0).max(10_000_000).default(0) })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return getManagedAiBillingOverview(userId, input.clientId, input.projectedAdditionalMessages);
  }),

  managedAiBillingPreview: agencyProcedure.input(z.object({ clientId: clientIdSchema, projectedAdditionalMessages: z.number().int().min(0).max(10_000_000).default(0), includedMonthlyMessages: z.number().int().min(0).max(10_000_000), costPerThousandCents: z.number().int().min(0).max(10_000_000), markupPercent: z.number().int().min(0).max(10_000), overagePricePerThousandCents: z.number().int().min(0).max(10_000_000) })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const persisted = await getManagedAiBillingOverview(userId, input.clientId, 0);
    return { aiAccessMode: "vertex_managed" as const, subscription: persisted.subscription, quote: calculateManagedAiQuote({ currentMonthlyMessages: persisted.quote.currentMonthlyMessages, projectedAdditionalMessages: input.projectedAdditionalMessages, includedMonthlyMessages: input.includedMonthlyMessages, costPerThousandCents: input.costPerThousandCents, markupPercent: input.markupPercent, overagePricePerThousandCents: input.overagePricePerThousandCents }) };
  }),

  annualPlans: agencyProcedure.query(async ({ ctx }) => listAnnualSaasPlans(await getOperationalUserId(ctx.user))),

  saveAnnualPlan: agencyProcedure.input(z.object({ id: z.number().int().positive().optional(), code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_-]+$/), name: z.string().trim().min(2).max(160), annualPriceCents: z.number().int().min(50).max(100_000_000), stripePriceId: z.string().trim().min(3).max(255).optional().nullable(), includedChannels: z.number().int().min(1).max(1_000), includedHumanSeats: z.number().int().min(1).max(10_000), includedManagedAiMessages: z.number().int().min(0).max(10_000_000), managedAiCostPerThousandCents: z.number().int().min(0).max(10_000_000), managedAiMarkupPercent: z.number().int().min(0).max(1_000), managedAiOveragePricePerThousandCents: z.number().int().min(0).max(10_000_000), isActive: z.boolean().default(true) })).mutation(async ({ ctx, input }) => ({ id: await upsertAnnualSaasPlan(await getOperationalUserId(ctx.user), input) })),

  checkoutAnnualPlan: agencyProcedure.input(z.object({ clientId: clientIdSchema, planId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    const { plan, client } = await getAnnualCheckoutContext(userId, input.clientId, input.planId);
    const host = typeof ctx.req.get === "function" ? ctx.req.get("host") : ctx.req.headers.host || "localhost:3000";
    const origin = ctx.req.headers.origin || `${ctx.req.protocol || "https"}://${host}`;
    const url = await createAnnualPlanCheckout({ plan, ownerUserId: userId, clientId: client.id, customerEmail: ctx.user.email || client.contactEmail, customerName: ctx.user.name || client.name, origin });
    return { url };
  }),

  automations: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listWhatsAppAutomationRules(userId, input.clientId);
  }),

  inbox: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listWhatsAppInbox(userId, input.clientId);
  }),

  conversationMessages: agencyProcedure.input(z.object({ clientId: clientIdSchema, conversationId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return listWhatsAppConversationMessages(userId, input.clientId, input.conversationId);
  }),

  assumeHumanReview: agencyProcedure.input(z.object({ clientId: clientIdSchema, conversationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await activateWhatsAppHumanHandoff(userId, input.clientId, input.conversationId), mode: "human_review" as const };
  }),

  saveDraft: agencyProcedure.input(z.object({ clientId: clientIdSchema, conversationId: z.number().int().positive(), body: z.string().trim().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
    const userId = await getOperationalUserId(ctx.user);
    return { id: await createWhatsAppDraft(userId, input), externalDelivery: "disabled" as const };
  }),

  approveAndSendDraft: agencyProcedure.input(z.object({ clientId: clientIdSchema, messageId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    if (!isWhatsAppExternalDeliveryEnabled()) throw new Error("A entrega externa continua desativada até a ativação controlada das credenciais da VERTEX.");
    const userId = await getOperationalUserId(ctx.user);
    const claimed = await claimApprovedWhatsAppDispatch(userId, input);
    if (claimed.state === "already_processed") return { state: claimed.state, deliveryStatus: claimed.deliveryStatus, providerMessageId: claimed.providerMessageId };
    try {
      const result = await dispatchApprovedWhatsAppMessage(claimed);
      await completeApprovedWhatsAppDispatch(userId, { clientId: input.clientId, messageId: claimed.messageId, channelId: claimed.channelId, ...result });
      return { state: "sent" as const, deliveryStatus: "sent" as const, providerMessageId: result.providerMessageId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha inesperada ao entregar a mensagem.";
      await failApprovedWhatsAppDispatch(userId, { clientId: input.clientId, messageId: claimed.messageId, channelId: claimed.channelId, reason });
      throw new Error("A entrega não foi concluída e o rascunho foi marcado como falho para revisão.");
    }
  }),

  saveAutomation: agencyProcedure.input(z.object({
    id: z.number().int().positive().optional(),
    clientId: clientIdSchema,
    channelId: z.number().int().positive().optional().nullable(),
    name: z.string().trim().min(3).max(180),
    triggerType: triggerSchema,
    triggerConfigJson: z.string().max(6000).optional().nullable(),
    actionType: actionSchema,
    actionConfigJson: z.string().max(6000).optional().nullable(),
    requiresApproval: z.boolean().default(true),
    priority: z.number().int().min(1).max(10_000).default(100),
    status: z.enum(["draft", "active", "paused"]).default("draft"),
  })).mutation(async ({ ctx, input }) => {
    if (input.actionType === "ai_reply" && input.status === "active" && input.requiresApproval) throw new Error("Uma regra ativa de resposta automática não pode exigir aprovação; use rascunho para aprovação humana.");
    const userId = await getOperationalUserId(ctx.user);
    return { id: await upsertWhatsAppAutomationRule(userId, input) };
  }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  acceptOwnClientAccessGrant,
  addClientPortalSupportTicketUpdate,
  addSupportTicketUpdate,
  createClientPortalSupportTicket,
  createExecutiveReport,
  createExternalApprovalLink,
  createSupportTicket,
  decideExternalApprovalByToken,
  exportClientBackupSnapshot,
  getClientBrandGuidelines,
  getClientHealth,
  getClientNotificationPreferences,
  getClientOnboardingProgress,
  getClientPortalOnboardingProgress,
  getExternalApprovalByToken,
  getSupportTicket,
  listClientAccessGrants,
  listClientPortalSupportTickets,
  listExecutiveReports,
  listExternalApprovalLinks,
  listSupportTickets,
  revokeExternalApprovalLink,
  updateClientAccessGrantStatus,
  upsertClientAccessGrant,
  upsertClientBrandGuidelines,
  upsertClientNotificationPreferences,
  upsertClientOnboardingProgress,
} from "../db";
import { getOperationalUserId } from "./helpers";

const clientIdSchema = z.number().int().positive();
const ticketStatusSchema = z.enum(["open", "in_progress", "waiting_client", "resolved", "closed"]);
const ticketPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const onboardingStepSchema = z.enum(["brand", "contacts", "ai", "whatsapp", "goals", "review", "complete"]);

const agencyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "A gestão de sucesso do cliente é restrita à equipe administrativa da VERTEX." });
  }
  return next();
});

const textListSchema = z.array(z.string().trim().min(1).max(240)).max(80);

export const successRouter = router({
  accessGrants: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => listClientAccessGrants(await getOperationalUserId(ctx.user), input.clientId)),

  saveAccessGrant: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    email: z.string().trim().email().max(320),
    displayName: z.string().trim().min(2).max(180).optional().nullable(),
    role: z.enum(["client_admin", "manager", "reviewer", "viewer"]),
  })).mutation(async ({ ctx, input }) => ({ id: await upsertClientAccessGrant(await getOperationalUserId(ctx.user), input) })),

  updateAccessGrantStatus: agencyProcedure.input(z.object({ clientId: clientIdSchema, grantId: z.number().int().positive(), status: z.enum(["pending", "active", "revoked"]) })).mutation(async ({ ctx, input }) => ({ id: await updateClientAccessGrantStatus(await getOperationalUserId(ctx.user), input) })),

  acceptOwnAccessGrant: protectedProcedure.input(z.object({ clientId: clientIdSchema })).mutation(async ({ ctx, input }) => acceptOwnClientAccessGrant(ctx.user.openId, input.clientId)),

  onboarding: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => getClientOnboardingProgress(await getOperationalUserId(ctx.user), input.clientId)),

  saveOnboarding: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    currentStep: onboardingStepSchema,
    completedSteps: z.array(onboardingStepSchema).max(7),
    goals: z.string().trim().max(6000).optional().nullable(),
    reviewNote: z.string().trim().max(6000).optional().nullable(),
  })).mutation(async ({ ctx, input }) => upsertClientOnboardingProgress(await getOperationalUserId(ctx.user), input)),

  brandGuidelines: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => getClientBrandGuidelines(await getOperationalUserId(ctx.user), input.clientId)),

  saveBrandGuidelines: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    colors: textListSchema,
    fonts: textListSchema,
    toneOfVoice: z.string().trim().max(6000).optional().nullable(),
    prohibitedWords: textListSchema,
    approvedCtas: textListSchema,
    products: textListSchema,
    differentiators: textListSchema,
  })).mutation(async ({ ctx, input }) => ({ id: await upsertClientBrandGuidelines(await getOperationalUserId(ctx.user), input) })),

  health: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => getClientHealth(await getOperationalUserId(ctx.user), input.clientId)),

  tickets: agencyProcedure.input(z.object({ clientId: clientIdSchema.optional() }).optional()).query(async ({ ctx, input }) => listSupportTickets(await getOperationalUserId(ctx.user), input?.clientId)),

  ticket: agencyProcedure.input(z.object({ clientId: clientIdSchema, ticketId: z.number().int().positive() })).query(async ({ ctx, input }) => getSupportTicket(await getOperationalUserId(ctx.user), input.clientId, input.ticketId)),

  createTicket: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    requesterEmail: z.string().trim().email().max(320),
    subject: z.string().trim().min(3).max(220),
    description: z.string().trim().min(3).max(12_000),
    priority: ticketPrioritySchema.default("normal"),
    dueAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createSupportTicket(await getOperationalUserId(ctx.user), input) })),

  addTicketUpdate: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    ticketId: z.number().int().positive(),
    message: z.string().trim().min(1).max(12_000),
    statusAfter: ticketStatusSchema.optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await addSupportTicketUpdate(await getOperationalUserId(ctx.user), input) })),

  clientPortalTickets: protectedProcedure.input(z.object({ clientId: clientIdSchema })).query(({ ctx, input }) => listClientPortalSupportTickets(ctx.user.openId, input.clientId)),

  clientPortalOnboarding: protectedProcedure.input(z.object({ clientId: clientIdSchema })).query(({ ctx, input }) => getClientPortalOnboardingProgress(ctx.user.openId, input.clientId)),

  createClientPortalTicket: protectedProcedure.input(z.object({
    clientId: clientIdSchema,
    subject: z.string().trim().min(3).max(220),
    description: z.string().trim().min(3).max(12_000),
    priority: ticketPrioritySchema.default("normal"),
  })).mutation(({ ctx, input }) => createClientPortalSupportTicket(ctx.user.openId, input)),

  addClientPortalTicketUpdate: protectedProcedure.input(z.object({ clientId: clientIdSchema, ticketId: z.number().int().positive(), message: z.string().trim().min(1).max(12_000) })).mutation(({ ctx, input }) => addClientPortalSupportTicketUpdate(ctx.user.openId, input)),

  externalApprovalLinks: agencyProcedure.input(z.object({ clientId: clientIdSchema, campaignId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => listExternalApprovalLinks(await getOperationalUserId(ctx.user), input.clientId, input.campaignId)),

  createExternalApprovalLink: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    campaignId: z.number().int().positive(),
    creativeVersionId: z.number().int().positive(),
    recipientEmail: z.string().trim().email().max(320),
    expiresAt: z.date(),
  })).mutation(async ({ ctx, input }) => createExternalApprovalLink(await getOperationalUserId(ctx.user), input)),

  revokeExternalApprovalLink: agencyProcedure.input(z.object({ clientId: clientIdSchema, linkId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ id: await revokeExternalApprovalLink(await getOperationalUserId(ctx.user), input.clientId, input.linkId) })),

  externalApproval: publicProcedure.input(z.object({ token: z.string().trim().min(32).max(200) })).query(({ input }) => getExternalApprovalByToken(input.token)),

  decideExternalApproval: publicProcedure.input(z.object({
    token: z.string().trim().min(32).max(200),
    decision: z.enum(["approved", "changes_requested"]),
    note: z.string().trim().max(6000).optional().nullable(),
  })).mutation(({ input }) => decideExternalApprovalByToken(input.token, input)),

  notificationPreferences: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => getClientNotificationPreferences(await getOperationalUserId(ctx.user), input.clientId)),

  saveNotificationPreferences: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    events: z.object({
      approvals: z.boolean().optional(),
      usage_limit: z.boolean().optional(),
      channel_status: z.boolean().optional(),
      email_failures: z.boolean().optional(),
      due_dates: z.boolean().optional(),
      billing: z.boolean().optional(),
      support: z.boolean().optional(),
    }),
  })).mutation(async ({ ctx, input }) => ({ id: await upsertClientNotificationPreferences(await getOperationalUserId(ctx.user), input) })),

  executiveReports: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => listExecutiveReports(await getOperationalUserId(ctx.user), input.clientId)),

  createExecutiveReport: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    periodStart: z.date(),
    periodEnd: z.date(),
    title: z.string().trim().min(3).max(220),
    summary: z.string().trim().min(3).max(12_000),
    metrics: z.record(z.string(), z.unknown()).default({}),
  })).mutation(async ({ ctx, input }) => ({ id: await createExecutiveReport(await getOperationalUserId(ctx.user), input) })),

  exportClientBackup: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => exportClientBackupSnapshot(await getOperationalUserId(ctx.user), input.clientId)),
});

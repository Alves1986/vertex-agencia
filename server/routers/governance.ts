import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createClientConsent,
  getExecutiveDashboard,
  listAssetUsageRights,
  listCapacityPlans,
  listClientConsents,
  listDataRetentionPolicies,
  listIntegrationHealthLogs,
  recordIntegrationHealth,
  updateClientConsentStatus,
  upsertAssetUsageRight,
  upsertCapacityPlan,
  upsertDataRetentionPolicy,
} from "../db";
import { getOperationalUserId } from "./helpers";

const agencyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "A governança e os indicadores executivos são restritos à equipe administrativa da VERTEX." });
  }
  return next();
});

const clientId = z.number().int().positive();
const url = z.string().trim().url().max(1400);

export const governanceRouter = router({
  assetRights: agencyProcedure.input(z.object({ clientId })).query(async ({ ctx, input }) => listAssetUsageRights(await getOperationalUserId(ctx.user), input.clientId)),
  saveAssetRight: agencyProcedure.input(z.object({
    clientId, brandAssetId: z.number().int().positive(), versionLabel: z.string().trim().max(160),
    licenseType: z.enum(["owned", "licensed", "stock", "partner", "editorial", "unknown"]),
    usageScope: z.string().trim().max(12_000).optional().nullable(), sourceUrl: url.optional().nullable(),
    status: z.enum(["active", "expiring", "expired", "restricted"]), expiresAt: z.date().optional().nullable(), reviewedAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await upsertAssetUsageRight(await getOperationalUserId(ctx.user), input) })),

  capacityPlans: agencyProcedure.query(async ({ ctx }) => listCapacityPlans(await getOperationalUserId(ctx.user))),
  saveCapacityPlan: agencyProcedure.input(z.object({
    operatorId: z.number().int().positive(), teamId: z.number().int().positive().optional().nullable(), periodStart: z.date(),
    capacityMinutes: z.number().int().min(0).max(1_008_000), bookedMinutes: z.number().int().min(0).max(1_008_000), notes: z.string().trim().max(600).optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await upsertCapacityPlan(await getOperationalUserId(ctx.user), input) })),

  consents: agencyProcedure.input(z.object({ clientId })).query(async ({ ctx, input }) => listClientConsents(await getOperationalUserId(ctx.user), input.clientId)),
  createConsent: agencyProcedure.input(z.object({
    clientId, subjectName: z.string().trim().max(180).optional().nullable(), subjectEmail: z.string().trim().email().max(320).optional().nullable(),
    consentType: z.enum(["marketing", "data_processing", "whatsapp", "email", "terms"]), status: z.enum(["granted", "revoked", "pending"]),
    legalBasis: z.string().trim().max(180).optional().nullable(), evidenceUrl: url.optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createClientConsent(await getOperationalUserId(ctx.user), input) })),
  updateConsentStatus: agencyProcedure.input(z.object({ clientId, consentId: z.number().int().positive(), status: z.enum(["granted", "revoked", "pending"]) })).mutation(async ({ ctx, input }) => ({ id: await updateClientConsentStatus(await getOperationalUserId(ctx.user), input) })),

  retentionPolicies: agencyProcedure.input(z.object({ clientId })).query(async ({ ctx, input }) => listDataRetentionPolicies(await getOperationalUserId(ctx.user), input.clientId)),
  saveRetentionPolicy: agencyProcedure.input(z.object({
    clientId, dataCategory: z.enum(["contacts", "conversations", "creative", "analytics", "financial", "research"]), retentionDays: z.number().int().min(1).max(36500), status: z.enum(["active", "paused"]), reviewAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await upsertDataRetentionPolicy(await getOperationalUserId(ctx.user), input) })),

  integrationHealth: agencyProcedure.input(z.object({ clientId })).query(async ({ ctx, input }) => listIntegrationHealthLogs(await getOperationalUserId(ctx.user), input.clientId)),
  recordIntegrationHealth: agencyProcedure.input(z.object({
    clientId, integrationType: z.enum(["ai", "whatsapp", "email", "media", "research", "crm", "other"]), provider: z.string().trim().min(2).max(140),
    status: z.enum(["healthy", "warning", "error", "unknown"]), safeMessage: z.string().trim().max(800).optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await recordIntegrationHealth(await getOperationalUserId(ctx.user), input) })),

  executiveDashboard: agencyProcedure.query(async ({ ctx }) => getExecutiveDashboard(await getOperationalUserId(ctx.user))),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  addMarketingResearchSource,
  createEditorialItem,
  createMarketingResearch,
  createPaidMediaPlan,
  createPaidMediaSnapshot,
  getPaidMediaSummary,
  listEditorialItems,
  listMarketingResearches,
  listMarketingResearchSources,
  listPaidMediaPlans,
  listPaidMediaSnapshots,
  updateEditorialItem,
  updateMarketingResearch,
  updatePaidMediaPlanStatus,
} from "../db";
import { getOperationalUserId } from "./helpers";

const agencyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Conteúdo, mídia e inteligência são geridos pela equipe administrativa da VERTEX." });
  }
  return next();
});

const clientIdSchema = z.number().int().positive();
const editorialStatusSchema = z.enum(["idea", "briefing", "production", "review", "approved", "published", "archived"]);
const editorialChannelSchema = z.enum(["instagram", "facebook", "tiktok", "youtube", "linkedin", "blog", "email", "whatsapp", "other"]);
const researchStatusSchema = z.enum(["draft", "collecting", "review", "accepted", "archived"]);
const centsSchema = z.number().int().min(0).max(2_000_000_000);

export const intelligenceRouter = router({
  editorialItems: agencyProcedure.input(z.object({ clientId: clientIdSchema, status: editorialStatusSchema.optional() })).query(async ({ ctx, input }) => listEditorialItems(await getOperationalUserId(ctx.user), input.clientId, input.status)),

  createEditorialItem: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    projectId: z.number().int().positive().optional().nullable(),
    campaignId: z.number().int().positive().optional().nullable(),
    assignedOperatorId: z.number().int().positive().optional().nullable(),
    title: z.string().trim().min(2).max(240),
    channel: editorialChannelSchema,
    format: z.string().trim().max(120).optional().nullable(),
    pillar: z.string().trim().max(160).optional().nullable(),
    objective: z.string().trim().max(220).optional().nullable(),
    brief: z.string().trim().max(20_000).optional().nullable(),
    plannedFor: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createEditorialItem(await getOperationalUserId(ctx.user), input) })),

  updateEditorialItem: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    itemId: z.number().int().positive(),
    status: editorialStatusSchema.optional(),
    assignedOperatorId: z.number().int().positive().optional().nullable(),
    plannedFor: z.date().optional().nullable(),
    publishedAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await updateEditorialItem(await getOperationalUserId(ctx.user), input) })),

  mediaPlans: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => listPaidMediaPlans(await getOperationalUserId(ctx.user), input.clientId)),
  mediaSnapshots: agencyProcedure.input(z.object({ clientId: clientIdSchema, mediaPlanId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => listPaidMediaSnapshots(await getOperationalUserId(ctx.user), input.clientId, input.mediaPlanId)),
  mediaSummary: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => getPaidMediaSummary(await getOperationalUserId(ctx.user), input.clientId)),

  createMediaPlan: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    campaignId: z.number().int().positive().optional().nullable(),
    name: z.string().trim().min(2).max(220),
    platform: z.enum(["meta", "google", "tiktok", "linkedin", "other"]),
    objective: z.string().trim().min(2).max(180),
    targetMetric: z.string().trim().max(100).optional().nullable(),
    targetValue: z.number().int().min(0).optional().nullable(),
    plannedBudgetCents: centsSchema,
    startsAt: z.date().optional().nullable(),
    endsAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createPaidMediaPlan(await getOperationalUserId(ctx.user), input) })),

  updateMediaPlanStatus: agencyProcedure.input(z.object({ clientId: clientIdSchema, planId: z.number().int().positive(), status: z.enum(["draft", "active", "paused", "completed"]) })).mutation(async ({ ctx, input }) => ({ id: await updatePaidMediaPlanStatus(await getOperationalUserId(ctx.user), input) })),

  createMediaSnapshot: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    mediaPlanId: z.number().int().positive(),
    recordedAt: z.date(),
    spendCents: centsSchema,
    impressions: z.number().int().min(0).max(2_000_000_000),
    reach: z.number().int().min(0).max(2_000_000_000),
    clicks: z.number().int().min(0).max(2_000_000_000),
    leads: z.number().int().min(0).max(2_000_000_000),
    conversions: z.number().int().min(0).max(2_000_000_000),
    conversionValueCents: centsSchema,
    notes: z.string().trim().max(12_000).optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createPaidMediaSnapshot(await getOperationalUserId(ctx.user), input) })),

  researches: agencyProcedure.input(z.object({ clientId: clientIdSchema, status: researchStatusSchema.optional() })).query(async ({ ctx, input }) => listMarketingResearches(await getOperationalUserId(ctx.user), input.clientId, input.status)),
  researchSources: agencyProcedure.input(z.object({ clientId: clientIdSchema, researchId: z.number().int().positive() })).query(async ({ ctx, input }) => listMarketingResearchSources(await getOperationalUserId(ctx.user), input.clientId, input.researchId)),

  createResearch: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    campaignId: z.number().int().positive().optional().nullable(),
    title: z.string().trim().min(2).max(240),
    objective: z.string().trim().min(2).max(240),
    question: z.string().trim().min(3).max(20_000),
    audience: z.string().trim().max(240).optional().nullable(),
    market: z.string().trim().max(240).optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createMarketingResearch(await getOperationalUserId(ctx.user), input) })),

  updateResearch: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    researchId: z.number().int().positive(),
    status: researchStatusSchema.optional(),
    summary: z.string().trim().max(30_000).optional().nullable(),
    recommendation: z.string().trim().max(30_000).optional().nullable(),
    risks: z.string().trim().max(30_000).optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await updateMarketingResearch(await getOperationalUserId(ctx.user), input) })),

  addResearchSource: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    researchId: z.number().int().positive(),
    sourceType: z.enum(["web", "social", "video", "community", "report", "competitor", "other"]),
    title: z.string().trim().min(2).max(300),
    url: z.string().url().max(1400),
    publisher: z.string().trim().max(220).optional().nullable(),
    excerpt: z.string().trim().max(12_000).optional().nullable(),
    publishedAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await addMarketingResearchSource(await getOperationalUserId(ctx.user), input) })),
});

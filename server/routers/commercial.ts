import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCommercialProposal,
  createFinancialEntry,
  createSalesActivity,
  createSalesLead,
  createServiceContract,
  getClientProfitability,
  listCommercialProposals,
  listFinancialEntries,
  listSalesActivities,
  listSalesLeads,
  listServiceContracts,
  updateCommercialProposalStatus,
  updateSalesLead,
  updateServiceContractStatus,
} from "../db";
import { getOperationalUserId } from "./helpers";

const agencyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "A gestão comercial e financeira é restrita à equipe administrativa da VERTEX." });
  }
  return next();
});

const clientIdSchema = z.number().int().positive();
const centsSchema = z.number().int().min(0).max(2_000_000_000);
const salesLeadStatusSchema = z.enum(["new", "qualified", "proposal", "negotiation", "won", "lost", "archived"]);
const proposalStatusSchema = z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired"]);
const contractStatusSchema = z.enum(["draft", "active", "suspended", "ended", "renewal_due"]);

export const commercialRouter = router({
  leads: agencyProcedure.input(z.object({ status: salesLeadStatusSchema.optional() }).optional()).query(async ({ ctx, input }) => listSalesLeads(await getOperationalUserId(ctx.user), input?.status)),

  createLead: agencyProcedure.input(z.object({
    companyName: z.string().trim().min(2).max(220),
    contactName: z.string().trim().max(180).optional().nullable(),
    contactEmail: z.string().trim().email().max(320).optional().nullable(),
    contactPhone: z.string().trim().max(60).optional().nullable(),
    source: z.string().trim().max(180).optional().nullable(),
    responsibleOperatorId: z.number().int().positive().optional().nullable(),
    score: z.number().int().min(0).max(100).optional().nullable(),
    estimatedMonthlyRevenueCents: centsSchema.optional().nullable(),
    nextActionAt: z.date().optional().nullable(),
    notes: z.string().trim().max(12_000).optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createSalesLead(await getOperationalUserId(ctx.user), input) })),

  updateLead: agencyProcedure.input(z.object({
    leadId: z.number().int().positive(),
    status: salesLeadStatusSchema.optional(),
    responsibleOperatorId: z.number().int().positive().optional().nullable(),
    score: z.number().int().min(0).max(100).optional().nullable(),
    estimatedMonthlyRevenueCents: centsSchema.optional().nullable(),
    nextActionAt: z.date().optional().nullable(),
    lostReason: z.string().trim().max(2000).optional().nullable(),
    notes: z.string().trim().max(12_000).optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await updateSalesLead(await getOperationalUserId(ctx.user), input) })),

  leadActivities: agencyProcedure.input(z.object({ leadId: z.number().int().positive() })).query(async ({ ctx, input }) => listSalesActivities(await getOperationalUserId(ctx.user), input.leadId)),

  createLeadActivity: agencyProcedure.input(z.object({
    leadId: z.number().int().positive(),
    activityType: z.enum(["note", "call", "email", "meeting", "task", "status_change"]),
    description: z.string().trim().min(1).max(12_000),
    nextActionAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createSalesActivity(await getOperationalUserId(ctx.user), input) })),

  proposals: agencyProcedure.input(z.object({ leadId: z.number().int().positive().optional(), clientId: clientIdSchema.optional(), status: proposalStatusSchema.optional() }).optional()).query(async ({ ctx, input }) => listCommercialProposals(await getOperationalUserId(ctx.user), input)),

  createProposal: agencyProcedure.input(z.object({
    leadId: z.number().int().positive().optional().nullable(),
    clientId: clientIdSchema.optional().nullable(),
    proposalNumber: z.string().trim().min(2).max(80),
    title: z.string().trim().min(2).max(220),
    scope: z.string().trim().min(3).max(20_000),
    amountCents: centsSchema,
    currency: z.string().trim().length(3).optional(),
    validUntil: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createCommercialProposal(await getOperationalUserId(ctx.user), input) })),

  updateProposalStatus: agencyProcedure.input(z.object({ proposalId: z.number().int().positive(), status: proposalStatusSchema })).mutation(async ({ ctx, input }) => ({ id: await updateCommercialProposalStatus(await getOperationalUserId(ctx.user), input.proposalId, input.status) })),

  contracts: agencyProcedure.input(z.object({ clientId: clientIdSchema.optional() }).optional()).query(async ({ ctx, input }) => listServiceContracts(await getOperationalUserId(ctx.user), input?.clientId)),

  createContract: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    leadId: z.number().int().positive().optional().nullable(),
    proposalId: z.number().int().positive().optional().nullable(),
    code: z.string().trim().min(2).max(100),
    title: z.string().trim().min(2).max(220),
    scope: z.string().trim().min(3).max(20_000),
    billingCycle: z.enum(["monthly", "annual", "project"]),
    recurringRevenueCents: centsSchema.optional().nullable(),
    startsAt: z.date().optional().nullable(),
    endsAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createServiceContract(await getOperationalUserId(ctx.user), input) })),

  updateContractStatus: agencyProcedure.input(z.object({ clientId: clientIdSchema, contractId: z.number().int().positive(), status: contractStatusSchema, signedAt: z.date().optional().nullable() })).mutation(async ({ ctx, input }) => ({ id: await updateServiceContractStatus(await getOperationalUserId(ctx.user), input) })),

  financialEntries: agencyProcedure.input(z.object({ clientId: clientIdSchema.optional() }).optional()).query(async ({ ctx, input }) => listFinancialEntries(await getOperationalUserId(ctx.user), input?.clientId)),

  createFinancialEntry: agencyProcedure.input(z.object({
    clientId: clientIdSchema,
    contractId: z.number().int().positive().optional().nullable(),
    projectId: z.number().int().positive().optional().nullable(),
    entryType: z.enum(["revenue", "expense", "media_spend", "refund"]),
    status: z.enum(["planned", "invoiced", "paid", "overdue", "cancelled"]).optional(),
    category: z.string().trim().max(180).optional().nullable(),
    description: z.string().trim().min(2).max(1000),
    amountCents: centsSchema,
    currency: z.string().trim().length(3).optional(),
    dueAt: z.date().optional().nullable(),
    paidAt: z.date().optional().nullable(),
  })).mutation(async ({ ctx, input }) => ({ id: await createFinancialEntry(await getOperationalUserId(ctx.user), input) })),

  profitability: agencyProcedure.input(z.object({ clientId: clientIdSchema })).query(async ({ ctx, input }) => getClientProfitability(await getOperationalUserId(ctx.user), input.clientId)),
});

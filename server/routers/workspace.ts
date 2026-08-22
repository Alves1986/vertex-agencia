import { z } from "zod";
import { createClient, createOperator, createTeam, deleteClient, getClientDeletionPreview, getDashboardPreferences, listClients, listOperators, listTeams, updateDashboardPreferences, updateTeam } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getOperationalUserId } from "./helpers";

export const workspaceRouter = router({
  clients: protectedProcedure.query(async ({ ctx }) => listClients(await getOperationalUserId(ctx.user))),
  teams: protectedProcedure.query(async ({ ctx }) => listTeams(await getOperationalUserId(ctx.user))),
  operators: protectedProcedure.query(async ({ ctx }) => listOperators(await getOperationalUserId(ctx.user))),
  preferences: protectedProcedure.query(async ({ ctx }) => getDashboardPreferences(await getOperationalUserId(ctx.user))),
  createClient: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(180), contactName: z.string().trim().max(180).nullish(), contactEmail: z.string().trim().email().max(320).nullish(), segment: z.string().trim().max(120).nullish() }))
    .mutation(async ({ ctx, input }) => {
      await createClient(await getOperationalUserId(ctx.user), input);
      return { success: true } as const;
    }),
  clientDeletionPreview: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => getClientDeletionPreview(await getOperationalUserId(ctx.user), input.clientId)),
  deleteClient: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), confirmationName: z.string().trim().min(2).max(180) }))
    .mutation(async ({ ctx, input }) => deleteClient(await getOperationalUserId(ctx.user), input.clientId, input.confirmationName)),
  createTeam: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(140), color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      await createTeam(await getOperationalUserId(ctx.user), input);
      return { success: true } as const;
    }),
  updateTeam: protectedProcedure
    .input(z.object({ teamId: z.number().int().positive(), name: z.string().trim().min(2).max(140), color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      await updateTeam(await getOperationalUserId(ctx.user), input.teamId, { name: input.name, color: input.color });
      return { success: true } as const;
    }),
  createOperator: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(180), email: z.string().trim().email().max(320).nullish(), role: z.string().trim().max(120).nullish(), teamId: z.number().int().positive().nullish() }))
    .mutation(async ({ ctx, input }) => {
      await createOperator(await getOperationalUserId(ctx.user), input);
      return { success: true } as const;
    }),
  updatePreferences: protectedProcedure
    .input(z.object({ activeClientId: z.number().int().positive().nullable().optional(), activeTeamId: z.number().int().positive().nullable().optional(), preferredRange: z.enum(["week", "month"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      await updateDashboardPreferences(await getOperationalUserId(ctx.user), input);
      return { success: true } as const;
    }),
});

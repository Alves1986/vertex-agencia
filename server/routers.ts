import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notificationsRouter } from "./routers/notifications";
import { originalAppRouter } from "./routers/originalApp";
import { productionRouter } from "./routers/production";
import { projectsRouter } from "./routers/projects";
import { workspaceRouter } from "./routers/workspace";
import { agencyRouter } from "./routers/agency";
import { commercialRouter } from "./routers/commercial";
import { intelligenceRouter } from "./routers/intelligence";
import { governanceRouter } from "./routers/governance";
import { successRouter } from "./routers/success";
import { whatsappRouter } from "./routers/whatsapp";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: workspaceRouter,
  projects: projectsRouter,
  production: productionRouter,
  notifications: notificationsRouter,
  originalApp: originalAppRouter,
  agency: agencyRouter,
  commercial: commercialRouter,
  intelligence: intelligenceRouter,
  governance: governanceRouter,
  success: successRouter,
  whatsapp: whatsappRouter,
});

export type AppRouter = typeof appRouter;

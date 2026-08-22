import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerWhatsAppWebhooks } from "./whatsapp/webhooks";
import { registerStripeWebhook } from "./stripe/webhooks";

/** Cria a aplicação HTTP reutilizável tanto no servidor local quanto em funções serverless. */
export function createApp() {
  const app = express();
  const transparentVertexLogo = "/manus-storage/vertex-consulting-logo-transparent_6996f748.png";
  const configuredLogo = process.env.VITE_APP_LOGO;
  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
  registerStripeWebhook(app);
  app.use(express.json({ limit: "50mb", verify: (request, _response, buffer) => { (request as express.Request & { rawBody?: Buffer }).rawBody = buffer; } }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/branding", (_req, res) => {
    res.json({
      title: process.env.VITE_APP_TITLE ?? "VERTEX Consulting",
      logo: configuredLogo === "/manus-storage/vertex-consulting-logo_4cdb7d6a.png" ? transparentVertexLogo : configuredLogo ?? transparentVertexLogo,
    });
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerWhatsAppWebhooks(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  return app;
}

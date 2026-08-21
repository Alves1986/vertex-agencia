import type { Express, Request, Response } from "express";
import { decryptProviderKey } from "../aiAds/crypto";
import { evaluateWhatsAppAutomationRules, getWhatsAppChannelSecret, ingestInboundWhatsAppMessage, markWhatsAppWebhookEvent, recordWhatsAppWebhookEvent } from "../db";
import { extractMetaInboundMessages, extractTwilioInboundMessage, getWebhookEventId, verifyMetaWebhookChallenge, verifyTwilioWebhookSignature } from "./providers";

type MetaStoredConfig = { verifyToken?: string };
type TwilioStoredConfig = { authToken?: string };

function readConfig<T>(encryptedConfig: string | null): T | null {
  if (!encryptedConfig) return null;
  try {
    return JSON.parse(decryptProviderKey(encryptedConfig)) as T;
  } catch {
    return null;
  }
}

function rawBody(request: Request) {
  return (request as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
}

function originalUrl(request: Request) {
  const protocol = (request.header("x-forwarded-proto") || request.protocol || "https").split(",")[0];
  return `${protocol}://${request.get("host")}${request.originalUrl}`;
}

function sendWebhookError(response: Response, status: number, code: string) {
  response.status(status).json({ accepted: false, code });
}

export function registerWhatsAppWebhooks(app: Express) {
  app.get("/api/webhooks/whatsapp/meta/:channelId", async (request, response) => {
    const channel = await getWhatsAppChannelSecret(Number(request.params.channelId));
    const config = channel?.provider === "meta_cloud" ? readConfig<MetaStoredConfig>(channel.encryptedConfig) : null;
    const challenge = config?.verifyToken ? verifyMetaWebhookChallenge(request.query, config.verifyToken) : null;
    if (!challenge) return sendWebhookError(response, 403, "WEBHOOK_NOT_VERIFIED");
    return response.status(200).send(challenge);
  });

  app.post("/api/webhooks/whatsapp/meta/:channelId", async (request, response) => {
    const channel = await getWhatsAppChannelSecret(Number(request.params.channelId));
    if (!channel || channel.provider !== "meta_cloud" || !channel.encryptedConfig) return sendWebhookError(response, 404, "CHANNEL_NOT_FOUND");
    const appSecret = process.env.WHATSAPP_META_APP_SECRET;
    if (!appSecret) return sendWebhookError(response, 503, "META_WEBHOOK_NOT_CONFIGURED");
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const signature = request.header("x-hub-signature-256") || "";
    const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody(request)).digest("hex")}`;
    const received = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) return sendWebhookError(response, 401, "INVALID_SIGNATURE");
    const event = await recordWhatsAppWebhookEvent({ channelId: channel.id, provider: "meta_cloud", externalEventId: getWebhookEventId("meta_cloud", request.body), payloadJson: JSON.stringify(request.body) });
    if (event.duplicate) return response.status(200).json({ accepted: true, duplicate: true });
    try {
      for (const message of extractMetaInboundMessages(request.body)) {
        const ingested = await ingestInboundWhatsAppMessage({ channelId: channel.id, clientId: channel.clientId, sender: message.sender, providerMessageId: message.providerMessageId, body: message.body, occurredAt: message.occurredAt, rawPayloadJson: JSON.stringify(message.rawPayload) });
        await evaluateWhatsAppAutomationRules(channel.id, ingested.conversationId, ingested.messageId, channel.clientId);
      }
      await markWhatsAppWebhookEvent(event.id, "processed");
      return response.status(200).json({ accepted: true });
    } catch (error) {
      await markWhatsAppWebhookEvent(event.id, "failed", error instanceof Error ? error.message : "Erro ao processar evento");
      return sendWebhookError(response, 500, "EVENT_PROCESSING_FAILED");
    }
  });

  app.post("/api/webhooks/whatsapp/twilio/:channelId", async (request, response) => {
    const channel = await getWhatsAppChannelSecret(Number(request.params.channelId));
    const config = channel?.provider === "twilio" ? readConfig<TwilioStoredConfig>(channel.encryptedConfig) : null;
    const form = request.body as Record<string, string | undefined>;
    if (!channel || !config?.authToken || !verifyTwilioWebhookSignature({ url: originalUrl(request), form, signature: request.header("x-twilio-signature"), authToken: config.authToken })) return sendWebhookError(response, 401, "INVALID_SIGNATURE");
    const event = await recordWhatsAppWebhookEvent({ channelId: channel.id, provider: "twilio", externalEventId: getWebhookEventId("twilio", form), payloadJson: JSON.stringify(form) });
    if (event.duplicate) return response.status(200).type("text/xml").send("<Response />");
    const message = extractTwilioInboundMessage(form);
    try {
      if (message) {
        const ingested = await ingestInboundWhatsAppMessage({ channelId: channel.id, clientId: channel.clientId, sender: message.sender, providerMessageId: message.providerMessageId, body: message.body, occurredAt: message.occurredAt, rawPayloadJson: JSON.stringify(message.rawPayload) });
        await evaluateWhatsAppAutomationRules(channel.id, ingested.conversationId, ingested.messageId, channel.clientId);
      }
      await markWhatsAppWebhookEvent(event.id, "processed");
      return response.status(200).type("text/xml").send("<Response />");
    } catch (error) {
      await markWhatsAppWebhookEvent(event.id, "failed", error instanceof Error ? error.message : "Erro ao processar evento");
      return sendWebhookError(response, 500, "EVENT_PROCESSING_FAILED");
    }
  });
}

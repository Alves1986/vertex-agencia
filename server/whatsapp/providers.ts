import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type WhatsAppProvider = "meta_cloud" | "twilio";

export type MetaChannelConfig = {
  accessToken: string;
  verifyToken: string;
  phoneNumberId: string;
  graphVersion?: string;
};

export type TwilioChannelConfig = {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  from: string;
};

export type InboundWhatsAppMessage = {
  provider: WhatsAppProvider;
  externalEventId: string;
  providerMessageId: string;
  sender: string;
  body: string | null;
  occurredAt: Date;
  rawPayload: unknown;
};

export type OutboundWhatsAppRequest = {
  endpoint: string;
  headers: Record<string, string>;
  body: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseUnixSeconds(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000) : new Date();
}

function stableFallbackEventId(provider: WhatsAppProvider, payload: unknown) {
  return `${provider}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function verifyMetaWebhookChallenge(query: Record<string, unknown>, verifyToken: string) {
  const mode = asString(query["hub.mode"]);
  const suppliedToken = asString(query["hub.verify_token"]);
  const challenge = asString(query["hub.challenge"]);
  return mode === "subscribe" && suppliedToken === verifyToken && challenge ? challenge : null;
}

export function verifyTwilioWebhookSignature(input: {
  url: string;
  form: Record<string, string | undefined>;
  signature: string | undefined;
  authToken: string;
}) {
  if (!input.signature || !input.authToken) return false;
  const canonical = Object.keys(input.form)
    .sort()
    .reduce((value, key) => `${value}${key}${input.form[key] ?? ""}`, input.url);
  const expected = createHmac("sha1", input.authToken).update(canonical).digest("base64");
  const received = Buffer.from(input.signature);
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

export function extractMetaInboundMessages(payload: unknown): InboundWhatsAppMessage[] {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  const messages: InboundWhatsAppMessage[] = [];

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const changes = Array.isArray(entryRecord?.changes) ? entryRecord.changes : [];
    for (const change of changes) {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord?.value);
      const incoming = Array.isArray(value?.messages) ? value.messages : [];
      for (const item of incoming) {
        const message = asRecord(item);
        if (!message) continue;
        const id = asString(message.id);
        const sender = asString(message.from);
        if (!id || !sender) continue;
        const text = asRecord(message.text);
        messages.push({
          provider: "meta_cloud",
          externalEventId: id,
          providerMessageId: id,
          sender,
          body: asString(text?.body),
          occurredAt: parseUnixSeconds(message.timestamp),
          rawPayload: message,
        });
      }
    }
  }
  return messages;
}

export function extractTwilioInboundMessage(form: Record<string, string | undefined>): InboundWhatsAppMessage | null {
  const providerMessageId = form.MessageSid ?? form.SmsMessageSid;
  const sender = form.From;
  if (!providerMessageId || !sender) return null;
  return {
    provider: "twilio",
    externalEventId: providerMessageId,
    providerMessageId,
    sender,
    body: form.Body?.trim() || null,
    occurredAt: new Date(),
    rawPayload: form,
  };
}

export function getWebhookEventId(provider: WhatsAppProvider, payload: unknown) {
  if (provider === "meta_cloud") return extractMetaInboundMessages(payload)[0]?.externalEventId ?? stableFallbackEventId(provider, payload);
  const form = asRecord(payload);
  return asString(form?.MessageSid) ?? asString(form?.SmsMessageSid) ?? stableFallbackEventId(provider, payload);
}

export function buildMetaOutboundRequest(config: MetaChannelConfig, to: string, body: string): OutboundWhatsAppRequest {
  const graphVersion = config.graphVersion || "v20.0";
  return {
    endpoint: `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`,
    headers: { authorization: `Bearer ${config.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  };
}

export function buildTwilioOutboundRequest(config: TwilioChannelConfig, to: string, body: string): OutboundWhatsAppRequest {
  const payload = new URLSearchParams({ To: to, Body: body });
  if (config.messagingServiceSid) payload.set("MessagingServiceSid", config.messagingServiceSid);
  else payload.set("From", config.from);
  return {
    endpoint: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
    headers: { authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  };
}

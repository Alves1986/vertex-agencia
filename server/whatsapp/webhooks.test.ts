import { createHmac } from "node:crypto";
import { once } from "node:events";
import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getChannel: vi.fn(),
  recordEvent: vi.fn(),
  markEvent: vi.fn(),
  ingest: vi.fn(),
  evaluate: vi.fn(),
}));

vi.mock("../db", () => ({
  getWhatsAppChannelSecret: mocks.getChannel,
  recordWhatsAppWebhookEvent: mocks.recordEvent,
  markWhatsAppWebhookEvent: mocks.markEvent,
  ingestInboundWhatsAppMessage: mocks.ingest,
  evaluateWhatsAppAutomationRules: mocks.evaluate,
}));

vi.mock("../aiAds/crypto", () => ({ decryptProviderKey: (value: string) => value }));

import { registerWhatsAppWebhooks } from "./webhooks";

let server: Server | undefined;

async function startWebhookServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  registerWhatsAppWebhooks(app);
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Porta de teste indisponível");
  return `http://127.0.0.1:${address.port}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WHATSAPP_META_APP_SECRET = "meta-app-secret";
  mocks.ingest.mockResolvedValue({ contactId: 100, conversationId: 200, messageId: 300 });
  mocks.evaluate.mockResolvedValue([]);
  mocks.markEvent.mockResolvedValue(undefined);
});

afterEach(async () => {
  delete process.env.WHATSAPP_META_APP_SECRET;
  if (server) {
    server.close();
    await once(server, "close");
    server = undefined;
  }
});

describe("webhooks públicos de WhatsApp", () => {
  it("rejeita uma assinatura Meta inválida antes de registrar ou ingerir o evento", async () => {
    mocks.getChannel.mockResolvedValue({ id: 7, clientId: 1, provider: "meta_cloud", encryptedConfig: JSON.stringify({ verifyToken: "verify" }) });
    const origin = await startWebhookServer();

    const response = await fetch(`${origin}/api/webhooks/whatsapp/meta/7`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=invalida" }, body: JSON.stringify({ entry: [] }) });

    expect(response.status).toBe(401);
    expect(mocks.recordEvent).not.toHaveBeenCalled();
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("trata reentrega Meta como idempotente sem repetir ingestão ou automação", async () => {
    mocks.getChannel.mockResolvedValue({ id: 7, clientId: 1, provider: "meta_cloud", encryptedConfig: JSON.stringify({ verifyToken: "verify" }) });
    mocks.recordEvent.mockResolvedValue({ id: 90, duplicate: true });
    const origin = await startWebhookServer();
    const body = JSON.stringify({ entry: [] });
    const signature = `sha256=${createHmac("sha256", "meta-app-secret").update(body).digest("hex")}`;

    const response = await fetch(`${origin}/api/webhooks/whatsapp/meta/7`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": signature }, body });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accepted: true, duplicate: true });
    expect(mocks.ingest).not.toHaveBeenCalled();
    expect(mocks.evaluate).not.toHaveBeenCalled();
    expect(mocks.markEvent).not.toHaveBeenCalled();
  });

  it("ingere uma mensagem Meta válida e avalia automações no mesmo contexto isolado", async () => {
    mocks.getChannel.mockResolvedValue({ id: 7, clientId: 1, provider: "meta_cloud", encryptedConfig: JSON.stringify({ verifyToken: "verify" }) });
    mocks.recordEvent.mockResolvedValue({ id: 90, duplicate: false });
    const origin = await startWebhookServer();
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "5511999999999", timestamp: "1724256000", text: { body: "Preciso de ajuda" } }] } }] }] };
    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", "meta-app-secret").update(body).digest("hex")}`;

    const response = await fetch(`${origin}/api/webhooks/whatsapp/meta/7`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": signature }, body });

    expect(response.status).toBe(200);
    expect(mocks.ingest).toHaveBeenCalledWith(expect.objectContaining({ channelId: 7, clientId: 1, providerMessageId: "wamid.1", body: "Preciso de ajuda" }));
    expect(mocks.evaluate).toHaveBeenCalledWith(7, 200, 300, 1);
    expect(mocks.markEvent).toHaveBeenCalledWith(90, "processed");
  });

  it("aceita Twilio assinado, ingere a mensagem e chama a automação sem gerar resposta XML externa", async () => {
    mocks.getChannel.mockResolvedValue({ id: 8, clientId: 2, provider: "twilio", encryptedConfig: JSON.stringify({ authToken: "twilio-token" }) });
    mocks.recordEvent.mockResolvedValue({ id: 91, duplicate: false });
    const origin = await startWebhookServer();
    const form = new URLSearchParams({ Body: "Quero falar com alguém", From: "whatsapp:+5511888888888", MessageSid: "SM1" });
    const canonical = `${origin}/api/webhooks/whatsapp/twilio/8BodyQuero falar com alguémFromwhatsapp:+5511888888888MessageSidSM1`;
    const signature = createHmac("sha1", "twilio-token").update(canonical).digest("base64");

    const response = await fetch(`${origin}/api/webhooks/whatsapp/twilio/8`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature }, body: form });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("<Response />");
    expect(mocks.ingest).toHaveBeenCalledWith(expect.objectContaining({ channelId: 8, clientId: 2, providerMessageId: "SM1", body: "Quero falar com alguém" }));
    expect(mocks.evaluate).toHaveBeenCalledWith(8, 200, 300, 2);
    expect(mocks.markEvent).toHaveBeenCalledWith(91, "processed");
  });
});

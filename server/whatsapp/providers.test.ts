import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildMetaOutboundRequest,
  buildTwilioOutboundRequest,
  extractMetaInboundMessages,
  extractTwilioInboundMessage,
  verifyMetaWebhookChallenge,
  verifyTwilioWebhookSignature,
} from "./providers";

describe("adaptadores de WhatsApp", () => {
  it("aceita somente o desafio oficial da Meta com token correspondente", () => {
    expect(verifyMetaWebhookChallenge({ "hub.mode": "subscribe", "hub.verify_token": "segredo", "hub.challenge": "desafio" }, "segredo")).toBe("desafio");
    expect(verifyMetaWebhookChallenge({ "hub.mode": "subscribe", "hub.verify_token": "outro", "hub.challenge": "desafio" }, "segredo")).toBeNull();
  });

  it("verifica assinatura do webhook Twilio sem aceitar assinatura divergente", () => {
    const url = "https://vertex.example/api/webhooks/whatsapp/twilio/7";
    const form = { Body: "Olá", From: "whatsapp:+5511999999999", MessageSid: "SM1" };
    const canonical = `${url}BodyOláFromwhatsapp:+5511999999999MessageSidSM1`;
    const signature = createHmac("sha1", "token").update(canonical).digest("base64");
    expect(verifyTwilioWebhookSignature({ url, form, signature, authToken: "token" })).toBe(true);
    expect(verifyTwilioWebhookSignature({ url, form, signature: "inválida", authToken: "token" })).toBe(false);
  });

  it("normaliza mensagens de entrada da Meta e do BSP no mesmo contrato", () => {
    const meta = extractMetaInboundMessages({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "5511999999999", timestamp: "1724256000", text: { body: "Preciso de ajuda" } }] } }] }] });
    const twilio = extractTwilioInboundMessage({ MessageSid: "SM1", From: "whatsapp:+5511888888888", Body: "Quero falar com alguém" });
    expect(meta[0]).toMatchObject({ provider: "meta_cloud", providerMessageId: "wamid.1", body: "Preciso de ajuda" });
    expect(twilio).toMatchObject({ provider: "twilio", providerMessageId: "SM1", body: "Quero falar com alguém" });
  });

  it("constrói envios pelos dois provedores sem vazar o token no endereço", () => {
    const meta = buildMetaOutboundRequest({ accessToken: "token-meta", verifyToken: "verify", phoneNumberId: "123" }, "5511999999999", "Olá");
    const twilio = buildTwilioOutboundRequest({ accountSid: "AC1", authToken: "token-twilio", from: "whatsapp:+5511777777777" }, "whatsapp:+5511999999999", "Olá");
    expect(meta.endpoint).toContain("/123/messages");
    expect(meta.endpoint).not.toContain("token-meta");
    expect(twilio.endpoint).toContain("/AC1/Messages.json");
    expect(twilio.body).toContain("From=whatsapp%3A%2B5511777777777");
  });
});

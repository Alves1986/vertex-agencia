import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptProviderKey } from "../aiAds/crypto";
import { dispatchApprovedWhatsAppMessage, isWhatsAppExternalDeliveryEnabled } from "./delivery";

describe("despacho oficial de WhatsApp aprovado", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.WHATSAPP_OUTBOUND_ENABLED;
  });

  it("envia um rascunho Meta somente pelo adaptador oficial e preserva o identificador retornado", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.meta-1" }] }), { status: 200 }));
    const result = await dispatchApprovedWhatsAppMessage({ provider: "meta_cloud", encryptedConfig: encryptProviderKey(JSON.stringify({ accessToken: "meta-secret", verifyToken: "verify", phoneNumberId: "123", graphVersion: "v20.0" })), destination: "5511999999999", body: "Olá" }, fetcher);

    expect(result.providerMessageId).toBe("wamid.meta-1");
    expect(fetcher).toHaveBeenCalledWith("https://graph.facebook.com/v20.0/123/messages", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer meta-secret" }) }));
  });

  it("envia um rascunho Twilio pelo endpoint oficial e registra o SID", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sid: "SM123" }), { status: 201 }));
    const result = await dispatchApprovedWhatsAppMessage({ provider: "twilio", encryptedConfig: encryptProviderKey(JSON.stringify({ accountSid: "AC123", authToken: "twilio-secret", from: "whatsapp:+5511999999999" })), destination: "whatsapp:+5511888888888", body: "Olá" }, fetcher);

    expect(result.providerMessageId).toBe("SM123");
    expect(fetcher).toHaveBeenCalledWith("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json", expect.objectContaining({ body: expect.stringContaining("To=whatsapp%3A%2B5511888888888") }));
  });

  it("não considera entregue uma resposta recusada ou sem identificador rastreável", async () => {
    await expect(dispatchApprovedWhatsAppMessage({ provider: "meta_cloud", encryptedConfig: encryptProviderKey(JSON.stringify({ accessToken: "meta-secret", verifyToken: "verify", phoneNumberId: "123" })), destination: "5511999999999", body: "Olá" }, vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid" } }), { status: 400 })))).rejects.toThrow("recusou a entrega");

    await expect(dispatchApprovedWhatsAppMessage({ provider: "twilio", encryptedConfig: encryptProviderKey(JSON.stringify({ accountSid: "AC123", authToken: "twilio-secret", from: "whatsapp:+5511999999999" })), destination: "whatsapp:+5511888888888", body: "Olá" }, vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "queued" }), { status: 201 })))).rejects.toThrow("identificador de mensagem");
  });

  it("mantém o transporte desativado até uma habilitação explícita de ambiente", () => {
    expect(isWhatsAppExternalDeliveryEnabled()).toBe(false);
    process.env.WHATSAPP_OUTBOUND_ENABLED = "true";
    expect(isWhatsAppExternalDeliveryEnabled()).toBe(true);
  });
});

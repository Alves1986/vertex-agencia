import { describe, expect, it } from "vitest";

describe("credenciais de e-mail transacional", () => {
  it("valida a chave Resend e o remetente configurado sem enviar mensagem", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REPORTS_FROM_EMAIL;
    expect(apiKey).toMatch(/^re_/);
    expect(from).toContain("@");

    const response = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${apiKey}` } });
    expect(response.ok).toBe(true);
  }, 15_000);
});

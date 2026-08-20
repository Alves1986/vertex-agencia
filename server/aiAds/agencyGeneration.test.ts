import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAgencyPrompt, extractProviderUsage, testAgencyConnection } from "./agencyGeneration";

describe("buildAgencyPrompt", () => {
  it("preserva lacunas de evidência e evita instruções de carrossel composto", () => {
    const prompt = buildAgencyPrompt({ mode: "bundle", clientName: "Globo Acabamentos", campaignName: "Campanha", objective: "Gerar demanda", briefing: "Valorizar acabamentos", profile: { voice: "direta", positioning: null, audience: null, offers: null, proofPolicy: null, visualSystem: null } });
    expect(prompt).toContain("nunca invente fatos");
    expect(prompt).toContain("cada slide é uma arte vertical independente");
    expect(prompt).toContain("Globo Acabamentos");
  });
});

describe("extractProviderUsage", () => {
  it("preserva somente métricas realmente retornadas pelo provedor", () => {
    expect(extractProviderUsage("openai", { usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } })).toEqual({ inputTokens: 12, outputTokens: 8, totalTokens: 20 });
    expect(extractProviderUsage("gemini", { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } })).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(extractProviderUsage("anthropic", {})).toBeNull();
  });
});

describe("testAgencyConnection", () => {
  afterEach(() => vi.restoreAllMocks());

  it("valida uma chave externa sem retornar o segredo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await expect(testAgencyConnection({ provider: "openai", apiBaseUrl: null, defaultModel: "gpt-5-mini", apiKey: "sk-test-secret" })).resolves.toEqual({ provider: "openai", message: "Conexão validada. A chave pode ser protegida para este cliente." });
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({ headers: { Authorization: "Bearer sk-test-secret" } }));
  });

  it("normaliza uma chave recusada sem vazar seu conteúdo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    await expect(testAgencyConnection({ provider: "gemini", apiBaseUrl: null, defaultModel: "gemini-2.5-flash", apiKey: "AIza-secret-to-hide" })).rejects.toThrow("A chave de API foi recusada pelo provedor.");
    await expect(testAgencyConnection({ provider: "gemini", apiBaseUrl: null, defaultModel: "gemini-2.5-flash", apiKey: "AIza-secret-to-hide" })).rejects.not.toThrow("AIza-secret-to-hide");
  });
});

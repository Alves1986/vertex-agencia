import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("../_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { buildAgencyPrompt, extractProviderUsage, generateAgencyOutput, normalizeCarouselRole, testAgencyConnection } from "./agencyGeneration";

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

describe("generateAgencyOutput", () => {
  it("usa a instrução textual de JSON no motor integrado sem habilitar o modo JSON incompatível", async () => {
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ carousel: [{ slideNumber: 1, role: "cover", headline: "Revisão", body: "Fluxo validado", visualDirection: "Contraste alto", imagePrompt: "Peça vertical" }] }) } }], usage: { prompt_tokens: 12, completion_tokens: 30, total_tokens: 42 } });

    await expect(generateAgencyOutput({ provider: "manus", defaultModel: "gpt-5-mini", apiBaseUrl: null, encryptedApiKey: null }, "Retorne um carrossel.")).resolves.toMatchObject({ provider: "manus", model: "gpt-5-mini", output: { carousel: [expect.objectContaining({ headline: "Revisão" })] } });
    expect(mocks.invokeLLM.mock.calls[0][0].responseFormat).toBeUndefined();
    expect(mocks.invokeLLM.mock.calls[0][0].messages[0].content).toContain("começar com {");
  });

  it("normaliza rótulos narrativos livres para os papéis permitidos do carrossel", () => {
    expect(normalizeCarouselRole("Introdução / orientação rápida", 0, 3)).toBe("cover");
    expect(normalizeCarouselRole("Critérios práticos", 1, 3)).toBe("context");
    expect(normalizeCarouselRole("Próximo passo / convocação", 2, 3)).toBe("cta");
    expect(normalizeCarouselRole("Rótulo não mapeado", 1, 3)).toBe("insight");
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

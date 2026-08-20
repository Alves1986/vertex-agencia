import { describe, expect, it } from "vitest";
import { agencyModeOptions, getCampaignGenerationBlock, providerCatalog, publicationGuardrail } from "./Agency";

describe("modos da Agência IA", () => {
  it("mantém fluxos integrados e separados para o mesmo briefing", () => {
    expect(Object.keys(agencyModeOptions)).toEqual(["bundle", "ads", "carousel", "video", "strategy", "council"]);
    expect(agencyModeOptions.bundle.label).toBe("Campanha integrada");
    expect(agencyModeOptions.carousel.description).toContain("artes independentes");
    expect(agencyModeOptions.council.description).toContain("risco humano");
  });

  it("expõe provedores configuráveis e mantém a publicação externa sob decisão humana", () => {
    expect(providerCatalog.map(item => item.value)).toEqual(["manus", "openai", "openai_compatible", "gemini", "anthropic"]);
    expect(providerCatalog.find(item => item.value === "manus")?.description).toContain("sem colar uma chave externa");
    expect(publicationGuardrail).toContain("não envia conteúdo automaticamente");
  });

  it("bloqueia visualmente a geração quando a conexão da campanha foi desativada", () => {
    expect(getCampaignGenerationBlock(9, { label: "OpenAI do cliente", status: "disabled" })).toEqual({ blocked: true, message: "Provedor OpenAI do cliente desativado — reative a conexão ou crie uma nova campanha com outro provedor." });
    expect(getCampaignGenerationBlock(9, { label: "OpenAI do cliente", status: "active" })).toEqual({ blocked: false, message: null });
  });
});

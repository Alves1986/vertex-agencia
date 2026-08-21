import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const PassThrough = ({ children }: { children?: React.ReactNode }) => createElement(React.Fragment, null, children);
  return {
    Dialog: PassThrough,
    DialogContent: PassThrough,
    DialogDescription: PassThrough,
    DialogFooter: PassThrough,
    DialogHeader: PassThrough,
    DialogTitle: PassThrough,
  };
});

import { agencyModeOptions, buildGuidedBriefing, formatLastConnectionTest, getCampaignGenerationBlock, getConnectionRevalidationState, guidedServiceCatalog, ProviderConnectionDialog, providerCatalog, publicationGuardrail } from "./Agency";

describe("modos da Agência IA", () => {
  it("mantém fluxos integrados e separados para o mesmo briefing", () => {
    expect(Object.keys(agencyModeOptions)).toEqual(["bundle", "ads", "carousel", "video", "strategy", "council"]);
    expect(agencyModeOptions.bundle.label).toBe("Campanha integrada");
    expect(agencyModeOptions.carousel.description).toContain("artes independentes");
    expect(agencyModeOptions.council.description).toContain("risco humano");
  });

  it("expõe serviços guiados com perguntas próprias para criação de marketing", () => {
    expect(guidedServiceCatalog.map(item => item.key)).toEqual(["bundle", "ads", "carousel", "video", "strategy", "council"]);
    expect(guidedServiceCatalog.find(item => item.key === "carousel")?.fields.map(field => field.key)).toContain("slideCount");
    expect(guidedServiceCatalog.find(item => item.key === "video")?.capability).toBe("Roteiro audiovisual");
    expect(guidedServiceCatalog.find(item => item.key === "council")?.fields.map(field => field.key)).toContain("options");
  });

  it("estrutura o briefing guiado e mantém a entrega sujeita à revisão humana", () => {
    const carousel = guidedServiceCatalog.find(item => item.key === "carousel");
    expect(carousel).toBeDefined();
    const briefing = buildGuidedBriefing(carousel!, { keyMessage: "Como escolher um acabamento durável", audience: "Arquitetos", slideCount: "7" });
    expect(briefing).toContain("Serviço selecionado: Carrossel");
    expect(briefing).toContain("Capacidade ativada: Narrativa para carrossel");
    expect(briefing).toContain("Quantidade desejada de slides: 7");
    expect(briefing).toContain("revisão humana");
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

  it("exige nova chave e teste antes de salvar ao editar provedor, URL ou modelo", () => {
    const original = "openai||gpt-5-mini";
    expect(getConnectionRevalidationState({ editing: true, originalConfiguration: original, provider: "openai", baseUrl: "", model: "gpt-5", apiKey: "" })).toMatchObject({ configurationChanged: true, requiresNewKey: true, requiresTest: true });
    expect(getConnectionRevalidationState({ editing: true, originalConfiguration: original, provider: "openai", baseUrl: "", model: "gpt-5-mini", apiKey: "" })).toMatchObject({ configurationChanged: false, requiresNewKey: false, requiresTest: false });
  });

  it("apresenta a auditoria de teste sem nunca derivar ou expor a chave original", () => {
    expect(formatLastConnectionTest(null)).toBe("Ainda não testada");
    expect(formatLastConnectionTest(new Date("2026-08-20T02:00:00.000Z"))).toMatch(/20\/08\/2026/);
  });

  it("renderiza a edição incompatível com nova chave, aviso de teste e salvamento bloqueado", () => {
    const html = renderToStaticMarkup(createElement(ProviderConnectionDialog, {
      open: true,
      onOpenChange: () => undefined,
      onSubmit: event => event.preventDefault(),
      onCancel: () => undefined,
      provider: { label: "OpenAI do cliente", provider: "openai", model: "gpt-5", imageModel: "", baseUrl: "", apiKey: "" },
      setProvider: () => undefined,
      editing: true,
      selectedProvider: { description: "Para texto, estratégia e ideação do cliente." },
      saving: false,
      testing: false,
      testState: "idle",
      testIsCurrent: false,
      requiresTest: true,
      requiresNewKey: true,
      onTest: () => undefined,
    }));

    expect(html).toContain("Você alterou o provedor, URL ou modelo");
    expect(html).toContain("Nova chave de API");
    expect(html).toContain("A alteração exige uma nova chave e uma validação concluída.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Salvar alterações/);
  });
});

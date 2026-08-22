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

import { agencyModeOptions, buildCarouselPreview, buildGuidedBriefing, buildGuidedCampaignPayload, formatLastConnectionTest, getCampaignGenerationBlock, getConnectionRevalidationState, getGuidedCreationValidation, getProviderTestDiagnostic, guidedServiceCatalog, parseCarouselTemplateFields, ProviderConnectionDialog, providerCatalog, providerModelPresets, publicationGuardrail, reorderCarouselPreview } from "./Agency";

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
    const briefing = buildGuidedBriefing(carousel!, { keyMessage: "Como escolher um acabamento durável", audience: "Arquitetos", slideCount: "7", format: "Instagram vertical", visualDirection: "Texturas reais", callToAction: "Salve este post" });
    expect(briefing).toContain("Serviço selecionado: Carrossel");
    expect(briefing).toContain("Capacidade ativada: Narrativa para carrossel");
    expect(briefing).toContain("Quantidade de slides: 7");
    expect(briefing).toContain("revisão humana");
  });

  it("exige a estrutura necessária do carrossel e limita a quantidade de slides", () => {
    const carousel = guidedServiceCatalog.find(item => item.key === "carousel")!;
    expect(carousel.fields.filter(field => field.required).map(field => field.key)).toEqual(["keyMessage", "audience", "slideCount", "format", "visualDirection", "callToAction"]);
    expect(getGuidedCreationValidation(carousel, { name: "Carrossel de revestimentos", objective: "Gerar salvamentos", connectionId: "" }, { keyMessage: "Escolha com segurança", audience: "Arquitetos", slideCount: "2", format: "Vertical", visualDirection: "Minimalista", callToAction: "Salve" })).toContain("entre 3 e 10 slides");
  });

  it("monta o payload que inicia a capacidade de carrossel para o cliente selecionado", () => {
    const carousel = guidedServiceCatalog.find(item => item.key === "carousel")!;
    const payload = buildGuidedCampaignPayload(14, carousel, { name: "Carrossel de acabamento", objective: "Aumentar consideração", connectionId: "7" }, { keyMessage: "Acabamento certo", audience: "Arquitetos", slideCount: "6", format: "Vertical 1080 × 1350", visualDirection: "Tons minerais", callToAction: "Fale com a equipe" });
    expect(payload).toMatchObject({ clientId: 14, mode: "carousel", generationMode: "carousel", serviceKey: "carousel", providerConnectionId: 7 });
    expect(payload.briefing).toContain("Narrativa para carrossel");
  });

  it("prepara uma prévia editável com estrutura de capa, desenvolvimento e CTA", () => {
    const preview = buildCarouselPreview({ keyMessage: "Escolha o revestimento certo", audience: "Arquitetos", slideCount: "5", visualDirection: "Texturas naturais", callToAction: "Solicite o catálogo" });
    expect(preview).toHaveLength(5);
    expect(preview[0]).toMatchObject({ slideNumber: 1, role: "cover", headline: "Escolha o revestimento certo" });
    expect(preview.at(-1)).toMatchObject({ slideNumber: 5, role: "cta", headline: "Solicite o catálogo" });
    expect(preview.every(slide => slide.visualDirection === "Texturas naturais")).toBe(true);
  });

  it("reordena a prévia de carrossel e renumera os slides sem alterar o conteúdo", () => {
    const preview = buildCarouselPreview({ keyMessage: "Escolha o revestimento certo", audience: "Arquitetos", slideCount: "5", visualDirection: "Texturas naturais", callToAction: "Solicite o catálogo" });
    const reordered = reorderCarouselPreview(preview, 5, 2);
    expect(reordered.map(slide => slide.slideNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(reordered[1]).toMatchObject({ role: "cta", headline: "Solicite o catálogo" });
    expect(reordered[0]).toMatchObject({ role: "cover", headline: "Escolha o revestimento certo" });
  });

  it("carrega somente campos reconhecidos de modelos do cliente e inclui ativos autorizados no briefing", () => {
    expect(parseCarouselTemplateFields('{"keyMessage":"Guia de escolha","audience":"Projetistas","invalid":"ignorar"}')).toEqual({ keyMessage: "Guia de escolha", audience: "Projetistas" });
    const carousel = guidedServiceCatalog.find(item => item.key === "carousel")!;
    const briefing = buildGuidedBriefing(carousel, { keyMessage: "Guia", audience: "Projetistas", slideCount: "4", format: "Vertical", visualDirection: "Minimal", callToAction: "Salve" }, [{ id: 1, name: "Logo aprovado", assetType: "logo", assetUrl: "https://example.com/logo.png", status: "authorized" }]);
    expect(briefing).toContain("Referências visuais autorizadas: Logo aprovado (logo)");
  });

  it("expõe provedores configuráveis e mantém a publicação externa sob decisão humana", () => {
    expect(providerCatalog.map(item => item.value)).toEqual(["manus", "openai", "openai_compatible", "gemini", "anthropic", "nvidia"]);
    expect(providerCatalog.find(item => item.value === "manus")?.description).toContain("sem colar uma chave externa");
    expect(providerCatalog.find(item => item.value === "openai")?.docsUrl).toBe("https://developers.openai.com/api/docs");
    expect(providerCatalog.find(item => item.value === "gemini")?.docsUrl).toBe("https://ai.google.dev/gemini-api/docs");
    expect(providerCatalog.find(item => item.value === "anthropic")?.docsUrl).toBe("https://platform.claude.com/docs/en/home");
    expect(providerCatalog.find(item => item.value === "nvidia")?.docsUrl).toBe("https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html");
    expect(providerModelPresets.nvidia.map(item => item.value)).toContain("meta/llama-3.3-70b-instruct");
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

  it("traduz falhas técnicas em orientações acionáveis sem retornar detalhes brutos", () => {
    expect(getProviderTestDiagnostic("A chave de API foi recusada pelo provedor.")).toMatchObject({ title: "A chave não foi aceita" });
    expect(getProviderTestDiagnostic("O teste de conexão excedeu o tempo esperado. Tente novamente.")).toMatchObject({ title: "O provedor demorou para responder" });
    expect(getProviderTestDiagnostic("Não foi possível alcançar o provedor. Verifique a URL e tente novamente.")).toMatchObject({ title: "Não foi possível alcançar o provedor" });
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
      selectedProvider: { value: "openai", label: "OpenAI", defaultModel: "gpt-5-mini", description: "Para texto, estratégia e ideação do cliente.", docsUrl: "https://developers.openai.com/api/docs", docsLabel: "Documentação da OpenAI" },
      saving: false,
      testing: false,
      testState: "failed",
      testIsCurrent: false,
      requiresTest: true,
      requiresNewKey: true,
      testError: "A chave de API foi recusada pelo provedor.",
      onConfigurationChange: () => undefined,
      onTest: () => undefined,
    }));

    expect(html).toContain("Escolha o motor");
    expect(html).toContain("Defina a configuração");
    expect(html).toContain("Teste antes de proteger");
    expect(html).toContain("Manus integrado");
    expect(html).toContain("Documentação da OpenAI");
    expect(html).toContain("Modelo de IA que responderá");
    expect(html).toContain("Informar identificador personalizado");
    expect(html).toContain("A chave não foi aceita");
    expect(html).toContain("Você alterou o provedor, URL ou modelo");
    expect(html).toContain("Nova chave de API");
    expect(html).toContain("O teste falhou. Corrija o item indicado e repita a validação.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Salvar alterações/);
  });

  it("libera o salvamento após teste válido sem exigir nova validação por modelo de imagem opcional", () => {
    const html = renderToStaticMarkup(createElement(ProviderConnectionDialog, {
      open: true,
      onOpenChange: () => undefined,
      onSubmit: event => event.preventDefault(),
      onCancel: () => undefined,
      provider: { label: "OpenAI do cliente", provider: "openai", model: "gpt-5-mini", imageModel: "gpt-image-1", baseUrl: "", apiKey: "sk-validada" },
      setProvider: () => undefined,
      editing: false,
      selectedProvider: { value: "openai", label: "OpenAI", defaultModel: "gpt-5-mini", description: "Para texto, estratégia e ideação do cliente.", docsUrl: "https://developers.openai.com/api/docs", docsLabel: "Documentação da OpenAI" },
      saving: false,
      testing: false,
      testState: "passed",
      testError: null,
      testIsCurrent: true,
      requiresTest: true,
      requiresNewKey: false,
      onConfigurationChange: () => undefined,
      onTest: () => undefined,
    }));

    expect(html).toContain("Conexão validada. Pode salvar com segurança.");
    expect(html).toContain("agency-provider-dialog-body");
    expect(html).toMatch(/<button class="ops-primary-button" type="submit">.*Proteger conexão/);
  });

  it("apresenta os presets NVIDIA como cartões selecionáveis e mantém a alternativa personalizada", () => {
    const html = renderToStaticMarkup(createElement(ProviderConnectionDialog, {
      open: true,
      onOpenChange: () => undefined,
      onSubmit: event => event.preventDefault(),
      onCancel: () => undefined,
      provider: { label: "NVIDIA · Conteúdo", provider: "nvidia", model: "meta/llama-3.3-70b-instruct", imageModel: "", baseUrl: "", apiKey: "" },
      setProvider: () => undefined,
      editing: false,
      selectedProvider: providerCatalog.find(item => item.value === "nvidia")!,
      saving: false,
      testing: false,
      testState: "idle",
      testError: null,
      testIsCurrent: false,
      requiresTest: true,
      requiresNewKey: false,
      onConfigurationChange: () => undefined,
      onTest: () => undefined,
    }));

    expect(html).toContain("Modelos NVIDIA NIM");
    expect(html).toContain("Llama 3.3 70B Instruct");
    expect(html).toContain("NVIDIA Nemotron 70B");
    expect(html).toContain("Qwen3 235B");
    expect(html).toContain("Informar outro modelo");
    expect(html).toContain('class="agency-nvidia-preset-grid"');
    expect(html).toContain('aria-checked="true"');
  });
});

import { buildAgencyPrompt, generateAgencyOutput, testAgencyConnection } from "../server/aiAds/agencyGeneration";

const prompt = buildAgencyPrompt({
  mode: "carousel",
  clientName: "Globo Acabamentos",
  campaignName: "Validação interna de carrossel",
  objective: "Confirmar o fluxo completo de geração estruturada antes de uma criação real.",
  briefing: "Crie exatamente 3 slides de validação interna sobre como orientar a escolha de acabamentos. Não cite preços, métricas, depoimentos ou promessas. Quando depender de informação de produto, escreva [FONTE PENDENTE]. O último slide deve convidar a equipe a consultar um especialista.",
  profile: {
    positioning: "Curadoria de acabamentos para projetos residenciais e comerciais.",
    voice: "Clara, consultiva e objetiva.",
    audience: "Arquitetos, designers e consumidores em fase de decisão.",
    proofPolicy: "Não inventar métricas, resultados, preços, depoimentos ou fontes.",
    visualSystem: "Composição vertical contemporânea, materiais em destaque e contraste legível.",
  },
});

const connection = { provider: "manus" as const, defaultModel: "gpt-5-mini", apiBaseUrl: null, encryptedApiKey: null };
const probe = await testAgencyConnection(connection);
const result = await generateAgencyOutput(connection, prompt);
const slides = result.output.carousel ?? [];
const allowedRoles = new Set(["cover", "context", "insight", "proof", "solution", "cta"]);
const valid = slides.length >= 3 && slides.every(slide => slide.slideNumber >= 1 && allowedRoles.has(slide.role) && slide.headline.trim() && slide.visualDirection.trim() && slide.imagePrompt.trim());

if (!valid) throw new Error("A geração não retornou pelo menos três slides estruturados e completos.");

console.log(JSON.stringify({ status: "validated", provider: result.provider, model: result.model, connection: probe.message, slideCount: slides.length, usage: result.usage, slides: slides.map(slide => ({ slideNumber: slide.slideNumber, role: slide.role, headline: slide.headline })) }, null, 2));

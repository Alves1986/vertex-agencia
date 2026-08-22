import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  addMarketingResearchSource: vi.fn(), createEditorialItem: vi.fn(), createMarketingResearch: vi.fn(), createPaidMediaPlan: vi.fn(), createPaidMediaSnapshot: vi.fn(), getPaidMediaSummary: vi.fn(), listEditorialItems: vi.fn(), listMarketingResearches: vi.fn(), listMarketingResearchSources: vi.fn(), listPaidMediaPlans: vi.fn(), listPaidMediaSnapshots: vi.fn(), updateEditorialItem: vi.fn(), updateMarketingResearch: vi.fn(), updatePaidMediaPlanStatus: vi.fn(), getOperationalUserId: vi.fn(),
}));
vi.mock("../db", () => mocks);
vi.mock("./helpers", () => ({ getOperationalUserId: mocks.getOperationalUserId }));
import { intelligenceRouter } from "./intelligence";

function context(role: "admin" | "user" = "admin"): TrpcContext {
  return { user: { id: 1, openId: "intelligence-test", name: "Teste", email: "teste@vertex.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("contratos de conteúdo, mídia e pesquisa", () => {
  beforeEach(() => vi.clearAllMocks());
  it("bloqueia a camada de inteligência para usuários não administrativos", async () => {
    const caller = intelligenceRouter.createCaller(context("user"));
    await expect(caller.editorialItems({ clientId: 3 })).rejects.toThrow("geridos pela equipe administrativa");
    await expect(caller.researches({ clientId: 3 })).rejects.toThrow("geridos pela equipe administrativa");
  });
  it("registra conteúdo, mídia e fontes verificáveis no cliente explicitamente informado", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createEditorialItem.mockResolvedValue(21); mocks.createPaidMediaPlan.mockResolvedValue(22); mocks.createPaidMediaSnapshot.mockResolvedValue(23); mocks.createMarketingResearch.mockResolvedValue(24); mocks.addMarketingResearchSource.mockResolvedValue(25);
    const caller = intelligenceRouter.createCaller(context());
    await expect(caller.createEditorialItem({ clientId: 3, title: "Pauta institucional", channel: "linkedin" })).resolves.toEqual({ id: 21 });
    await expect(caller.createMediaPlan({ clientId: 3, name: "Captação", platform: "meta", objective: "Leads qualificados", plannedBudgetCents: 50000 })).resolves.toEqual({ id: 22 });
    await expect(caller.createMediaSnapshot({ clientId: 3, mediaPlanId: 22, recordedAt: new Date("2026-08-20"), spendCents: 1000, impressions: 100, reach: 90, clicks: 10, leads: 2, conversions: 1, conversionValueCents: 5000 })).resolves.toEqual({ id: 23 });
    await expect(caller.createResearch({ clientId: 3, title: "Mercado regional", objective: "Compreender demanda", question: "Quais tendências influenciam a decisão de compra?" })).resolves.toEqual({ id: 24 });
    await expect(caller.addResearchSource({ clientId: 3, researchId: 24, sourceType: "report", title: "Fonte pública", url: "https://example.com/relatorio" })).resolves.toEqual({ id: 25 });
    expect(mocks.createPaidMediaSnapshot).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, mediaPlanId: 22 }));
    expect(mocks.addMarketingResearchSource).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, researchId: 24, url: "https://example.com/relatorio" }));
  });
});

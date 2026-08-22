import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  createCommercialProposal: vi.fn(), createFinancialEntry: vi.fn(), createSalesActivity: vi.fn(), createSalesLead: vi.fn(), createServiceContract: vi.fn(),
  getClientProfitability: vi.fn(), listCommercialProposals: vi.fn(), listFinancialEntries: vi.fn(), listSalesActivities: vi.fn(), listSalesLeads: vi.fn(), listServiceContracts: vi.fn(),
  updateCommercialProposalStatus: vi.fn(), updateSalesLead: vi.fn(), updateServiceContractStatus: vi.fn(), getOperationalUserId: vi.fn(),
}));
vi.mock("../db", () => mocks);
vi.mock("./helpers", () => ({ getOperationalUserId: mocks.getOperationalUserId }));
import { commercialRouter } from "./commercial";

function context(role: "admin" | "user" = "admin"): TrpcContext {
  return { user: { id: 1, openId: "commercial-test", name: "Teste", email: "teste@vertex.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("contratos comerciais", () => {
  beforeEach(() => vi.clearAllMocks());
  it("restringe CRM e rentabilidade à administração", async () => {
    const caller = commercialRouter.createCaller(context("user"));
    await expect(caller.leads()).rejects.toThrow("restrita à equipe administrativa");
    await expect(caller.profitability({ clientId: 3 })).rejects.toThrow("restrita à equipe administrativa");
    expect(mocks.listSalesLeads).not.toHaveBeenCalled();
  });
  it("mantém lead, proposta, contrato e lançamento vinculados ao identificador do cliente", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createSalesLead.mockResolvedValue(11); mocks.createCommercialProposal.mockResolvedValue(12); mocks.createServiceContract.mockResolvedValue(13); mocks.createFinancialEntry.mockResolvedValue(14); mocks.getClientProfitability.mockResolvedValue({ clientId: 3, mrrCents: 99000 });
    const caller = commercialRouter.createCaller(context());
    await expect(caller.createLead({ companyName: "Empresa Alfa", contactEmail: "contato@alfa.com" })).resolves.toEqual({ id: 11 });
    await expect(caller.createProposal({ leadId: 11, proposalNumber: "P-001", title: "Plano mensal", scope: "Gestão mensal de marketing.", amountCents: 99000 })).resolves.toEqual({ id: 12 });
    await expect(caller.createContract({ clientId: 3, proposalId: 12, code: "C-001", title: "Plano mensal", scope: "Gestão mensal de marketing.", billingCycle: "monthly", recurringRevenueCents: 99000 })).resolves.toEqual({ id: 13 });
    await expect(caller.createFinancialEntry({ clientId: 3, contractId: 13, entryType: "revenue", description: "Mensalidade", amountCents: 99000 })).resolves.toEqual({ id: 14 });
    await expect(caller.profitability({ clientId: 3 })).resolves.toMatchObject({ clientId: 3, mrrCents: 99000 });
    expect(mocks.createServiceContract).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, proposalId: 12 }));
    expect(mocks.createFinancialEntry).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, contractId: 13 }));
  });
});

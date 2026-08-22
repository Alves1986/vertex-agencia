import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  createClientConsent: vi.fn(), getExecutiveDashboard: vi.fn(), listAssetUsageRights: vi.fn(), listCapacityPlans: vi.fn(), listClientConsents: vi.fn(), listDataRetentionPolicies: vi.fn(), listIntegrationHealthLogs: vi.fn(), recordIntegrationHealth: vi.fn(), updateClientConsentStatus: vi.fn(), upsertAssetUsageRight: vi.fn(), upsertCapacityPlan: vi.fn(), upsertDataRetentionPolicy: vi.fn(), getOperationalUserId: vi.fn(),
}));
vi.mock("../db", () => mocks);
vi.mock("./helpers", () => ({ getOperationalUserId: mocks.getOperationalUserId }));
import { governanceRouter } from "./governance";

function context(role: "admin" | "user" = "admin"): TrpcContext {
  return { user: { id: 1, openId: "governance-test", name: "Teste", email: "teste@vertex.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("contratos de governança e BI", () => {
  beforeEach(() => vi.clearAllMocks());
  it("protege governança, capacidade e indicadores contra acesso não administrativo", async () => {
    const caller = governanceRouter.createCaller(context("user"));
    await expect(caller.assetRights({ clientId: 3 })).rejects.toThrow("restritos à equipe administrativa");
    await expect(caller.executiveDashboard()).rejects.toThrow("restritos à equipe administrativa");
    expect(mocks.listAssetUsageRights).not.toHaveBeenCalled();
  });
  it("encaminha direitos, capacidade, privacidade e saúde com o cliente explícito", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.upsertAssetUsageRight.mockResolvedValue(31); mocks.upsertCapacityPlan.mockResolvedValue(32); mocks.createClientConsent.mockResolvedValue(33); mocks.upsertDataRetentionPolicy.mockResolvedValue(34); mocks.recordIntegrationHealth.mockResolvedValue(35); mocks.getExecutiveDashboard.mockResolvedValue({ mrrCents: 0, cacCents: null, ltvCents: null });
    const caller = governanceRouter.createCaller(context());
    await expect(caller.saveAssetRight({ clientId: 3, brandAssetId: 4, versionLabel: "Versão atual", licenseType: "owned", status: "active" })).resolves.toEqual({ id: 31 });
    await expect(caller.saveCapacityPlan({ operatorId: 2, periodStart: new Date("2026-08-01"), capacityMinutes: 9600, bookedMinutes: 6000 })).resolves.toEqual({ id: 32 });
    await expect(caller.createConsent({ clientId: 3, consentType: "data_processing", status: "granted" })).resolves.toEqual({ id: 33 });
    await expect(caller.saveRetentionPolicy({ clientId: 3, dataCategory: "contacts", retentionDays: 365, status: "active" })).resolves.toEqual({ id: 34 });
    await expect(caller.recordIntegrationHealth({ clientId: 3, integrationType: "email", provider: "Resend", status: "healthy" })).resolves.toEqual({ id: 35 });
    await expect(caller.executiveDashboard()).resolves.toMatchObject({ cacCents: null, ltvCents: null });
    expect(mocks.upsertAssetUsageRight).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, brandAssetId: 4 }));
    expect(mocks.recordIntegrationHealth).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, provider: "Resend" }));
  });
});

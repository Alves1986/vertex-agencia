import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  acceptOwnClientAccessGrant: vi.fn(),
  addClientPortalSupportTicketUpdate: vi.fn(),
  addSupportTicketUpdate: vi.fn(),
  createClientPortalSupportTicket: vi.fn(),
  createExecutiveReport: vi.fn(),
  createExternalApprovalLink: vi.fn(),
  createSupportTicket: vi.fn(),
  decideExternalApprovalByToken: vi.fn(),
  exportClientBackupSnapshot: vi.fn(),
  getClientBrandGuidelines: vi.fn(),
  getClientHealth: vi.fn(),
  getClientNotificationPreferences: vi.fn(),
  getClientOnboardingProgress: vi.fn(),
  getClientPortalOnboardingProgress: vi.fn(),
  getExternalApprovalByToken: vi.fn(),
  getSupportTicket: vi.fn(),
  listClientAccessGrants: vi.fn(),
  listClientPortalSupportTickets: vi.fn(),
  listExecutiveReports: vi.fn(),
  listExternalApprovalLinks: vi.fn(),
  listSupportTickets: vi.fn(),
  revokeExternalApprovalLink: vi.fn(),
  updateClientAccessGrantStatus: vi.fn(),
  upsertClientAccessGrant: vi.fn(),
  upsertClientBrandGuidelines: vi.fn(),
  upsertClientNotificationPreferences: vi.fn(),
  upsertClientOnboardingProgress: vi.fn(),
  getOperationalUserId: vi.fn(),
}));

vi.mock("../db", () => mocks);
vi.mock("./helpers", () => ({ getOperationalUserId: mocks.getOperationalUserId }));

import { successRouter } from "./success";

function createContext(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: { id: 1, openId: "success-test", name: "Teste", email: "teste@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("contratos de sucesso do cliente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restringe governança, saúde e backup à administração da agência", async () => {
    const caller = successRouter.createCaller(createContext("user"));
    await expect(caller.health({ clientId: 3 })).rejects.toThrow("restrita à equipe administrativa");
    await expect(caller.exportClientBackup({ clientId: 3 })).rejects.toThrow("restrita à equipe administrativa");
    expect(mocks.getClientHealth).not.toHaveBeenCalled();
    expect(mocks.exportClientBackupSnapshot).not.toHaveBeenCalled();
  });

  it("administra convites somente no cliente solicitado", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.upsertClientAccessGrant.mockResolvedValue(21);
    mocks.updateClientAccessGrantStatus.mockResolvedValue(21);
    const caller = successRouter.createCaller(createContext());
    await expect(caller.saveAccessGrant({ clientId: 3, email: "cliente@example.com", displayName: "Cliente", role: "reviewer" })).resolves.toEqual({ id: 21 });
    await expect(caller.updateAccessGrantStatus({ clientId: 3, grantId: 21, status: "revoked" })).resolves.toEqual({ id: 21 });
    expect(mocks.upsertClientAccessGrant).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, role: "reviewer" }));
    expect(mocks.updateClientAccessGrantStatus).toHaveBeenCalledWith(7, { clientId: 3, grantId: 21, status: "revoked" });
  });

  it("permite ao cliente aceitar apenas o próprio convite e consultar tickets do próprio portal", async () => {
    mocks.acceptOwnClientAccessGrant.mockResolvedValue({ clientId: 3, role: "manager" });
    mocks.listClientPortalSupportTickets.mockResolvedValue([{ id: 55, subject: "Ajuda" }]);
    const caller = successRouter.createCaller(createContext("user"));
    await expect(caller.acceptOwnAccessGrant({ clientId: 3 })).resolves.toEqual({ clientId: 3, role: "manager" });
    await expect(caller.clientPortalTickets({ clientId: 3 })).resolves.toEqual([{ id: 55, subject: "Ajuda" }]);
    expect(mocks.acceptOwnClientAccessGrant).toHaveBeenCalledWith("success-test", 3);
    expect(mocks.listClientPortalSupportTickets).toHaveBeenCalledWith("success-test", 3);
  });

  it("mantém onboarding, abertura e atualização de suporte vinculados ao portal do próprio cliente", async () => {
    mocks.getClientPortalOnboardingProgress.mockResolvedValue({ clientId: 3, completedSteps: ["brand"], currentStep: "contacts" });
    mocks.createClientPortalSupportTicket.mockResolvedValue(56);
    mocks.addClientPortalSupportTicketUpdate.mockResolvedValue(57);
    const caller = successRouter.createCaller(createContext("user"));
    await expect(caller.clientPortalOnboarding({ clientId: 3 })).resolves.toMatchObject({ clientId: 3, currentStep: "contacts" });
    await expect(caller.createClientPortalTicket({ clientId: 3, subject: "Preciso de ajuda", description: "Solicito apoio para revisar a campanha.", priority: "normal" })).resolves.toEqual(56);
    await expect(caller.addClientPortalTicketUpdate({ clientId: 3, ticketId: 56, message: "Complemento da solicitação." })).resolves.toEqual(57);
    expect(mocks.getClientPortalOnboardingProgress).toHaveBeenCalledWith("success-test", 3);
    expect(mocks.createClientPortalSupportTicket).toHaveBeenCalledWith("success-test", expect.objectContaining({ clientId: 3, priority: "normal" }));
    expect(mocks.addClientPortalSupportTicketUpdate).toHaveBeenCalledWith("success-test", expect.objectContaining({ clientId: 3, ticketId: 56 }));
  });

  it("cria tickets de agência e atualizações com escopo explícito", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createSupportTicket.mockResolvedValue(55);
    mocks.addSupportTicketUpdate.mockResolvedValue(89);
    const caller = successRouter.createCaller(createContext());
    await expect(caller.createTicket({ clientId: 3, requesterEmail: "contato@cliente.com", subject: "Revisar campanha", description: "Preciso de uma revisão do material.", priority: "high" })).resolves.toEqual({ id: 55 });
    await expect(caller.addTicketUpdate({ clientId: 3, ticketId: 55, message: "Análise iniciada.", statusAfter: "in_progress" })).resolves.toEqual({ id: 89 });
    expect(mocks.createSupportTicket).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, priority: "high" }));
    expect(mocks.addSupportTicketUpdate).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, ticketId: 55, statusAfter: "in_progress" }));
  });

  it("gera e revoga links de aprovação sem transformar a decisão pública em operação administrativa", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createExternalApprovalLink.mockResolvedValue({ id: 17, token: "a".repeat(43), expiresAt: new Date("2026-12-31T12:00:00Z") });
    mocks.revokeExternalApprovalLink.mockResolvedValue(17);
    mocks.getExternalApprovalByToken.mockResolvedValue({ id: 17, status: "open", campaignName: "Campanha", payloadJson: "{}" });
    mocks.decideExternalApprovalByToken.mockResolvedValue({ id: 17, status: "approved" });
    const admin = successRouter.createCaller(createContext());
    const publicCaller = successRouter.createCaller(createContext("user"));
    const expiresAt = new Date("2026-12-31T12:00:00Z");
    await expect(admin.createExternalApprovalLink({ clientId: 3, campaignId: 4, creativeVersionId: 5, recipientEmail: "aprovador@cliente.com", expiresAt })).resolves.toMatchObject({ id: 17 });
    await expect(admin.revokeExternalApprovalLink({ clientId: 3, linkId: 17 })).resolves.toEqual({ id: 17 });
    await expect(publicCaller.externalApproval({ token: "a".repeat(43) })).resolves.toMatchObject({ id: 17, status: "open" });
    await expect(publicCaller.decideExternalApproval({ token: "a".repeat(43), decision: "approved", note: "Aprovado." })).resolves.toEqual({ id: 17, status: "approved" });
    expect(mocks.createExternalApprovalLink).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, campaignId: 4, creativeVersionId: 5 }));
    expect(mocks.getExternalApprovalByToken).toHaveBeenCalledWith("a".repeat(43));
    expect(mocks.decideExternalApprovalByToken).toHaveBeenCalledWith("a".repeat(43), expect.objectContaining({ decision: "approved" }));
  });

  it("mantém relatórios, preferências e backup sob um contrato administrativo e dados estruturados", async () => {
    mocks.getOperationalUserId.mockResolvedValue(7);
    mocks.createExecutiveReport.mockResolvedValue(90);
    mocks.upsertClientNotificationPreferences.mockResolvedValue(91);
    mocks.exportClientBackupSnapshot.mockResolvedValue({ format: "vertex-client-backup/v1", client: { id: 3 } });
    const caller = successRouter.createCaller(createContext());
    await expect(caller.createExecutiveReport({ clientId: 3, periodStart: new Date("2026-08-01"), periodEnd: new Date("2026-08-31"), title: "Relatório agosto", summary: "Resumo executivo do mês.", metrics: { healthScore: 88 } })).resolves.toEqual({ id: 90 });
    await expect(caller.saveNotificationPreferences({ clientId: 3, events: { approvals: false, support: true } })).resolves.toEqual({ id: 91 });
    await expect(caller.exportClientBackup({ clientId: 3 })).resolves.toMatchObject({ format: "vertex-client-backup/v1", client: { id: 3 } });
    expect(mocks.createExecutiveReport).toHaveBeenCalledWith(7, expect.objectContaining({ clientId: 3, metrics: { healthScore: 88 } }));
    expect(mocks.upsertClientNotificationPreferences).toHaveBeenCalledWith(7, { clientId: 3, events: { approvals: false, support: true } });
  });
});

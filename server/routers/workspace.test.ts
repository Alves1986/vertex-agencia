import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "validation-user",
      name: "Validation User",
      email: "validation@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("workspace.createClient", () => {
  it("rejeita dados inválidos antes de executar uma gravação", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.workspace.createClient({ name: "A" })).rejects.toThrow();
  });
});

describe("workspace.deleteClient", () => {
  it("rejeita identificadores e confirmações inválidas antes de acessar dados", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.workspace.clientDeletionPreview({ clientId: 0 })).rejects.toThrow();
    await expect(caller.workspace.deleteClient({ clientId: 0, confirmationName: "Cliente" })).rejects.toThrow();
    await expect(caller.workspace.deleteClient({ clientId: 1, confirmationName: "A" })).rejects.toThrow();
  });
});

describe("responsible assignment contracts", () => {
  it("rejects invalid project and task identifiers before a write", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.projects.assignResponsible({ projectId: 0, responsibleOperatorId: 1 })).rejects.toThrow();
    await expect(caller.production.assignResponsible({ taskId: 0, responsibleOperatorId: 1 })).rejects.toThrow();
  });
});

describe("team and agenda update contracts", () => {
  it("rejects invalid identifiers before any protected update", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.workspace.updateTeam({ teamId: 0, name: "Vertex", color: "#E85D3F" })).rejects.toThrow();
    await expect(caller.production.updateEvent({ eventId: 0, title: "Revisão Campanha", eventType: "review", startsAt: new Date("2026-08-21T02:00:00.000Z") })).rejects.toThrow();
  });
});

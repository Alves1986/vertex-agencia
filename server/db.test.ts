import { afterEach, describe, expect, it } from "vitest";
import { checkApprovedWhatsAppDispatchEligibility, getClientPortalOverview, getCurrentMonthStart, listClientPortalConversationMessages, setDbForTests } from "./db";

function databaseWithSelectRows(rows: unknown[][]) {
  let index = 0;
  return {
    select: () => {
      const terminal = {
        where: () => terminal,
        innerJoin: () => terminal,
        leftJoin: () => terminal,
        limit: async () => rows[index++] ?? [],
        orderBy: async () => rows[index++] ?? [],
      };
      return { from: () => terminal };
    },
  };
}

afterEach(() => setDbForTests(null));

describe("cálculo do consumo mensal", () => {
  it("usa o primeiro dia do mês-calendário atual mesmo quando o filtro de 30 dias cruza o mês anterior", () => {
    expect(getCurrentMonthStart(new Date("2026-08-20T12:00:00Z"))).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(getCurrentMonthStart(new Date("2026-01-03T12:00:00Z"))).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });
});

describe("isolamento do portal de atendimento", () => {
  it("recusa a visão de um cliente quando não existe associação ativa para aquele espaço", async () => {
    setDbForTests(databaseWithSelectRows([[]]) as never);

    await expect(getClientPortalOverview("usuario-cliente", 2)).rejects.toThrow("não possui acesso ativo");
  });

  it("recusa a conversa solicitada quando ela não pertence ao cliente já autorizado", async () => {
    setDbForTests(databaseWithSelectRows([
      [{ memberId: 9, role: "viewer", clientId: 2, clientName: "Cliente A", clientSegment: null }],
      [],
    ]) as never);

    await expect(listClientPortalConversationMessages("usuario-cliente", { clientId: 2, conversationId: 700 })).rejects.toThrow("não pertence ao seu espaço de cliente");
  });
});

describe("elegibilidade de entrega aprovada", () => {
  const eligibleDraft = () => ({ messageId: 71, body: "Olá, posso ajudar?", direction: "outbound", deliveryStatus: "queued", providerMessageId: null, channelId: 8, provider: "meta_cloud" as const, channelStatus: "active", encryptedConfig: "cipher", destination: "+5511999999999", optInStatus: "opted_in", serviceWindowExpiresAt: new Date("2026-08-21T14:00:00Z") });
  const now = new Date("2026-08-21T12:00:00Z").getTime();

  it("bloqueia canal inativo ou sem configuração cifrada antes do adaptador", () => {
    expect(() => checkApprovedWhatsAppDispatchEligibility({ ...eligibleDraft(), channelStatus: "draft" }, now)).toThrow("canal não está ativo");
    expect(() => checkApprovedWhatsAppDispatchEligibility({ ...eligibleDraft(), encryptedConfig: null }, now)).toThrow("configuração cifrada válida");
  });

  it("bloqueia ausência de opt-in e janela de atendimento encerrada", () => {
    expect(() => checkApprovedWhatsAppDispatchEligibility({ ...eligibleDraft(), optInStatus: "unknown" }, now)).toThrow("consentimento explícito");
    expect(() => checkApprovedWhatsAppDispatchEligibility({ ...eligibleDraft(), serviceWindowExpiresAt: new Date("2026-08-21T11:59:59Z") }, now)).toThrow("janela de atendimento de 24 horas");
  });

  it("reconhece reaprovação como processamento já concluído sem deixar o rascunho pronto novamente", () => {
    expect(checkApprovedWhatsAppDispatchEligibility({ ...eligibleDraft(), deliveryStatus: "sent", providerMessageId: "wamid.123" }, now)).toEqual({ state: "already_processed", deliveryStatus: "sent", providerMessageId: "wamid.123" });
  });
});

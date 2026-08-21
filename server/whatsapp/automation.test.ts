import { afterEach, describe, expect, it } from "vitest";
import { evaluateWhatsAppAutomationRules, setDbForTests } from "../db";

type AutomationRule = {
  id: number;
  name: string;
  triggerType: "inbound_message" | "keyword" | "outside_business_hours" | "handoff_requested";
  triggerConfigJson: string | null;
  actionType: "ai_reply" | "draft_for_approval" | "handoff_human" | "tag_conversation";
  actionConfigJson: string | null;
};

function createFakeDb(selectResponses: unknown[][]) {
  const inserted: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  let selectIndex = 0;
  let createdId = 900;

  const database = {
    select: () => {
      const terminal = {
        where: () => terminal,
        innerJoin: () => terminal,
        limit: async () => selectResponses[selectIndex++] ?? [],
        orderBy: async () => selectResponses[selectIndex++] ?? [],
      };
      return { from: () => terminal };
    },
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        inserted.push(value);
        return { $returningId: async () => [{ id: createdId++ }] };
      },
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: async () => {
          updates.push(value);
          return [];
        },
      }),
    }),
  };

  return { database, inserted, updates };
}

function baseResponses(ruleRows: AutomationRule[], policyRows: unknown[] = [], existingExecutions: unknown[] = []) {
  return [
    [{ id: 300, body: "Preciso de ajuda com a entrega", direction: "inbound", occurredAt: new Date("2026-08-21T14:00:00Z") }],
    [{ id: 200, status: "ai_active", contactId: 100 }],
    [{ id: 100, optInStatus: "opted_in" }],
    policyRows,
    ruleRows,
    existingExecutions,
  ];
}

const keywordDraftRule: AutomationRule = {
  id: 40,
  name: "Rascunho de entrega",
  triggerType: "keyword",
  triggerConfigJson: JSON.stringify({ keywords: ["entrega"] }),
  actionType: "draft_for_approval",
  actionConfigJson: JSON.stringify({ draftBody: "Confirmar prazo de entrega com a equipe." }),
};

afterEach(() => setDbForTests(null));

describe("evaluateWhatsAppAutomationRules", () => {
  it("cria um rascunho interno revisável quando uma regra de palavra-chave é acionada", async () => {
    const fake = createFakeDb(baseResponses([keywordDraftRule]));
    setDbForTests(fake.database as never);

    const result = await evaluateWhatsAppAutomationRules(10, 200, 300, 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ ruleId: 40, status: "executed" });
    expect(fake.inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({ automationRuleId: 40, sourceMessageId: 300, status: "queued" }),
      expect.objectContaining({ direction: "outbound", authorType: "ai", deliveryStatus: "queued", body: "Confirmar prazo de entrega com a equipe." }),
      expect.objectContaining({ action: "whatsapp.automation_draft_created" }),
    ]));
    expect(fake.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "executed" }),
    ]));
  });

  it("bloqueia resposta por IA sem credencial validada, mantendo a entrega externa desabilitada", async () => {
    const aiReplyRule: AutomationRule = { ...keywordDraftRule, id: 41, actionType: "ai_reply", triggerType: "inbound_message", triggerConfigJson: null };
    const policy = [{ aiAccessMode: "client_api_key", providerConnectionId: null, workflowMode: "auto_reply", handoffKeywordsJson: null, businessHoursJson: null }];
    const fake = createFakeDb(baseResponses([aiReplyRule], policy));
    setDbForTests(fake.database as never);

    const result = await evaluateWhatsAppAutomationRules(10, 200, 300, 1);

    expect(result[0]).toMatchObject({ ruleId: 41, status: "blocked" });
    expect(result[0]?.reason).toContain("credencial de IA validada");
    expect(fake.inserted.some(record => record.direction === "outbound")).toBe(false);
    expect(fake.inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "whatsapp.automation_blocked" }),
    ]));
    expect(fake.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "blocked" }),
    ]));
  });

  it("encaminha a conversa para revisão humana sem gerar nem enviar resposta", async () => {
    const handoffRule: AutomationRule = { ...keywordDraftRule, id: 42, actionType: "handoff_human", triggerType: "inbound_message", triggerConfigJson: null };
    const fake = createFakeDb(baseResponses([handoffRule]));
    setDbForTests(fake.database as never);

    const result = await evaluateWhatsAppAutomationRules(10, 200, 300, 1);

    expect(result[0]).toMatchObject({ ruleId: 42, status: "executed" });
    expect(fake.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "waiting_human" }),
      expect.objectContaining({ status: "executed" }),
    ]));
    expect(fake.inserted.some(record => record.direction === "outbound")).toBe(false);
    expect(fake.inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "whatsapp.automation_handoff" }),
    ]));
  });

  it("não executa nem cria registros quando a consulta não retorna regras ativas", async () => {
    const fake = createFakeDb(baseResponses([], [], []));
    setDbForTests(fake.database as never);

    const result = await evaluateWhatsAppAutomationRules(10, 200, 300, 1);

    expect(result).toEqual([]);
    expect(fake.inserted).toEqual([]);
    expect(fake.updates).toEqual([]);
  });

  it("não duplica a execução ao reavaliar a mesma mensagem e regra", async () => {
    const responses = [
      ...baseResponses([keywordDraftRule]),
      ...baseResponses([keywordDraftRule], [], [{ id: 901, status: "executed" }]),
    ];
    const fake = createFakeDb(responses);
    setDbForTests(fake.database as never);

    await evaluateWhatsAppAutomationRules(10, 200, 300, 1);
    const second = await evaluateWhatsAppAutomationRules(10, 200, 300, 1);

    expect(second).toEqual([expect.objectContaining({ ruleId: 40, executionId: 901, status: "skipped" })]);
    expect(fake.inserted.filter(record => record.automationRuleId === 40)).toHaveLength(1);
    expect(fake.inserted.filter(record => record.direction === "outbound")).toHaveLength(1);
  });
});

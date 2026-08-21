import { describe, expect, it } from "vitest";
import { approvalHistoryDecisionLabel } from "./ApprovalHistoryPanel";

describe("histórico de aprovações", () => {
  it("traduz os estados auditáveis sem alterar a decisão persistida", () => {
    expect(approvalHistoryDecisionLabel("approved")).toBe("Aprovada");
    expect(approvalHistoryDecisionLabel("changes_requested")).toBe("Ajustes solicitados");
    expect(approvalHistoryDecisionLabel("rejected")).toBe("Rejeitada");
  });
});

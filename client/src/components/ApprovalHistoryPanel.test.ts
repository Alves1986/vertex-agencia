import { describe, expect, it } from "vitest";
import { approvalHistoryDecisionLabel, decodeApprovalHistoryExport } from "./ApprovalHistoryPanel";

describe("histórico de aprovações", () => {
  it("traduz os estados auditáveis sem alterar a decisão persistida", () => {
    expect(approvalHistoryDecisionLabel("approved")).toBe("Aprovada");
    expect(approvalHistoryDecisionLabel("changes_requested")).toBe("Ajustes solicitados");
    expect(approvalHistoryDecisionLabel("rejected")).toBe("Rejeitada");
  });

  it("converte o conteúdo de exportação em arquivo baixável com o tipo informado", async () => {
    const blob = decodeApprovalHistoryExport(Buffer.from("histórico seguro", "utf8").toString("base64"), "text/csv;charset=utf-8");
    expect(blob.type).toBe("text/csv;charset=utf-8");
    await expect(blob.text()).resolves.toBe("histórico seguro");
  });
});

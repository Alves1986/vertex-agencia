import { describe, expect, it } from "vitest";
import { createApprovalHistoryExport } from "./approvalHistoryExport";

const entries = [{ id: 1, creativeVersionId: 3, reviewerUserId: 7, reviewerName: "Anderson Alves", decision: "approved" as const, note: "CTA conferido; pode seguir para a criação.", source: "carousel_batch" as const, slideNumbers: [1, 2, 3], createdAt: new Date("2026-08-21T12:00:00.000Z") }];

describe("exportação do histórico de aprovações", () => {
  it("produz CSV com BOM, critérios e conteúdo auditável", async () => {
    const exported = await createApprovalHistoryExport({ format: "csv", campaignId: 44, campaignName: "Carrossel de acabamentos", entries, filters: { reviewerName: "Anderson Alves", startDate: "2026-08-01", endDate: "2026-08-31" } });
    const text = Buffer.from(exported.contentBase64, "base64").toString("utf8");
    expect(exported).toMatchObject({ fileName: expect.stringMatching(/\.csv$/), mimeType: "text/csv;charset=utf-8", recordCount: 1 });
    expect(text).toContain("\uFEFF");
    expect(text).toContain("Anderson Alves");
    expect(text).toContain("CTA conferido; pode seguir para a criação.");
  });

  it("produz PDF válido sem serializar segredos", async () => {
    const exported = await createApprovalHistoryExport({ format: "pdf", campaignId: 44, campaignName: "Carrossel de acabamentos", entries, filters: {} });
    const bytes = Buffer.from(exported.contentBase64, "base64");
    expect(exported).toMatchObject({ fileName: expect.stringMatching(/\.pdf$/), mimeType: "application/pdf", recordCount: 1 });
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});

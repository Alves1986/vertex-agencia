import { afterEach, describe, expect, it, vi } from "vitest";
import { createApprovalHistoryEmailTemplate, sendApprovalHistoryReportEmail } from "./approvalHistoryReportMailer";

describe("modelo e envio de relatório de aprovações", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("cria um modelo profissional com a campanha, critérios e sem informações sensíveis", () => {
    const template = createApprovalHistoryEmailTemplate({ clientName: "Globo Acabamentos", contactName: "Marina", campaignName: "Lançamento Premium", criteria: "Responsável: todos · Decisão: Aprovada", reportCount: 2 });
    expect(template.subject).toBe("Relatório de aprovações — Lançamento Premium");
    expect(template.html).toContain("Olá, Marina");
    expect(template.html).toContain("2 registros de aprovação");
    expect(template.html).toContain("não contém credenciais de IA");
  });

  it("envia somente o PDF gerado aos destinatários autorizados com o remetente configurado", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("REPORTS_FROM_EMAIL", "VERTEX Consulting <relatorios@vertex.example>");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "re_msg_123" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const sent = await sendApprovalHistoryReportEmail({ clientName: "Globo Acabamentos", contactName: "Marina", campaignName: "Lançamento Premium", recipientEmails: ["marina@globo.example", "diretoria@globo.example"], criteria: "Responsável: todos", report: { contentBase64: "JVBERi0=", fileName: "historico.pdf", mimeType: "application/pdf", recordCount: 1 } });

    expect(sent).toMatchObject({ messageId: "re_msg_123", subject: "Relatório de aprovações — Lançamento Premium" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }) }));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toMatchObject({ to: ["marina@globo.example", "diretoria@globo.example"], attachments: [{ filename: "historico.pdf", content: "JVBERi0=" }] });
  });
});

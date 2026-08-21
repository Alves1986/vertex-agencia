import type { ApprovalHistoryExport } from "../exports/approvalHistoryExport";

type ApprovalReportMailInput = {
  clientName: string;
  contactName?: string | null;
  campaignName: string;
  recipientEmail: string;
  report: ApprovalHistoryExport;
  criteria: string;
};

type MailSendResult = { messageId: string; subject: string };

type ApprovalHistoryEmailTemplateInput = {
  clientName: string;
  contactName?: string | null;
  campaignName: string;
  criteria: string;
  reportCount: number;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

export function createApprovalHistoryEmailTemplate(input: ApprovalHistoryEmailTemplateInput) {
  const greeting = input.contactName?.trim() || input.clientName;
  const recordText = input.reportCount === 1 ? "1 registro de aprovação" : `${input.reportCount} registros de aprovação`;
  const subject = `Relatório de aprovações — ${input.campaignName}`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f8f9;color:#173d53;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:32px 16px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe6e8;border-radius:16px;overflow:hidden"><tr><td style="background:#173d53;padding:28px 32px;color:#ffffff"><strong style="font-size:20px;letter-spacing:.04em">VERTEX CONSULTING</strong><div style="margin-top:8px;font-size:13px;color:#c4dde0">Relatório de aprovação de campanha</div></td></tr><tr><td style="padding:32px"><p style="margin:0 0 18px;font-size:16px">Olá, ${escapeHtml(greeting)}.</p><p style="margin:0 0 18px;line-height:1.6">Conforme o acompanhamento da campanha <strong>${escapeHtml(input.campaignName)}</strong>, enviamos em anexo o relatório de aprovações preparado pela VERTEX Consulting.</p><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f2f7f7;border-left:4px solid #e27632;margin:22px 0"><tr><td style="padding:16px"><strong style="font-size:13px">Resumo do relatório</strong><p style="margin:8px 0 0;font-size:13px;line-height:1.5">${escapeHtml(recordText)}<br>${escapeHtml(input.criteria)}</p></td></tr></table><p style="margin:0 0 18px;line-height:1.6">O PDF reúne as decisões registradas no período selecionado. Caso queira alinhar algum ponto, responda a este e-mail para que nossa equipe possa apoiar.</p><p style="margin:0;line-height:1.6">Atenciosamente,<br><strong>Equipe VERTEX Consulting</strong></p></td></tr><tr><td style="padding:18px 32px;background:#f7fafb;color:#6a8188;font-size:11px;line-height:1.5">Mensagem enviada pela plataforma VERTEX Consulting para o contato cadastrado da campanha. O anexo não contém credenciais de IA.</td></tr></table></td></tr></table></body></html>`;
  return { subject, html };
}

export async function sendApprovalHistoryReportEmail(input: ApprovalReportMailInput): Promise<MailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REPORTS_FROM_EMAIL?.trim();
  if (!apiKey?.startsWith("re_")) throw new Error("A chave do provedor de e-mail não está configurada corretamente.");
  if (!from || !from.includes("@")) throw new Error("O remetente de relatórios não está configurado corretamente.");
  if (!input.recipientEmail.includes("@")) throw new Error("O cliente não possui um e-mail de contato válido para receber o relatório.");

  const template = createApprovalHistoryEmailTemplate({ clientName: input.clientName, contactName: input.contactName, campaignName: input.campaignName, criteria: input.criteria, reportCount: input.report.recordCount });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.recipientEmail], subject: template.subject, html: template.html, attachments: [{ filename: input.report.fileName, content: input.report.contentBase64 }] }),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !body.id) throw new Error(body.message || "O provedor de e-mail não confirmou o envio do relatório.");
  return { messageId: body.id, subject: template.subject };
}

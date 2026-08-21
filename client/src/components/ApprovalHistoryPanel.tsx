import { useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Clock3, Download, FileSpreadsheet, FileText, FilterX, Mail, MessageSquareText, Send, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type ApprovalHistoryItem = {
  id: number;
  creativeVersionId: number;
  reviewerUserId: number;
  reviewerName: string | null;
  decision: "approved" | "changes_requested" | "rejected";
  note: string | null;
  createdAt: Date | string;
  source: "version_approval" | "carousel_batch";
  slideNumbers: number[];
};

export function approvalHistoryDecisionLabel(decision: ApprovalHistoryItem["decision"]) {
  return decision === "approved" ? "Aprovada" : decision === "changes_requested" ? "Ajustes solicitados" : "Rejeitada";
}

export function decodeApprovalHistoryExport(contentBase64: string, mimeType: string) {
  const binary = globalThis.atob(contentBase64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export function ApprovalHistoryPanel({ campaignId, campaignName }: { campaignId: number | null; campaignName?: string }) {
  const [reviewerUserId, setReviewerUserId] = useState("all");
  const [decision, setDecision] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [emailConfirmationOpen, setEmailConfirmationOpen] = useState(false);
  const [emailSendNotice, setEmailSendNotice] = useState<string | null>(null);
  const baseInput = useMemo(() => ({ campaignId: campaignId ?? 0 }), [campaignId]);
  const filters = useMemo(() => ({ ...baseInput, reviewerUserId: reviewerUserId === "all" ? undefined : Number(reviewerUserId), decision: decision === "all" ? undefined : decision as ApprovalHistoryItem["decision"], startDate: startDate || undefined, endDate: endDate || undefined }), [baseInput, decision, endDate, reviewerUserId, startDate]);
  const allHistory = trpc.agency.approvalHistory.useQuery(baseInput, { enabled: campaignId !== null });
  const history = trpc.agency.approvalHistory.useQuery(filters, { enabled: campaignId !== null });
  const recipient = trpc.agency.approvalHistoryRecipient.useQuery(baseInput, { enabled: campaignId !== null });
  const exportHistory = trpc.agency.exportApprovalHistory.useMutation({ onSuccess: exported => {
    const url = URL.createObjectURL(decodeApprovalHistoryExport(exported.contentBase64, exported.mimeType));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exported.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  } });
  const sendEmailReport = trpc.agency.sendApprovalHistoryReport.useMutation({ onSuccess: sent => { setEmailConfirmationOpen(false); setEmailSendNotice(`Relatório enviado para ${sent.recipientEmail}.`); } });
  const reviewers = useMemo(() => Array.from(new Map((allHistory.data ?? []).map((item: ApprovalHistoryItem) => [item.reviewerUserId, item.reviewerName || `Responsável #${item.reviewerUserId}`])).entries()), [allHistory.data]);
  if (!campaignId) return null;
  const clearFilters = () => { setReviewerUserId("all"); setDecision("all"); setStartDate(""); setEndDate(""); };
  const canExport = Boolean(history.data?.length) && !exportHistory.isPending;
  const canSend = canExport && Boolean(recipient.data?.contactEmail) && !sendEmailReport.isPending;
  return <section className="ops-panel agency-approval-history" aria-label="Histórico de aprovações por campanha"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Auditoria da campanha</p><h2>Histórico de aprovações</h2><span>{campaignName || `Campanha #${campaignId}`}</span></div><Clock3 size={20} /></div><div className="agency-history-toolbar" aria-label="Filtros e exportações do histórico"><div className="agency-history-filters"><label>Responsável<select value={reviewerUserId} onChange={event => setReviewerUserId(event.target.value)}><option value="all">Todos os responsáveis</option>{reviewers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Decisão<select value={decision} onChange={event => setDecision(event.target.value)}><option value="all">Todas as decisões</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option><option value="changes_requested">Ajustes solicitados</option></select></label><label>De<input type="date" value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.target.value)} /></label><label>Até<input type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} /></label><button type="button" className="ops-text-button" onClick={clearFilters} disabled={reviewerUserId === "all" && decision === "all" && !startDate && !endDate}><FilterX size={14} /> Limpar</button></div><div className="agency-history-export-actions"><button type="button" className="ops-outline-button" onClick={() => exportHistory.mutate({ ...filters, format: "csv" })} disabled={!canExport}><FileSpreadsheet size={15} /> CSV</button><button type="button" className="ops-outline-button" onClick={() => exportHistory.mutate({ ...filters, format: "pdf" })} disabled={!canExport}>{exportHistory.isPending ? <CircleDashed className="agency-export-spinner" size={15} /> : <FileText size={15} />} PDF</button><button type="button" className="ops-outline-button agency-history-email-button" onClick={() => setEmailConfirmationOpen(true)} disabled={!canSend} title={recipient.data?.contactEmail ? "Enviar o PDF ao e-mail de contato cadastrado" : "Cadastre um e-mail de contato válido no cliente"}><Mail size={15} /> Enviar por e-mail</button></div></div>{emailSendNotice ? <p className="agency-history-email-success"><CheckCircle2 size={15} /> {emailSendNotice}</p> : null}{exportHistory.isError ? <p className="agency-history-export-error">Não foi possível preparar o arquivo. Revise os filtros e tente novamente.</p> : null}{history.isLoading ? <div className="ops-page-loading"><CircleDashed size={18} /> Carregando decisões…</div> : null}{!history.isLoading && !history.data?.length ? <p className="ops-empty-copy">Não há decisões para os filtros escolhidos. Ajuste o responsável, a decisão ou o período para consultar outro recorte.</p> : null}<div className="agency-approval-history-list">{(history.data ?? []).map((item: ApprovalHistoryItem) => <article key={`${item.source}-${item.id}`} className={`agency-approval-history-item is-${item.decision}`}><div className="agency-approval-history-icon">{item.decision === "approved" ? <CheckCircle2 size={17} /> : item.decision === "rejected" ? <XCircle size={17} /> : <MessageSquareText size={17} />}</div><div><strong>{approvalHistoryDecisionLabel(item.decision)}</strong><span>{item.source === "carousel_batch" ? `Aprovação em lote · slides ${item.slideNumbers.join(", ") || "não identificados"}` : `Decisão da versão #${item.creativeVersionId}`}</span>{item.note ? <p>{item.note}</p> : null}<small>{item.reviewerName || `Responsável #${item.reviewerUserId}`} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</small></div></article>)}</div><p className="agency-history-share-note"><Download size={14} /> Os arquivos refletem exatamente os filtros ativos e não incluem chaves, credenciais ou dados de outros clientes.</p>{emailConfirmationOpen ? <div className="agency-email-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="agency-email-confirmation-title"><div><p className="ops-section-kicker">Confirmação de envio</p><h3 id="agency-email-confirmation-title">Enviar PDF ao cliente?</h3><p>O relatório filtrado será enviado para <strong>{recipient.data?.contactEmail || "o contato cadastrado"}</strong>. Revise o destinatário e os filtros antes de confirmar.</p><small>Esta ação envia uma mensagem externa e registra somente os metadados da tentativa no histórico operacional.</small></div><div className="agency-email-confirmation-actions"><button type="button" className="ops-text-button" onClick={() => setEmailConfirmationOpen(false)} disabled={sendEmailReport.isPending}>Cancelar</button><button type="button" className="ops-primary-button" onClick={() => sendEmailReport.mutate(filters)} disabled={sendEmailReport.isPending}>{sendEmailReport.isPending ? <CircleDashed className="agency-export-spinner" size={15} /> : <Send size={15} />} Confirmar envio</button></div>{sendEmailReport.isError ? <p className="agency-history-export-error">Não foi possível enviar o relatório. Verifique o e-mail do cliente e tente novamente.</p> : null}</div> : null}</section>;
}

import { useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Clock3, Download, FileSpreadsheet, FileText, FilterX, MessageSquareText, XCircle } from "lucide-react";
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const baseInput = useMemo(() => ({ campaignId: campaignId ?? 0 }), [campaignId]);
  const filters = useMemo(() => ({ ...baseInput, reviewerUserId: reviewerUserId === "all" ? undefined : Number(reviewerUserId), startDate: startDate || undefined, endDate: endDate || undefined }), [baseInput, endDate, reviewerUserId, startDate]);
  const allHistory = trpc.agency.approvalHistory.useQuery(baseInput, { enabled: campaignId !== null });
  const history = trpc.agency.approvalHistory.useQuery(filters, { enabled: campaignId !== null });
  const exportHistory = trpc.agency.exportApprovalHistory.useMutation({ onSuccess: exported => {
    const url = URL.createObjectURL(decodeApprovalHistoryExport(exported.contentBase64, exported.mimeType));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exported.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  } });
  const reviewers = useMemo(() => Array.from(new Map((allHistory.data ?? []).map((item: ApprovalHistoryItem) => [item.reviewerUserId, item.reviewerName || `Responsável #${item.reviewerUserId}`])).entries()), [allHistory.data]);
  if (!campaignId) return null;
  const clearFilters = () => { setReviewerUserId("all"); setStartDate(""); setEndDate(""); };
  const canExport = Boolean(history.data?.length) && !exportHistory.isPending;
  return <section className="ops-panel agency-approval-history" aria-label="Histórico de aprovações por campanha"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Auditoria da campanha</p><h2>Histórico de aprovações</h2><span>{campaignName || `Campanha #${campaignId}`}</span></div><Clock3 size={20} /></div><div className="agency-history-toolbar" aria-label="Filtros e exportações do histórico"><div className="agency-history-filters"><label>Responsável<select value={reviewerUserId} onChange={event => setReviewerUserId(event.target.value)}><option value="all">Todos os responsáveis</option>{reviewers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>De<input type="date" value={startDate} max={endDate || undefined} onChange={event => setStartDate(event.target.value)} /></label><label>Até<input type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} /></label><button type="button" className="ops-text-button" onClick={clearFilters} disabled={reviewerUserId === "all" && !startDate && !endDate}><FilterX size={14} /> Limpar</button></div><div className="agency-history-export-actions"><button type="button" className="ops-outline-button" onClick={() => exportHistory.mutate({ ...filters, format: "csv" })} disabled={!canExport}><FileSpreadsheet size={15} /> CSV</button><button type="button" className="ops-outline-button" onClick={() => exportHistory.mutate({ ...filters, format: "pdf" })} disabled={!canExport}>{exportHistory.isPending ? <CircleDashed className="agency-export-spinner" size={15} /> : <FileText size={15} />} PDF</button></div></div>{exportHistory.isError ? <p className="agency-history-export-error">Não foi possível preparar o arquivo. Revise os filtros e tente novamente.</p> : null}{history.isLoading ? <div className="ops-page-loading"><CircleDashed size={18} /> Carregando decisões…</div> : null}{!history.isLoading && !history.data?.length ? <p className="ops-empty-copy">Não há decisões para os filtros escolhidos. Ajuste o responsável ou período para consultar outro recorte.</p> : null}<div className="agency-approval-history-list">{(history.data ?? []).map((item: ApprovalHistoryItem) => <article key={`${item.source}-${item.id}`} className={`agency-approval-history-item is-${item.decision}`}><div className="agency-approval-history-icon">{item.decision === "approved" ? <CheckCircle2 size={17} /> : item.decision === "rejected" ? <XCircle size={17} /> : <MessageSquareText size={17} />}</div><div><strong>{approvalHistoryDecisionLabel(item.decision)}</strong><span>{item.source === "carousel_batch" ? `Aprovação em lote · slides ${item.slideNumbers.join(", ") || "não identificados"}` : `Decisão da versão #${item.creativeVersionId}`}</span>{item.note ? <p>{item.note}</p> : null}<small>{item.reviewerName || `Responsável #${item.reviewerUserId}`} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</small></div></article>)}</div><p className="agency-history-share-note"><Download size={14} /> Os arquivos refletem exatamente os filtros ativos e não incluem chaves, credenciais ou dados de outros clientes.</p></section>;
}

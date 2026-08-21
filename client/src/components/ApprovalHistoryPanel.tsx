import { CheckCircle2, CircleDashed, Clock3, MessageSquareText, XCircle } from "lucide-react";
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

export function ApprovalHistoryPanel({ campaignId, campaignName }: { campaignId: number | null; campaignName?: string }) {
  const history = trpc.agency.approvalHistory.useQuery({ campaignId: campaignId ?? 0 }, { enabled: campaignId !== null });
  if (!campaignId) return null;
  return <section className="ops-panel agency-approval-history" aria-label="Histórico de aprovações por campanha"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Auditoria da campanha</p><h2>Histórico de aprovações</h2><span>{campaignName || `Campanha #${campaignId}`}</span></div><Clock3 size={20} /></div>{history.isLoading ? <div className="ops-page-loading"><CircleDashed size={18} /> Carregando decisões…</div> : null}{!history.isLoading && !history.data?.length ? <p className="ops-empty-copy">Ainda não há decisões registradas para esta campanha. Aprovações individuais e em lote aparecerão nesta linha do tempo.</p> : null}<div className="agency-approval-history-list">{(history.data ?? []).map((item: ApprovalHistoryItem) => <article key={`${item.source}-${item.id}`} className={`agency-approval-history-item is-${item.decision}`}><div className="agency-approval-history-icon">{item.decision === "approved" ? <CheckCircle2 size={17} /> : item.decision === "rejected" ? <XCircle size={17} /> : <MessageSquareText size={17} />}</div><div><strong>{approvalHistoryDecisionLabel(item.decision)}</strong><span>{item.source === "carousel_batch" ? `Aprovação em lote · slides ${item.slideNumbers.join(", ") || "não identificados"}` : `Decisão da versão #${item.creativeVersionId}`}</span>{item.note ? <p>{item.note}</p> : null}<small>{item.reviewerName || `Responsável #${item.reviewerUserId}`} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</small></div></article>)}</div></section>;
}

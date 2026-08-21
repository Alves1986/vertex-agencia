import PDFDocument from "pdfkit";
import type { CampaignApprovalHistoryEntry } from "../db";

type ExportFormat = "csv" | "pdf";

export type ApprovalHistoryExportInput = {
  format: ExportFormat;
  campaignId: number;
  campaignName: string;
  entries: CampaignApprovalHistoryEntry[];
  filters: { reviewerName?: string | null; startDate?: string; endDate?: string };
};

export type ApprovalHistoryExport = {
  contentBase64: string;
  fileName: string;
  mimeType: "text/csv;charset=utf-8" | "application/pdf";
  recordCount: number;
};

function decisionLabel(decision: CampaignApprovalHistoryEntry["decision"]) {
  return decision === "approved" ? "Aprovada" : decision === "changes_requested" ? "Ajustes solicitados" : "Rejeitada";
}

function sourceLabel(source: CampaignApprovalHistoryEntry["source"]) {
  return source === "carousel_batch" ? "Aprovação em lote" : "Decisão da versão";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatCriteria(filters: ApprovalHistoryExportInput["filters"]) {
  const criteria = [filters.reviewerName ? `Responsável: ${filters.reviewerName}` : "Responsável: todos", filters.startDate ? `De: ${filters.startDate}` : null, filters.endDate ? `Até: ${filters.endDate}` : null].filter(Boolean);
  return criteria.join(" · ");
}

function buildCsv(input: ApprovalHistoryExportInput) {
  const rows = [
    ["Histórico de aprovações", input.campaignName],
    ["Critérios aplicados", formatCriteria(input.filters)],
    [],
    ["Campanha", "Origem", "Decisão", "Slides", "Responsável", "Data e hora", "Nota"],
    ...input.entries.map(entry => [input.campaignName, sourceLabel(entry.source), decisionLabel(entry.decision), entry.slideNumbers.join(", "), entry.reviewerName || `Responsável #${entry.reviewerUserId}`, formatDate(entry.createdAt), entry.note || ""]),
  ];
  return Buffer.from(`\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}\r\n`, "utf8");
}

async function buildPdf(input: ApprovalHistoryExportInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Histórico de aprovações — ${input.campaignName}`, Author: "VERTEX Consulting" } });
    document.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.fillColor("#173d53").fontSize(19).text("Histórico de aprovações");
    document.moveDown(0.25).fillColor("#405b68").fontSize(11).text(input.campaignName);
    document.moveDown(0.35).fillColor("#657d88").fontSize(9).text(formatCriteria(input.filters));
    document.moveDown(0.65).fillColor("#173d53").fontSize(10).text(`${input.entries.length} registro${input.entries.length === 1 ? "" : "s"} exportado${input.entries.length === 1 ? "" : "s"}`);
    document.moveDown(0.6);
    for (const entry of input.entries) {
      if (document.y > 690) document.addPage();
      document.fillColor("#173d53").fontSize(11).text(`${decisionLabel(entry.decision)} · ${sourceLabel(entry.source)}`);
      document.fillColor("#526e79").fontSize(9).text(entry.source === "carousel_batch" ? `Slides: ${entry.slideNumbers.join(", ") || "não identificados"}` : `Versão #${entry.creativeVersionId}`);
      document.fillColor("#738993").fontSize(8.5).text(`${entry.reviewerName || `Responsável #${entry.reviewerUserId}`} · ${formatDate(entry.createdAt)}`);
      if (entry.note) document.moveDown(0.2).fillColor("#3f5966").fontSize(9).text(entry.note, { width: 495 });
      document.moveDown(0.75).strokeColor("#d8e4e7").lineWidth(0.6).moveTo(48, document.y).lineTo(547, document.y).stroke().moveDown(0.6);
    }
    document.end();
  });
}

export async function createApprovalHistoryExport(input: ApprovalHistoryExportInput): Promise<ApprovalHistoryExport> {
  const datePart = new Date().toISOString().slice(0, 10);
  const fileBase = `historico-aprovacoes-campanha-${input.campaignId}-${datePart}`;
  const bytes = input.format === "csv" ? buildCsv(input) : await buildPdf(input);
  return { contentBase64: bytes.toString("base64"), fileName: `${fileBase}.${input.format}`, mimeType: input.format === "csv" ? "text/csv;charset=utf-8" : "application/pdf", recordCount: input.entries.length };
}

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("wouter", () => ({
  Link: ({ children, ...props }: { children: unknown }) => createElement("a", props, children),
}));

import { ApiUsagePanel, describeApiUsage, filterCredentialStatuses } from "./Home";

describe("filtro de credenciais do painel", () => {
  it("mantém todos os clientes ou exibe apenas os que não têm conexão ativa", () => {
    const rows = [
      { id: 1, name: "Globo Acabamentos", activeCount: 1, disabledCount: 0, status: "active" as const },
      { id: 2, name: "Cliente aguardando reativação", activeCount: 0, disabledCount: 1, status: "disabled" as const },
      { id: 3, name: "Cliente sem credencial", activeCount: 0, disabledCount: 0, status: "missing" as const },
    ];

    expect(filterCredentialStatuses(rows, "all")).toHaveLength(3);
    expect(filterCredentialStatuses(rows, "inactive")).toEqual([rows[1]]);
  });
});

describe("painel da agência", () => {
  it("apresenta a leitura executiva, a próxima ação e o mapa do fluxo sem remover o controle de IA", () => {
    const source = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('title="Painel da agência"');
    expect(source).toContain("Próxima ação");
    expect(source).toContain("Fluxo da agência");
    expect(source).toContain("Prontidão de IA por cliente");
    expect(source).toContain('href="/gestao"');
  });
});

describe("consumo de API por cliente", () => {
  it("distingue chamadas registradas de tokens efetivamente informados pelo provedor", () => {
    expect(describeApiUsage({ id: 1, name: "Globo Acabamentos", requestCount: 2, successfulCount: 2, failedCount: 0, inputTokens: 120, outputTokens: 80, totalTokens: 200, averageDurationMs: 900, telemetryAvailable: true, costStatus: "unavailable", lastUsedAt: null, periodDays: 30, monthlyApiCallLimit: 10, monthlyRequestCount: 2, utilizationPercent: 20, limitStatus: "within" })).toContain("200 tokens reportados");
    expect(describeApiUsage({ id: 2, name: "Cliente sem telemetria", requestCount: 1, successfulCount: 1, failedCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, averageDurationMs: null, telemetryAvailable: false, costStatus: "unavailable", lastUsedAt: null, periodDays: 30, monthlyApiCallLimit: null, monthlyRequestCount: 1, utilizationPercent: null, limitStatus: "not_configured" })).toContain("ainda não reportou tokens");
  });

  it("renderiza a seção vazia e o aviso de telemetria indisponível sem atribuir custo", () => {
    const emptyMarkup = renderToStaticMarkup(createElement(ApiUsagePanel, { rows: [], loading: false }));
    expect(emptyMarkup).toContain("Os clientes aparecerão aqui assim que forem cadastrados");

    const pendingTelemetryMarkup = renderToStaticMarkup(createElement(ApiUsagePanel, { periodDays: 15, loading: false, rows: [{ id: 2, name: "Cliente sem telemetria", requestCount: 1, successfulCount: 1, failedCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, averageDurationMs: null, telemetryAvailable: false, costStatus: "unavailable", lastUsedAt: null, periodDays: 15, monthlyApiCallLimit: 1, monthlyRequestCount: 1, utilizationPercent: 100, limitStatus: "reached" }] }));
    expect(pendingTelemetryMarkup).toContain("ainda não reportou tokens");
    expect(pendingTelemetryMarkup).toContain("Custo indisponível");
    expect(pendingTelemetryMarkup).toContain("Limite mensal atingido");
    expect(pendingTelemetryMarkup).toContain("15 dias");
    expect(pendingTelemetryMarkup).toContain("Limite mensal para Cliente sem telemetria");

    const noLimitMarkup = renderToStaticMarkup(createElement(ApiUsagePanel, { loading: false, rows: [{ id: 4, name: "Cliente sem limite", requestCount: 0, successfulCount: 0, failedCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, averageDurationMs: null, telemetryAvailable: false, costStatus: "unavailable", lastUsedAt: null, periodDays: 30, monthlyApiCallLimit: null, monthlyRequestCount: 0, utilizationPercent: null, limitStatus: "not_configured" }] }));
    expect(noLimitMarkup).toContain("Definir limite");
    expect(noLimitMarkup).not.toContain("Remover limite");
    expect(noLimitMarkup).toContain("valor inteiro de 1 a 10.000.000 chamadas");
    expect(noLimitMarkup).toContain("Informe de 1 a 10.000.000");
  });

  it("orienta a configuração de um limite mensal válido e bloqueia o salvamento vazio", () => {
    const markup = renderToStaticMarkup(createElement(ApiUsagePanel, { loading: false, rows: [{ id: 8, name: "Cliente para orientação", requestCount: 0, successfulCount: 0, failedCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, averageDurationMs: null, telemetryAvailable: false, costStatus: "unavailable", lastUsedAt: null, periodDays: 30, monthlyApiCallLimit: null, monthlyRequestCount: 0, utilizationPercent: null, limitStatus: "not_configured" }] }));
    expect(markup).toContain("Defina um valor inteiro de 1 a 10.000.000 chamadas");
    expect(markup).toContain("Use somente números inteiros. Deixe em branco para remover um limite já salvo.");
    expect(markup).toContain('placeholder="Informe de 1 a 10.000.000"');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Definir limite<\/button>/);
  });
});

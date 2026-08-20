import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

describe("consumo de API por cliente", () => {
  it("distingue chamadas registradas de tokens efetivamente informados pelo provedor", () => {
    expect(describeApiUsage({ id: 1, name: "Globo Acabamentos", requestCount: 2, successfulCount: 2, failedCount: 0, inputTokens: 120, outputTokens: 80, totalTokens: 200, averageDurationMs: 900, telemetryAvailable: true, costStatus: "unavailable", lastUsedAt: null })).toContain("200 tokens reportados");
    expect(describeApiUsage({ id: 2, name: "Cliente sem telemetria", requestCount: 1, successfulCount: 1, failedCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, averageDurationMs: null, telemetryAvailable: false, costStatus: "unavailable", lastUsedAt: null })).toContain("ainda não reportou tokens");
  });

  it("renderiza a seção vazia e o aviso de telemetria indisponível sem atribuir custo", () => {
    const emptyMarkup = renderToStaticMarkup(createElement(ApiUsagePanel, { rows: [], loading: false }));
    expect(emptyMarkup).toContain("Os clientes aparecerão aqui assim que forem cadastrados");

    const pendingTelemetryMarkup = renderToStaticMarkup(createElement(ApiUsagePanel, { loading: false, rows: [{ id: 2, name: "Cliente sem telemetria", requestCount: 1, successfulCount: 1, failedCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, averageDurationMs: null, telemetryAvailable: false, costStatus: "unavailable", lastUsedAt: null }] }));
    expect(pendingTelemetryMarkup).toContain("ainda não reportou tokens");
    expect(pendingTelemetryMarkup).toContain("Custo indisponível");
  });
});

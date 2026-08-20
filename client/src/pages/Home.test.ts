import { describe, expect, it } from "vitest";
import { filterCredentialStatuses } from "./Home";

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


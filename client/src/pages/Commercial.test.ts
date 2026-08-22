import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { canConfirmClientDeletion, ClientDeletionDialog } from "./Commercial";

describe("exclusão de cliente", () => {
  it("exige o nome do cliente para liberar uma exclusão permanente", () => {
    expect(canConfirmClientDeletion("Globo Acabamentos", "Globo Acabamentos")).toBe(true);
    expect(canConfirmClientDeletion(" Globo Acabamentos ", "Globo Acabamentos")).toBe(true);
    expect(canConfirmClientDeletion("globo acabamentos", "Globo Acabamentos")).toBe(false);
    expect(canConfirmClientDeletion("Outro cliente", "Globo Acabamentos")).toBe(false);
  });

  it("mostra o impacto e mantém a ação desabilitada enquanto a confirmação não confere", () => {
    const markup = renderToStaticMarkup(createElement(ClientDeletionDialog, {
      clientName: "Globo Acabamentos",
      dependencies: { projects: 2, campaigns: 1, channels: 1, tickets: 0, portalMembers: 3 },
      confirmation: "Globo",
      loading: false,
      pending: false,
      onConfirmationChange: () => undefined,
      onClose: () => undefined,
      onConfirm: () => undefined,
    }));

    expect(markup).toContain("Dados que serão removidos");
    expect(markup).toContain("2</b> projeto(s) e suas tarefas");
    expect(markup).toContain("3</b> acesso(s) ao portal");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*Excluir definitivamente/);
  });
});

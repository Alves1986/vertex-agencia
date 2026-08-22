import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TeamFilterOptions, VertexBrand, vertexLogo } from "./StudioShell";
import { navigationGroups } from "./StudioShell";

describe("TeamFilterOptions", () => {
  it("exibe Vertex entre as opções carregadas no filtro persistente de equipes", () => {
    const markup = renderToStaticMarkup(createElement("select", null,
      createElement(TeamFilterOptions, { teams: [{ id: 1, name: "Vertex" }] }),
    ));

    expect(markup).toContain('value="1"');
    expect(markup).toContain("Vertex");
  });
});

describe("VertexBrand", () => {
  it("exibe a assinatura VERTEX Consulting com a logo permanente fornecida", () => {
    const markup = renderToStaticMarkup(createElement(VertexBrand));

    expect(markup).toContain("VERTEX");
    expect(markup).toContain("Consulting");
    expect(markup).toContain('alt="Logo VERTEX"');
    expect(markup).toContain(vertexLogo);
  });
});

describe("navegação superior", () => {
  it("mantém abas de topo, o fluxo ordenado da agência e não reintroduz o menu lateral recolhível", () => {
    const shell = readFileSync(new URL("./StudioShell.tsx", import.meta.url), "utf8");

    expect(shell).toContain('className="ops-top-tabs"');
    expect(shell).toContain("ops-top-tab-step");
    expect(shell).not.toContain("ops-sidebar-toggle");
    expect(shell).not.toContain("<aside");
    expect(navigationGroups[0].links.map(item => item.label)).toEqual(["Painel", "Clientes", "Planejamento", "Criação", "Projetos", "Produção", "Atendimento", "Sucesso"]);
    expect(navigationGroups[1].links[0]).toMatchObject({ label: "Gestão", href: "/gestao" });
  });
});

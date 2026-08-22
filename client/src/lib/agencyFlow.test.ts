import { describe, expect, it } from "vitest";
import { agencyFlow, managementEntry } from "./agencyFlow";

describe("fluxo SaaS da agência", () => {
  it("mantém as etapas principais em ordem operacional, do painel ao sucesso da conta", () => {
    expect(agencyFlow.map(item => `${item.step}:${item.label}`)).toEqual([
      "00:Painel",
      "01:Clientes",
      "02:Planejamento",
      "03:Criação",
      "04:Projetos",
      "05:Produção",
      "06:Atendimento",
      "07:Sucesso",
    ]);
    expect(new Set(agencyFlow.map(item => item.href)).size).toBe(agencyFlow.length);
  });

  it("separa os controles recorrentes de plataforma em um hub de gestão", () => {
    expect(managementEntry).toMatchObject({ label: "Gestão", href: "/gestao" });
    expect(agencyFlow.some(item => item.href === "/gestao")).toBe(false);
  });
});

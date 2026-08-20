import { describe, expect, it } from "vitest";
import { getCurrentMonthStart } from "./db";

describe("cálculo do consumo mensal", () => {
  it("usa o primeiro dia do mês-calendário atual mesmo quando o filtro de 30 dias cruza o mês anterior", () => {
    expect(getCurrentMonthStart(new Date("2026-08-20T12:00:00Z"))).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(getCurrentMonthStart(new Date("2026-01-03T12:00:00Z"))).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });
});

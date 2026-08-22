import { describe, expect, it } from "vitest";
import { splitGuidelineList } from "./Success";

describe("central de sucesso", () => {
  it("normaliza campos de diretriz sem persistir valores vazios", () => {
    expect(splitGuidelineList("#153b3e,  Terracota\n\nAcento")).toEqual(["#153b3e", "Terracota", "Acento"]);
    expect(splitGuidelineList(" , \n ")).toEqual([]);
  });
});

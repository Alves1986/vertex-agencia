import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("configuração pública de marca", () => {
  it("expõe o nome e a referência permanente da logo VERTEX Consulting pela rota de branding", async () => {
    const server = createApp().listen(0);
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Porta de teste indisponível");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/branding`);
      expect(response.ok).toBe(true);
      await expect(response.json()).resolves.toEqual({
        title: "VERTEX Consulting",
        logo: "/manus-storage/vertex-consulting-logo-transparent_6996f748.png",
      });
    } finally {
      server.close();
    }
  });
});

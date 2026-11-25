import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSiteConfig() {
  vi.resetModules();
  return (await import("./site")).siteConfig;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteConfig.url", () => {
  it("usa NEXT_PUBLIC_SITE_URL si está definida", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://campustime.example");
    expect((await loadSiteConfig()).url).toBe("https://campustime.example");
  });

  it("vuelve a localhost si la variable llega vacía (build arg de Docker sin valor)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { url } = await loadSiteConfig();
    expect(() => new URL(url)).not.toThrow();
    expect(url).toBe("http://localhost:3000");
  });
});

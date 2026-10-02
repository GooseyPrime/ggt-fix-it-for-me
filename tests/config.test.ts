import { afterEach, describe, expect, it, vi } from "vitest";
import { publicBasePath, shopOrigin } from "@/lib/config";

const ORIGINAL = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
});

describe("config", () => {
  it("normalizes the configured base path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "tools/fix-it//";
    expect(publicBasePath()).toBe("/tools/fix-it");
  });

  it("normalizes the path passed to Next.js and client config", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "tools/fix-it//";
    vi.resetModules();
    const { default: nextConfig } = await import("@/next.config");
    expect(nextConfig.basePath).toBe("/tools/fix-it");
    expect(nextConfig.env?.NEXT_PUBLIC_BASE_PATH).toBe("/tools/fix-it");
  });

  it("uses the live shop unless told otherwise", () => {
    delete process.env.NEXT_PUBLIC_SHOP_ORIGIN;
    expect(shopOrigin()).toBe("https://www.goldengoosetools.com");
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://preview.example/";
    expect(shopOrigin()).toBe("https://preview.example");
  });
});

import { describe, expect, it } from "vitest";
import { buildApiUrl, defaultVariantId } from "@/components/FixItApp";

describe("FixItApp helpers", () => {
  it("prefixes API calls with the configured base path", () => {
    expect(buildApiUrl("/api/verify", "/tools/fix-it")).toBe("/tools/fix-it/api/verify");
    expect(buildApiUrl("/api/audit", "")).toBe("/api/audit");
  });

  it("defaults to the first configured price tier", () => {
    expect(defaultVariantId({ standardCents: null, plusCents: 24900 })).toBe("plus");
    expect(defaultVariantId({ standardCents: 14900, plusCents: 24900 })).toBe("standard");
  });
});

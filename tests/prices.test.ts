import { describe, expect, it } from "vitest";
import { anyPriceConfigured, readPriceCents, shopPrices, variantPrice } from "@/lib/prices";

describe("prices", () => {
  it("never invents amounts when env is empty", () => {
    const prices = shopPrices({
      NEXT_PUBLIC_PRICE_STANDARD_CENTS: undefined,
      NEXT_PUBLIC_PRICE_PLUS_CENTS: undefined,
    });
    expect(anyPriceConfigured(prices)).toBe(false);
    expect(variantPrice(prices, "standard")).toBeNull();
  });

  it("reads mirrored cents without hardcoding in source", () => {
    expect(readPriceCents("14900")).toBe(14900);
    expect(readPriceCents("$149")).toBeNull();
    const prices = shopPrices({
      NEXT_PUBLIC_PRICE_STANDARD_CENTS: "14900",
      NEXT_PUBLIC_PRICE_PLUS_CENTS: "24900",
    });
    expect(variantPrice(prices, "standard")?.label).toMatch(/\$149/);
    expect(variantPrice(prices, "plus")?.label).toMatch(/\$249/);
  });
});

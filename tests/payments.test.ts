import { afterEach, describe, expect, it, vi } from "vitest";
import { startSale, verifySale } from "@/lib/payments";

const ORIGINAL = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
});

describe("startSale", () => {
  it("refuses checkout when fix-it is not on the shop allowlist", async () => {
    process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS = "seo-audit,accessibility";
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://goldengoosetools.com";
    delete process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK;

    const result = await startSale({
      url: "https://example.com",
      variant: "standard",
      returnUrl: "https://tool.example/tools/fix-it",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("sku_not_live");
      expect(result.message.toLowerCase()).toMatch(/not live|seo|accessibility/);
    }
  });

  it("does not return a checkout URL when SKU is missing (no fallthrough)", async () => {
    process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS = "seo-audit,accessibility";
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://goldengoosetools.com";

    const result = await startSale({
      url: "https://example.com",
      variant: "plus",
      returnUrl: "https://tool.example/",
    });

    expect(result.ok).toBe(false);
    expect("checkoutUrl" in result).toBe(false);
  });

  it("disables local unlock in production", async () => {
    process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS = "fix-it";
    process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK = "true";
    process.env.ALLOW_LOCAL_UNLOCK = "true";
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.NEXT_PUBLIC_SHOP_ORIGIN;

    const sale = await startSale({
      url: "https://example.com",
      variant: "standard",
      returnUrl: "https://tool.example/tools/fix-it",
    });
    expect(sale.ok).toBe(false);

    const verify = await verifySale("local");
    expect(verify.paid).toBe(false);
    expect(verify.kind).toBe("unconfigured");
  });
});

describe("verifySale", () => {
  it("requires a matching Fix It product before unlocking a paid session", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://shop.example";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, paid: true, product: "seo-audit" }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await verifySale("sess_123");

    expect(result.ok).toBe(false);
    expect(result.paid).toBe(false);
    expect(result.kind).toBe("invalid_product");
  });

  it("requires ok=true for ordinary paid unlocks but preserves the no_payment_required path", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://shop.example";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: false, paid: true, product: "fix-it", toolId: "fix-it" }), {
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              ok: false,
              paymentStatus: "no_payment_required",
              product: "fix-it",
              toolId: "fix-it",
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
    );

    const failedPaid = await verifySale("sess_paid");
    const promo = await verifySale("sess_free");

    expect(failedPaid.paid).toBe(false);
    expect(promo.paid).toBe(true);
    expect(promo.paymentStatus).toBe("no_payment_required");
  });

  it("returns a stable unpaid result when the shop cannot be reached", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://shop.example";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await verifySale("sess_123");

    expect(result).toMatchObject({
      ok: false,
      paid: false,
      kind: "shop_error",
    });
  });
});

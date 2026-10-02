import { afterEach, describe, expect, it, vi } from "vitest";
import { startSale, verifySale } from "@/lib/payments";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_SHOP_ORIGIN;
});

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("startSale", () => {
  it("posts the product, plan and site to the shop and never an amount", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://shop.example";
    const fetchMock = stubFetch(200, { ok: true, url: "https://checkout.example/pay", sessionId: "cs_1" });
    const result = await startSale({ url: "https://example.com/", variant: "plus" });
    expect(result).toEqual({ ok: true, checkoutUrl: "https://checkout.example/pay", sessionId: "cs_1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://shop.example/api/sale");
    expect(JSON.parse(String(init.body))).toEqual({
      url: "https://example.com/",
      product: "fix-it",
      toolId: "fix-it",
      variant: "plus",
    });
  });

  it("falls back to the live shop when no origin is configured", async () => {
    const fetchMock = stubFetch(200, { ok: true, url: "https://checkout.example/pay" });
    await startSale({ url: "https://example.com/", variant: "standard" });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://www.goldengoosetools.com/api/sale");
  });

  it("returns the shop's message when it refuses", async () => {
    stubFetch(400, { ok: false, message: "fix-it variant invalid" });
    const result = await startSale({ url: "https://example.com/", variant: "standard" });
    expect(result).toEqual({ ok: false, message: "fix-it variant invalid" });
  });

  it("rejects a non-web checkout address", async () => {
    stubFetch(200, { ok: true, url: "javascript:alert(1)" });
    const result = await startSale({ url: "https://example.com/", variant: "standard" });
    expect(result.ok).toBe(false);
  });

  it("fails cleanly when the shop cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const result = await startSale({ url: "https://example.com/", variant: "standard" });
    expect(result.ok).toBe(false);
  });
});

describe("verifySale", () => {
  const paidBody = {
    ok: true,
    paid: true,
    product: "fix-it",
    toolId: "fix-it",
    variant: "plus",
    targetUrl: "https://example.com/",
    email: "buyer@example.com",
    paymentStatus: "paid",
  };

  it("accepts a paid Fix It checkout and reads the plan from the shop", async () => {
    stubFetch(200, paidBody);
    const result = await verifySale("cs_1");
    expect(result).toMatchObject({
      ok: true,
      paid: true,
      sessionId: "cs_1",
      variant: "plus",
      targetUrl: "https://example.com/",
      receiptEmail: "buyer@example.com",
    });
  });

  it("accepts a $0 promo checkout", async () => {
    stubFetch(200, { ...paidBody, paid: true, paymentStatus: "no_payment_required" });
    expect((await verifySale("cs_1")).paid).toBe(true);
  });

  it("refuses a paid checkout for a different product", async () => {
    stubFetch(200, { ...paidBody, product: "seo-audit", toolId: "seo-audit" });
    const result = await verifySale("cs_1");
    expect(result.paid).toBe(false);
    expect(result.message).toMatch(/different product/i);
  });

  it("refuses when the shop gives no product at all", async () => {
    const { product: _p, toolId: _t, ...rest } = paidBody;
    void _p;
    void _t;
    stubFetch(200, rest);
    expect((await verifySale("cs_1")).paid).toBe(false);
  });

  it("refuses an unpaid checkout", async () => {
    stubFetch(402, { ok: false, paid: false, kind: "payment_incomplete", message: "Payment not completed." });
    const result = await verifySale("cs_1");
    expect(result.paid).toBe(false);
    expect(result.message).toBe("Payment not completed.");
  });

  it.each([
    ["missing", { ...paidBody, variant: undefined }],
    ["unknown", { ...paidBody, variant: "enterprise" }],
  ])("refuses a paid checkout with a %s plan", async (_label, body) => {
    stubFetch(200, body);
    const result = await verifySale("cs_1");
    expect(result).toMatchObject({
      paid: false,
      retryable: true,
      message: expect.stringMatching(/unsupported plan/i),
    });
  });

  it("marks shop outages as retryable", async () => {
    stubFetch(503, { ok: false, message: "Try again later." });
    const result = await verifySale("cs_1");
    expect(result).toMatchObject({ paid: false, retryable: true });
  });

  it("marks network failures as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await verifySale("cs_1")).toMatchObject({ paid: false, retryable: true });
  });

  it("refuses a missing session id without calling the shop", async () => {
    const fetchMock = stubFetch(200, paidBody);
    expect((await verifySale("  ")).paid).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never unlocks for the old local session id", async () => {
    stubFetch(404, { ok: false, paid: false, kind: "not_found", message: "Checkout session not found." });
    expect((await verifySale("local")).paid).toBe(false);
  });
});

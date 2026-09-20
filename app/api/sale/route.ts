import { startSale } from "@/lib/payments";
import type { VariantId } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxies to shop POST /api/sale with
 * { url, product: "fix-it", toolId: "fix-it", variant }.
 * Refuses when fix-it is not on the shop allowlist (no fallthrough to seo-audit).
 */
export async function POST(request: Request) {
  let body: { url?: unknown; variant?: unknown; returnUrl?: unknown } | null = null;
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as {
        url?: unknown;
        variant?: unknown;
        returnUrl?: unknown;
      };
    }
  } catch {
    /* handled below */
  }

  if (!body) {
    return NextResponse.json({ ok: false, message: "Send a JSON body." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl.trim() : "";
  const variant = body.variant;

  if (!returnUrl) {
    return NextResponse.json({ ok: false, message: "Missing return URL." }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ ok: false, message: "Missing website URL." }, { status: 400 });
  }
  if (variant !== "standard" && variant !== "plus") {
    return NextResponse.json({ ok: false, message: "Variant must be standard or plus." }, { status: 400 });
  }

  const result = await startSale({
    url,
    variant: variant as VariantId,
    returnUrl,
  });

  if (!result.ok) {
    const status = result.code === "sku_not_live" ? 503 : 400;
    return NextResponse.json(
      { ok: false, message: result.message, code: result.code },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    url: result.checkoutUrl,
    sessionId: result.sessionId,
  });
}

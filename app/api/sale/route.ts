import { NextResponse } from "next/server";
import { notifyConfig } from "@/lib/intake";
import { startSale } from "@/lib/payments";
import { normalizeUrl } from "@/lib/normalize-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a shop checkout. Refuses while requests cannot be delivered, so nobody pays for
 * work we would never hear about.
 */
export async function POST(request: Request) {
  if (!notifyConfig()) {
    return NextResponse.json(
      {
        ok: false,
        code: "closed",
        message: "Fix It For Me is not taking new requests right now. The free audit still works.",
      },
      { status: 503 },
    );
  }

  let body: { url?: unknown; variant?: unknown } | null = null;
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as { url?: unknown; variant?: unknown };
  } catch {
    /* handled below */
  }
  if (!body) return NextResponse.json({ ok: false, message: "Send a JSON body." }, { status: 400 });

  const variant = body.variant;
  if (variant !== "standard" && variant !== "plus") {
    return NextResponse.json({ ok: false, message: "Choose Standard or Plus." }, { status: 400 });
  }
  const site = normalizeUrl(typeof body.url === "string" ? body.url : "");
  if (!site.href) {
    return NextResponse.json(
      { ok: false, message: site.error || "Enter your website address." },
      { status: 400 },
    );
  }

  const result = await startSale({ url: site.href, variant });
  if (!result.ok) return NextResponse.json({ ok: false, message: result.message }, { status: 502 });
  return NextResponse.json({ ok: true, url: result.checkoutUrl, sessionId: result.sessionId });
}

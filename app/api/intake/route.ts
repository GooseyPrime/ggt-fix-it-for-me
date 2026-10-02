import { NextResponse } from "next/server";
import {
  buildNotification,
  checkIntake,
  notifyConfig,
  sendNotification,
  type IntakeInput,
} from "@/lib/intake";
import { verifySale } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 20_000;

/**
 * Takes the intake form for a paid Fix It For Me checkout.
 * The checkout is re-checked with the shop on every request; the plan comes from the
 * shop's record, not from the form.
 */
export async function POST(request: Request) {
  const config = notifyConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        code: "closed",
        message:
          "We cannot take your request here right now. Your payment is safe. Please try again later.",
      },
      { status: 503 },
    );
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    /* handled below */
  }
  if (!raw || raw.length > MAX_BODY_CHARS) {
    return NextResponse.json({ ok: false, message: "That request was empty or too long." }, { status: 400 });
  }

  let body: (IntakeInput & { sessionId?: unknown }) | null = null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") body = parsed as IntakeInput & { sessionId?: unknown };
  } catch {
    /* handled below */
  }
  if (!body) return NextResponse.json({ ok: false, message: "Send a JSON body." }, { status: 400 });

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const sale = await verifySale(sessionId);
  if (!sale.paid || !sale.sessionId || !sale.variant) {
    return NextResponse.json(
      { ok: false, code: "unpaid", message: sale.message || "We could not confirm your payment." },
      { status: 402 },
    );
  }

  const checked = checkIntake(body);
  if (!checked.ok) {
    return NextResponse.json(
      { ok: false, code: "invalid", field: checked.field, message: checked.message },
      { status: 400 },
    );
  }

  const message = buildNotification({
    intake: checked.value,
    variant: sale.variant,
    sessionId: sale.sessionId,
    receiptEmail: sale.receiptEmail,
    paidSite: sale.targetUrl,
  });
  const sent = await sendNotification(config, message, {
    replyTo: checked.value.contactEmail,
    idempotencyKey: `fix-it-${sale.sessionId}`,
  });

  if (sent.ok || sent.duplicate) {
    return NextResponse.json({
      ok: true,
      reference: sale.sessionId.slice(-8),
      duplicate: sent.ok ? undefined : true,
    });
  }

  console.error(`fix-it intake: email provider returned ${sent.status ?? "no response"}`);
  return NextResponse.json(
    {
      ok: false,
      code: "send_failed",
      message: "We could not send your request just now. Nothing was lost: please try again in a minute.",
    },
    { status: 502 },
  );
}

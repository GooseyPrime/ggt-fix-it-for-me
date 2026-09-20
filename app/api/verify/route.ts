import { verifySale } from "@/lib/payments";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Proxies shop GET /api/verify?session_id= or POST { sessionId }. Unlock when paid (incl. $0 promo). */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const result = await verifySale(sessionId);
  return NextResponse.json(result, { status: result.paid ? 200 : 400 });
}

export async function POST(request: Request) {
  let body: { sessionId?: unknown; session_id?: unknown } | null = null;
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as { sessionId?: unknown; session_id?: unknown };
    }
  } catch {
    /* empty */
  }
  const sessionId =
    (body && typeof body.sessionId === "string" && body.sessionId) ||
    (body && typeof body.session_id === "string" && body.session_id) ||
    "";
  const result = await verifySale(sessionId);
  return NextResponse.json(result, { status: result.paid ? 200 : 400 });
}

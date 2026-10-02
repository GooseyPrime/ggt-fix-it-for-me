import { NextResponse } from "next/server";
import { verifySale } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirms a shop checkout is paid for Fix It For Me, and which plan it was. */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const result = await verifySale(sessionId);
  const { receiptEmail: _omit, ...publicResult } = result;
  void _omit;
  return NextResponse.json(publicResult, { status: result.paid ? 200 : 402 });
}

import { NextResponse } from "next/server";
import { notifyConfig } from "@/lib/intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether Fix It For Me is taking requests. Never exposes any configuration values. */
export async function GET() {
  return NextResponse.json({ open: notifyConfig() !== null });
}

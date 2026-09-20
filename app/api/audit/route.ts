import { runAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { url?: unknown; description?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; description?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, message: "Send a JSON body with a URL and/or description." },
      { status: 400 },
    );
  }

  const url = typeof body.url === "string" ? body.url : "";
  const description = typeof body.description === "string" ? body.description : "";
  const result = await runAudit({ url, description });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json(result);
}

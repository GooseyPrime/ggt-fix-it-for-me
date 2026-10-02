import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifySaleMock, startSaleMock } = vi.hoisted(() => ({
  verifySaleMock: vi.fn(),
  startSaleMock: vi.fn(),
}));

vi.mock("@/lib/payments", () => ({
  verifySale: verifySaleMock,
  startSale: startSaleMock,
}));

import { POST as intakePost } from "@/app/api/intake/route";
import { POST as salePost } from "@/app/api/sale/route";
import { GET as statusGet } from "@/app/api/status/route";
import { GET as verifyGet } from "@/app/api/verify/route";

const ORIGINAL = { ...process.env };

function json(body: unknown) {
  return new Request("https://tool.example/tools/fix-it/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const FORM = {
  sessionId: "cs_test_12345678",
  siteUrl: "example.com",
  whatToFix: "Please fix the page titles and photo descriptions.",
  contactEmail: "owner@example.com",
  accessNotes: "Wix. No passwords here.",
};

const PAID = {
  ok: true,
  paid: true,
  sessionId: "cs_test_12345678",
  variant: "plus",
  targetUrl: "https://example.com/",
  receiptEmail: "pay@example.com",
};

function configured() {
  process.env.RESEND_API_KEY = "test-key";
  process.env.FIX_IT_NOTIFY_EMAIL = "me@example.com";
  process.env.RESEND_API_BASE = "https://api.resend.test";
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.FIX_IT_NOTIFY_EMAIL;
  delete process.env.RESEND_API_BASE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  verifySaleMock.mockReset();
  startSaleMock.mockReset();
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
});

describe("/api/status", () => {
  it("is closed until the email settings exist, and leaks nothing", async () => {
    let body = await (await statusGet()).json();
    expect(body).toEqual({ open: false });
    configured();
    body = await (await statusGet()).json();
    expect(body).toEqual({ open: true });
  });
});

describe("/api/sale", () => {
  it("refuses to start checkout while requests cannot be delivered", async () => {
    const res = await salePost(json({ url: "https://example.com", variant: "standard" }));
    expect(res.status).toBe(503);
    expect(startSaleMock).not.toHaveBeenCalled();
  });

  it("rejects unknown plans and bad addresses", async () => {
    configured();
    expect((await salePost(json({ url: "https://example.com", variant: "enterprise" }))).status).toBe(400);
    expect((await salePost(json({ url: "http://localhost", variant: "standard" }))).status).toBe(400);
    expect(startSaleMock).not.toHaveBeenCalled();
  });

  it("starts checkout for a valid plan", async () => {
    configured();
    startSaleMock.mockResolvedValue({ ok: true, checkoutUrl: "https://checkout.example/p", sessionId: "cs_1" });
    const res = await salePost(json({ url: "example.com", variant: "plus" }));
    expect(res.status).toBe(200);
    expect(startSaleMock).toHaveBeenCalledWith({ url: "https://example.com/", variant: "plus" });
    expect(await res.json()).toEqual({ ok: true, url: "https://checkout.example/p", sessionId: "cs_1" });
  });
});

describe("/api/verify", () => {
  it("returns 402 when unpaid and never returns the receipt email", async () => {
    verifySaleMock.mockResolvedValue({ ok: false, paid: false, message: "Payment not completed." });
    expect((await verifyGet(new Request("https://t.example/api/verify?session_id=x"))).status).toBe(402);

    verifySaleMock.mockResolvedValue(PAID);
    const res = await verifyGet(new Request("https://t.example/api/verify?session_id=cs_test_12345678"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variant).toBe("plus");
    expect(JSON.stringify(body)).not.toContain("pay@example.com");
  });
  it("returns 503 for retryable verification failures", async () => {
    verifySaleMock.mockResolvedValue({
      ok: false,
      paid: false,
      retryable: true,
      message: "Could not reach the shop payment desk.",
    });
    const res = await verifyGet(new Request("https://t.example/api/verify?session_id=x"));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ retryable: true });
  });
});

describe("/api/intake", () => {
  it("is closed when email settings are missing", async () => {
    const res = await intakePost(json(FORM));
    expect(res.status).toBe(503);
    expect(verifySaleMock).not.toHaveBeenCalled();
  });

  it("refuses an unpaid or foreign checkout and sends nothing", async () => {
    configured();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    verifySaleMock.mockResolvedValue({ ok: false, paid: false, message: "That checkout is for a different product." });
    const res = await intakePost(json(FORM));
    expect(res.status).toBe(402);
    expect(f).not.toHaveBeenCalled();
  });

  it("refuses a missing session id", async () => {
    configured();
    verifySaleMock.mockResolvedValue({ ok: false, paid: false, message: "Missing checkout reference." });
    const { sessionId: _s, ...noSession } = FORM;
    void _s;
    expect((await intakePost(json(noSession))).status).toBe(402);
  });

  it("rejects a bad form after payment check, without sending", async () => {
    configured();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    verifySaleMock.mockResolvedValue(PAID);
    const res = await intakePost(json({ ...FORM, contactEmail: "nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("contactEmail");
    const pw = await intakePost(json({ ...FORM, accessNotes: "password: abc12345" }));
    expect(pw.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("emails the owner once for a paid checkout, with the plan from the shop", async () => {
    configured();
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    verifySaleMock.mockResolvedValue(PAID);
    // A client-supplied plan must be ignored.
    const res = await intakePost(json({ ...FORM, variant: "standard" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reference: "12345678" });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.test/emails");
    const sent = JSON.parse(String(init.body));
    expect(sent.to).toEqual(["me@example.com"]);
    expect(sent.reply_to).toBe("owner@example.com");
    expect(sent.subject).toBe("Fix It For Me Plus: example.com");
    expect(sent.text).toContain("cs_test_12345678");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("fix-it-cs_test_12345678");
  });

  it("treats a repeat of the same checkout as received", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 409 })));
    verifySaleMock.mockResolvedValue(PAID);
    const res = await intakePost(json(FORM));
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
  });

  it("tells the buyer to retry when the email provider fails, without leaking details", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"message":"key abc rejected"}', { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    verifySaleMock.mockResolvedValue(PAID);
    const res = await intakePost(json(FORM));
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("test-key");
    expect(text).not.toContain("abc rejected");
  });

  it("rejects oversized and non-JSON bodies", async () => {
    configured();
    expect((await intakePost(json({ ...FORM, whatToFix: "x".repeat(25000) }))).status).toBe(400);
    const bad = new Request("https://t.example/api/intake", { method: "POST", body: "not json" });
    expect((await intakePost(bad)).status).toBe(400);
  });
});

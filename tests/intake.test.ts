import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FROM,
  buildNotification,
  checkIntake,
  looksLikePassword,
  notifyConfig,
  sendNotification,
} from "@/lib/intake";

const GOOD = {
  siteUrl: "example.com",
  whatToFix: "Please fix the page titles and add photo descriptions.",
  contactEmail: "owner@example.com",
  accessNotes: "Wix site. My business partner owns the account.",
};

describe("checkIntake", () => {
  it("accepts a complete form and normalises the site", () => {
    const r = checkIntake(GOOD);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.siteUrl).toBe("https://example.com/");
      expect(r.value.host).toBe("example.com");
    }
  });

  it("allows empty access notes", () => {
    expect(checkIntake({ ...GOOD, accessNotes: "" }).ok).toBe(true);
  });

  it.each([
    ["siteUrl", { siteUrl: "" }],
    ["siteUrl", { siteUrl: "http://localhost:3000" }],
    ["whatToFix", { whatToFix: "fix" }],
    ["whatToFix", { whatToFix: "x".repeat(4001) }],
    ["contactEmail", { contactEmail: "not an email" }],
    ["contactEmail", { contactEmail: "a@b.com, c@d.com" }],
    ["accessNotes", { accessNotes: "y".repeat(2001) }],
  ])("rejects a bad %s", (field, patch) => {
    const r = checkIntake({ ...GOOD, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe(field);
  });

  it("rejects pasted passwords", () => {
    const r = checkIntake({ ...GOOD, accessNotes: "login is admin, password: Tr0ub4dor" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe("accessNotes");
      expect(r.message.toLowerCase()).toContain("password");
    }
    expect(checkIntake({ ...GOOD, whatToFix: "Fix the header. pwd=abc12345" }).ok).toBe(false);
  });

  it("does not trip on the word password in ordinary text", () => {
    expect(looksLikePassword("I forgot who owns the account and the password reset page is broken")).toBe(false);
    expect(looksLikePassword("Please do not send a password")).toBe(false);
    expect(looksLikePassword("pass: hunter2")).toBe(true);
    expect(looksLikePassword("my password is hunter22")).toBe(true);
    expect(looksLikePassword("my password is Tr0ub4dor!")).toBe(true);
    expect(looksLikePassword("the password is broken and I cannot log in")).toBe(false);
  });
});

describe("notifyConfig", () => {
  it("is closed unless both required values exist", () => {
    expect(notifyConfig({})).toBeNull();
    expect(notifyConfig({ RESEND_API_KEY: "k" })).toBeNull();
    expect(notifyConfig({ FIX_IT_NOTIFY_EMAIL: "me@example.com" })).toBeNull();
    expect(notifyConfig({ RESEND_API_KEY: "k", FIX_IT_NOTIFY_EMAIL: "not-an-email" })).toBeNull();
  });

  it("reads recipients, sender and base", () => {
    const c = notifyConfig({ RESEND_API_KEY: " k ", FIX_IT_NOTIFY_EMAIL: "a@x.com, b@x.com" });
    expect(c).toEqual({
      apiKey: "k",
      to: ["a@x.com", "b@x.com"],
      from: DEFAULT_FROM,
      apiBase: "https://api.resend.com",
    });
    expect(
      notifyConfig({ RESEND_API_KEY: "k", FIX_IT_NOTIFY_EMAIL: "a@x.com", FIX_IT_FROM_EMAIL: "Me <m@x.com>" })?.from,
    ).toBe("Me <m@x.com>");
  });
});

describe("buildNotification", () => {
  const intake = (() => {
    const r = checkIntake(GOOD);
    if (!r.ok) throw new Error("fixture");
    return r.value;
  })();

  it("has the plan, site, reply address, checkout reference and the request", () => {
    const m = buildNotification({ intake, variant: "plus", sessionId: "cs_abc123", receiptEmail: "pay@example.com" });
    expect(m.subject).toBe("Fix It For Me Plus: example.com");
    expect(m.text).toContain("Plan: Plus");
    expect(m.text).toContain("Site: https://example.com/");
    expect(m.text).toContain("Reply to: owner@example.com");
    expect(m.text).toContain("Email on the Stripe receipt: pay@example.com");
    expect(m.text).toContain("cs_abc123");
    expect(m.text).toContain(GOOD.whatToFix);
    expect(m.text).toContain(GOOD.accessNotes);
  });

  it("keeps the subject to a clean host (no header injection from free text)", () => {
    const r = checkIntake({ ...GOOD, whatToFix: "Fix this\r\nBcc: evil@example.com please" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const m = buildNotification({ intake: r.value, variant: "standard", sessionId: "cs_1" });
      expect(m.subject).not.toMatch(/[\r\n]/);
      expect(m.subject).toBe("Fix It For Me Standard: example.com");
    }
  });

  it("says when no access notes were given and when the paid site differs", () => {
    const r = checkIntake({ ...GOOD, accessNotes: "" });
    if (!r.ok) throw new Error("fixture");
    const m = buildNotification({ intake: r.value, variant: "standard", sessionId: "cs_1", paidSite: "https://other.example/" });
    expect(m.text).toContain("(none given)");
    expect(m.text).toContain("Site they audited and paid for: https://other.example/");
  });
});

describe("sendNotification", () => {
  const config = { apiKey: "test-key", to: ["me@example.com"], from: DEFAULT_FROM, apiBase: "https://api.resend.test" };
  const message = { subject: "S", text: "T" };

  it("posts to Resend with the key, an idempotency key and a reply-to", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const r = await sendNotification(config, message, { replyTo: "buyer@example.com", idempotencyKey: "fix-it-cs_1" }, f);
    expect(r).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.test/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Idempotency-Key"]).toBe("fix-it-cs_1");
    expect(JSON.parse(String(init.body))).toEqual({
      from: DEFAULT_FROM,
      to: ["me@example.com"],
      reply_to: "buyer@example.com",
      subject: "S",
      text: "T",
    });
  });

  it("reports a repeat of the same checkout as a duplicate", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 409 }));
    expect(await sendNotification(config, message, { replyTo: "a@b.co", idempotencyKey: "k" }, f)).toEqual({
      ok: false,
      duplicate: true,
      status: 409,
    });
  });

  it("reports provider and network failures", async () => {
    const bad = vi.fn().mockResolvedValue(new Response("{}", { status: 422 }));
    expect(await sendNotification(config, message, { replyTo: "a@b.co", idempotencyKey: "k" }, bad)).toEqual({
      ok: false,
      status: 422,
    });
    const down = vi.fn().mockRejectedValue(new Error("x"));
    expect((await sendNotification(config, message, { replyTo: "a@b.co", idempotencyKey: "k" }, down)).ok).toBe(false);
  });
});

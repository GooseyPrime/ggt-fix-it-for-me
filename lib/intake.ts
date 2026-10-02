import { normalizeUrl } from "./normalize-url";
import type { VariantId } from "./types";

export const LIMITS = {
  whatToFix: { min: 10, max: 4000 },
  accessNotes: { max: 2000 },
  email: { max: 254 },
} as const;

export type IntakeInput = {
  siteUrl?: unknown;
  whatToFix?: unknown;
  contactEmail?: unknown;
  accessNotes?: unknown;
};

export type Intake = {
  siteUrl: string;
  host: string;
  whatToFix: string;
  contactEmail: string;
  accessNotes: string;
};

export type IntakeCheck =
  | { ok: true; value: Intake }
  | { ok: false; field: keyof IntakeInput; message: string };

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/** "password: hunter2", "pwd = abc": someone pasting a login. */
const PASSWORD_LABELLED = /\b(?:pass(?:word|wd|code)?|pwd|passphrase)\b\s*[:=]\s*\S+/i;
/** "my password is Tr0ub4dor!": only when what follows looks like a secret, not a word. */
const PASSWORD_SENTENCE = /\b(?:pass(?:word|wd|code)?|pwd|passphrase)\b\s+is\s+(?=\S*[0-9!@#$%^&*])\S{6,}/i;

export function looksLikePassword(text: string): boolean {
  return PASSWORD_LABELLED.test(text) || PASSWORD_SENTENCE.test(text);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

export function checkIntake(input: IntakeInput): IntakeCheck {
  const site = normalizeUrl(text(input.siteUrl));
  if (!site.href || !site.host) {
    return { ok: false, field: "siteUrl", message: site.error || "Enter your website address." };
  }

  const whatToFix = text(input.whatToFix);
  if (whatToFix.length < LIMITS.whatToFix.min) {
    return { ok: false, field: "whatToFix", message: "Tell us what you want fixed, in a sentence or two." };
  }
  if (whatToFix.length > LIMITS.whatToFix.max) {
    return {
      ok: false,
      field: "whatToFix",
      message: `Please keep this under ${LIMITS.whatToFix.max} characters.`,
    };
  }

  const contactEmail = text(input.contactEmail);
  if (!contactEmail || contactEmail.length > LIMITS.email.max || !EMAIL.test(contactEmail)) {
    return { ok: false, field: "contactEmail", message: "Enter an email address we can reply to." };
  }

  const accessNotes = text(input.accessNotes);
  if (accessNotes.length > LIMITS.accessNotes.max) {
    return {
      ok: false,
      field: "accessNotes",
      message: `Please keep this under ${LIMITS.accessNotes.max} characters.`,
    };
  }

  const passwordInWhatToFix = looksLikePassword(whatToFix);
  const passwordInAccessNotes = looksLikePassword(accessNotes);
  if (passwordInWhatToFix || passwordInAccessNotes) {
    return {
      ok: false,
      field: passwordInWhatToFix ? "whatToFix" : "accessNotes",
      message:
        "This looks like it contains a password. Please remove it. We will never ask you to send one; we will tell you how to give access safely.",
    };
  }

  return {
    ok: true,
    value: { siteUrl: site.href, host: site.host, whatToFix, contactEmail, accessNotes },
  };
}

// ---------------------------------------------------------------------------
// Email to the owner (Resend)
// ---------------------------------------------------------------------------

type Env = Record<string, string | undefined>;

export type NotifyConfig = {
  apiKey: string;
  to: string[];
  from: string;
  apiBase: string;
};

/** Resend's shared test sender. It can only deliver to the email on the Resend account. */
export const DEFAULT_FROM = "Golden Goose Tools <onboarding@resend.dev>";

/**
 * Reads RESEND_API_KEY and FIX_IT_NOTIFY_EMAIL (required), FIX_IT_FROM_EMAIL (optional).
 * Returns null when a required value is missing, which keeps checkout closed.
 */
export function notifyConfig(env: Env = process.env): NotifyConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = (env.FIX_IT_NOTIFY_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => EMAIL.test(s));
  if (!apiKey || to.length === 0) return null;
  return {
    apiKey,
    to,
    from: env.FIX_IT_FROM_EMAIL?.trim() || DEFAULT_FROM,
    apiBase: (env.RESEND_API_BASE?.trim() || "https://api.resend.com").replace(/\/+$/, ""),
  };
}

export function planLabel(variant: VariantId): string {
  return variant === "plus" ? "Plus" : "Standard";
}

export function buildNotification(input: {
  intake: Intake;
  variant: VariantId;
  sessionId: string;
  receiptEmail?: string;
  paidSite?: string;
}): { subject: string; text: string } {
  const { intake, variant, sessionId } = input;
  const lines = [
    `New Fix It For Me request (${planLabel(variant)})`,
    "",
    `Site: ${intake.siteUrl}`,
    `Reply to: ${intake.contactEmail}`,
    input.receiptEmail && input.receiptEmail !== intake.contactEmail
      ? `Email on the Stripe receipt: ${input.receiptEmail}`
      : null,
    input.paidSite && input.paidSite !== intake.siteUrl ? `Site they audited and paid for: ${input.paidSite}` : null,
    `Plan: ${planLabel(variant)} (checked against the shop, paid)`,
    `Checkout reference: ${sessionId}`,
    "",
    "What to fix:",
    intake.whatToFix,
    "",
    "Access notes:",
    intake.accessNotes || "(none given)",
    "",
    "Reply to this email to answer them. Do not ask for passwords by email.",
  ].filter((l): l is string => l !== null);
  return {
    subject: `Fix It For Me ${planLabel(variant)}: ${intake.host}`,
    text: lines.join("\n"),
  };
}

export type SendResult = { ok: true } | { ok: false; duplicate?: boolean; status?: number };

export async function sendNotification(
  config: NotifyConfig,
  message: { subject: string; text: string },
  options: { replyTo: string; idempotencyKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const res = await fetchImpl(`${config.apiBase}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": options.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: config.from,
        to: config.to,
        reply_to: options.replyTo,
        subject: message.subject,
        text: message.text,
      }),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    // Same checkout reference sent again with different text: the first one already went out.
    if (res.status === 409) return { ok: false, duplicate: true, status: 409 };
    return { ok: false, status: res.status };
  } catch {
    return { ok: false };
  }
}

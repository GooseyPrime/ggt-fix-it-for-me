import { TOOL_ID, shopOrigin } from "./config";
import type { VariantId } from "./types";

export type SaleResult =
  | { ok: true; checkoutUrl: string; sessionId?: string }
  | { ok: false; message: string };

export type VerifyResult = {
  ok: boolean;
  paid: boolean;
  retryable?: boolean;
  message?: string;
  sessionId?: string;
  variant?: VariantId;
  targetUrl?: string;
  /** The email Stripe collected at checkout. Server use only; never returned to the browser. */
  receiptEmail?: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function safeCheckoutUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Start checkout through the shop (POST /api/sale). The shop decides the price from
 * the plan; this tool never sends an amount.
 */
export async function startSale(input: { url: string; variant: VariantId }): Promise<SaleResult> {
  try {
    const res = await fetch(`${shopOrigin()}/api/sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        url: input.url,
        product: TOOL_ID,
        toolId: TOOL_ID,
        variant: input.variant,
      }),
      cache: "no-store",
    });
    const data = await readJson(res);
    const checkoutUrl = data ? safeCheckoutUrl(asString(data.url) ?? asString(data.checkoutUrl)) : undefined;
    if (res.ok && data?.ok === true && checkoutUrl) {
      return { ok: true, checkoutUrl, sessionId: asString(data.sessionId) };
    }
    return {
      ok: false,
      message: (data && asString(data.message)) || "We could not start checkout. Please try again.",
    };
  } catch {
    return { ok: false, message: "We could not reach checkout. Please try again." };
  }
}

/**
 * Paid only when the shop says ok + paid (or a $0 promo) AND the checkout is for
 * Fix It For Me. The plan comes from the shop's record, never from the browser.
 */
export async function verifySale(sessionId: string): Promise<VerifyResult> {
  const id = sessionId.trim();
  if (!id) return { ok: false, paid: false, message: "Missing checkout reference." };
  try {
    const url = new URL(`${shopOrigin()}/api/verify`);
    url.searchParams.set("session_id", id);
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await readJson(res);
    if (res.status === 408 || res.status === 429 || res.status >= 500) {
      return {
        ok: false,
        paid: false,
        retryable: true,
        message: (data && asString(data.message)) || "The shop could not confirm this purchase. Please try again.",
      };
    }
    if (!data) {
      return {
        ok: false,
        paid: false,
        retryable: true,
        message: "The shop did not confirm this purchase.",
      };
    }
    const product = asString(data.product) ?? asString(data.productId);
    const toolId = asString(data.toolId);
    const paidFlag = data.paid === true || asString(data.paymentStatus) === "no_payment_required";
    const rightProduct = product === TOOL_ID && (toolId === undefined || toolId === TOOL_ID);
    const paid = res.ok && data.ok === true && paidFlag && rightProduct;
    if (!paid) {
      return {
        ok: false,
        paid: false,
        message:
          data.ok === true && paidFlag && !rightProduct
            ? "That checkout is for a different product."
            : asString(data.message) || "Payment not completed.",
      };
    }
    const rawVariant = asString(data.variant);
    if (rawVariant !== "standard" && rawVariant !== "plus") {
      return {
        ok: false,
        paid: false,
        retryable: true,
        message: "The shop returned an unsupported plan.",
      };
    }
    const variant: VariantId = rawVariant;
    return {
      ok: true,
      paid: true,
      sessionId: id,
      variant,
      targetUrl: asString(data.targetUrl),
      receiptEmail: asString(data.email),
    };
  } catch {
    return { ok: false, paid: false, retryable: true, message: "Could not reach the shop payment desk." };
  }
}

import {
  TOOL_ID,
  allowLocalUnlock,
  fixItSaleLive,
  shopOrigin,
} from "./config";
import type { VariantId } from "./types";

export type SaleRequest = {
  url: string;
  variant: VariantId;
  returnUrl: string;
};

export type SaleResult =
  | { ok: true; checkoutUrl: string; sessionId?: string }
  | {
      ok: false;
      message: string;
      code?: "sku_not_live" | "unconfigured" | "shop_error";
    };

export type VerifyResult = {
  ok: boolean;
  paid: boolean;
  kind?: string;
  message?: string;
  sessionId?: string;
  paymentStatus?: string;
};

const LOCAL_SESSION = "local";

/**
 * Start checkout via shop POST /api/sale.
 * Body: { url, product: "fix-it", toolId: "fix-it", variant: "standard"|"plus" }
 *
 * NEVER falls through to seo-audit / accessibility. Until the desk allowlist includes
 * fix-it, refuse here — otherwise the shop would price the session as SEO $29.
 */
export async function startSale(input: SaleRequest): Promise<SaleResult> {
  if (!fixItSaleLive()) {
    return {
      ok: false,
      code: "sku_not_live",
      message:
        "Checkout for Fix It For Me is not live on the shop sale desk yet. The free three-way split still works. We will not send you through SEO Audit or Accessibility checkout (that would charge the wrong price).",
    };
  }

  const origin = shopOrigin();
  if (!origin) {
    if (allowLocalUnlock()) {
      const next = new URL(input.returnUrl);
      next.searchParams.set("session_id", LOCAL_SESSION);
      next.searchParams.set("variant", input.variant);
      return { ok: true, checkoutUrl: next.toString(), sessionId: LOCAL_SESSION };
    }
    return {
      ok: false,
      code: "unconfigured",
      message: "Shop payments are not configured. Set NEXT_PUBLIC_SHOP_ORIGIN.",
    };
  }

  // Exact shop sale contract after allowlist merges.
  const body = JSON.stringify({
    url: input.url,
    product: TOOL_ID,
    toolId: TOOL_ID,
    variant: input.variant,
  });

  const result = await postSale(`${origin}/api/sale`, body);
  if (result.ok) return result;
  return { ok: false, code: "shop_error", message: result.message };
}

/**
 * Verify via shop GET /api/verify?session_id= or POST { sessionId }.
 * Unlock when ok && paid. $0 promo (paymentStatus "no_payment_required") still unlocks.
 */
export async function verifySale(sessionId: string): Promise<VerifyResult> {
  if (!sessionId) {
    return {
      ok: false,
      paid: false,
      kind: "invalid_request",
      message: "Missing checkout session id.",
    };
  }

  const origin = shopOrigin();
  if (!origin) {
    if (allowLocalUnlock() && sessionId === LOCAL_SESSION) {
      return {
        ok: true,
        paid: true,
        sessionId,
        kind: "local_unlock",
        paymentStatus: "no_payment_required",
      };
    }
    return {
      ok: false,
      paid: false,
      kind: "unconfigured",
      message: "Shop verification is not configured.",
    };
  }

  const getUrl = new URL(`${origin}/api/verify`);
  getUrl.searchParams.set("session_id", sessionId);
  getUrl.searchParams.set("product", TOOL_ID);
  getUrl.searchParams.set("toolId", TOOL_ID);
  const getBody = await fetchJson(getUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (getBody.ok && isVerifyShape(getBody.body)) return normalizeVerify(getBody.body, sessionId);

  const postBody = await fetchJson(`${origin}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sessionId,
      session_id: sessionId,
      product: TOOL_ID,
      toolId: TOOL_ID,
    }),
  });
  if (postBody.ok && isVerifyShape(postBody.body)) return normalizeVerify(postBody.body, sessionId);
  if (!getBody.ok && !postBody.ok) {
    return {
      ok: false,
      paid: false,
      kind: "shop_error",
      message: "Could not reach the shop payment desk.",
    };
  }

  return {
    ok: false,
    paid: false,
    kind: "invalid_response",
    message: "The shop did not confirm this Fix It sale.",
  };
}

async function postSale(
  url: string,
  body: string,
): Promise<SaleResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    const data = await readJson(res);
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const checkoutUrl =
        asString(record.url) ?? asString(record.checkoutUrl) ?? asString(record.checkout_url);

      if (res.ok && checkoutUrl && record.ok !== false) {
        return {
          ok: true,
          checkoutUrl,
          sessionId: asString(record.sessionId) ?? asString(record.session_id),
        };
      }

      if (!res.ok || record.ok === false) {
        return {
          ok: false,
          code: "shop_error",
          message:
            asString(record.message) ??
            "The shop sale desk refused this checkout. Fix It may not be on the allowlist yet.",
        };
      }

      return {
        ok: false,
        code: "shop_error",
        message: asString(record.message) ?? "The shop could not start checkout.",
      };
    }
    return { ok: false, code: "shop_error", message: "The shop could not start checkout." };
  } catch {
    return {
      ok: false,
      code: "shop_error",
      message: "Could not reach the shop payment desk.",
    };
  }
}

function isVerifyShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && ("paid" in (value as object) || "ok" in (value as object)));
}

function normalizeVerify(data: Record<string, unknown>, sessionId: string): VerifyResult {
  const paymentStatus = asString(data.paymentStatus) ?? asString(data.payment_status);
  const toolMatched = matchesTool(data);
  const paidFlag = data.paid === true;
  const zeroPromo = paymentStatus === "no_payment_required";
  const okFlag = data.ok === true;
  const paid = toolMatched && (zeroPromo || (okFlag && paidFlag));
  const ok = toolMatched && (okFlag || zeroPromo);

  return {
    ok,
    paid,
    kind: toolMatched ? asString(data.kind) : "invalid_product",
    message:
      toolMatched
        ? asString(data.message)
        : "The shop did not confirm this Fix It sale.",
    sessionId: asString(data.sessionId) ?? asString(data.session_id) ?? sessionId,
    paymentStatus,
  };
}

function matchesTool(data: Record<string, unknown>): boolean {
  const metadata = asRecord(data.metadata);
  const product =
    asString(data.product) ??
    asString(data.product_id) ??
    asString(data.productId) ??
    asString(metadata?.product) ??
    asString(metadata?.product_id) ??
    asString(metadata?.productId);
  const toolId =
    asString(data.toolId) ??
    asString(data.tool_id) ??
    asString(metadata?.toolId) ??
    asString(metadata?.tool_id);

  if (!product && !toolId) return false;
  if (product && product !== TOOL_ID) return false;
  if (toolId && toolId !== TOOL_ID) return false;
  return true;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function fetchJson(
  input: string,
  init: RequestInit,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const res = await fetch(input, init);
    return { ok: true, body: await readJson(res) };
  } catch {
    return { ok: false };
  }
}

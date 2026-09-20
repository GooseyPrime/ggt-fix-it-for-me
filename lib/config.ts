/** Tool registry stub — shop may list id `fix-it`, path `/tools/fix-it`. */
export const TOOL_ID = "fix-it";
export const TOOL_SLUG = "fix-it-for-me";
export const TOOL_PATH = "/tools/fix-it";
export const TOOL_NAME = "Fix It For Me";
/** Ember — Cos accent for this tool. */
export const ACCENT = "#b4553f";

export const LIVE = false;

type Env = Record<string, string | undefined>;

function publicEnv(): Env {
  return {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_LOCAL_UNLOCK: process.env.ALLOW_LOCAL_UNLOCK,
    NEXT_PUBLIC_SHOP_ORIGIN: process.env.NEXT_PUBLIC_SHOP_ORIGIN,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
    NEXT_PUBLIC_SHOP_SALE_PRODUCTS: process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS,
    NEXT_PUBLIC_PRICE_STANDARD_CENTS: process.env.NEXT_PUBLIC_PRICE_STANDARD_CENTS,
    NEXT_PUBLIC_PRICE_PLUS_CENTS: process.env.NEXT_PUBLIC_PRICE_PLUS_CENTS,
    NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK: process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK,
  };
}

export function shopOrigin(env: Env = publicEnv()): string | null {
  const raw = env.NEXT_PUBLIC_SHOP_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Products the shop sale desk currently accepts.
 * TODAY: seo-audit|accessibility only. Until `fix-it` appears, checkout must refuse —
 * never fall through (sending fix-it would be priced as SEO $29).
 */
export function shopSaleProducts(env: Env = publicEnv()): Set<string> {
  const raw = env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS?.trim();
  const list = (raw && raw.length > 0 ? raw : "seo-audit,accessibility")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list);
}

export function fixItSaleLive(env: Env = publicEnv()): boolean {
  return shopSaleProducts(env).has(TOOL_ID);
}

export function allowLocalUnlock(env: Env = publicEnv()): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.ALLOW_LOCAL_UNLOCK === "true" || env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK === "true";
}

export function publicBasePath(env: Env = publicEnv()): string {
  return env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
}

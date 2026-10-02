/** Golden Goose Tools — Fix It For Me. Served on the shop at /tools/fix-it. */
export const TOOL_ID = "fix-it";
export const TOOL_PATH = "/tools/fix-it";
export const TOOL_NAME = "Fix It For Me";
/** Ember accent. */
export const ACCENT = "#b4553f";

export const DEFAULT_SHOP_ORIGIN = "https://www.goldengoosetools.com";

type Env = Record<string, string | undefined>;

function publicEnv(): Env {
  return {
    NEXT_PUBLIC_SHOP_ORIGIN: process.env.NEXT_PUBLIC_SHOP_ORIGIN,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  };
}

/** The shop owns checkout and payment checks. */
export function shopOrigin(env: Env = publicEnv()): string {
  const raw = env.NEXT_PUBLIC_SHOP_ORIGIN?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_SHOP_ORIGIN).replace(/\/+$/, "");
}

export function publicBasePath(env: Env = publicEnv()): string {
  return normalizeBasePath(env.NEXT_PUBLIC_BASE_PATH);
}

export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

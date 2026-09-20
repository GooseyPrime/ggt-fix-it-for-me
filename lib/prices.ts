import type { PriceTiers, VariantId } from "./types";

/** Read cents from env that mirrors shop config. Never invent amounts. */
export function readPriceCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Prices mirrored from shop lib/config.ts (standard / plus).
 * If unset, the UI shows no dollar figure — never invent $149/$249 in code.
 */
export function shopPrices(env?: Record<string, string | undefined>): PriceTiers {
  const source = env ?? {
    NEXT_PUBLIC_PRICE_STANDARD_CENTS: process.env.NEXT_PUBLIC_PRICE_STANDARD_CENTS,
    NEXT_PUBLIC_PRICE_PLUS_CENTS: process.env.NEXT_PUBLIC_PRICE_PLUS_CENTS,
  };
  return {
    standardCents: readPriceCents(source.NEXT_PUBLIC_PRICE_STANDARD_CENTS),
    plusCents: readPriceCents(source.NEXT_PUBLIC_PRICE_PLUS_CENTS),
  };
}

export function variantPrice(
  prices: PriceTiers,
  variant: VariantId,
): { cents: number; label: string } | null {
  const cents = variant === "plus" ? prices.plusCents : prices.standardCents;
  if (cents == null) return null;
  return { cents, label: formatUsdFromCents(cents) };
}

export function anyPriceConfigured(prices: PriceTiers): boolean {
  return prices.standardCents != null || prices.plusCents != null;
}

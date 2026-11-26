import { publicBasePath } from "@/lib/config";
import type { PriceTiers, VariantId } from "@/lib/types";

export function buildApiUrl(path: string, basePath = publicBasePath()): string {
  const prefix = basePath.replace(/\/$/, "");
  return `${prefix}${path}`;
}

export function defaultVariantId(prices: PriceTiers): VariantId {
  if (prices.standardCents != null) return "standard";
  if (prices.plusCents != null) return "plus";
  return "standard";
}

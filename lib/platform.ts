import type { PlatformId } from "./types";

export type PlatformInfo = {
  id: PlatformId;
  label: string;
};

const RULES: Array<{
  id: PlatformId;
  label: string;
  test: (html: string, host: string) => boolean;
}> = [
  {
    id: "wix",
    label: "Wix",
    test: (html, host) =>
      /wix\.com|wixstatic\.com|X-Wix-|wix-warmup/i.test(html) || /\.wixsite\.com$/i.test(host),
  },
  {
    id: "squarespace",
    label: "Squarespace",
    test: (html, host) =>
      /squarespace\.com|static\.sqsp\.net|squarespace-cdn/i.test(html) ||
      /\.squarespace\.com$/i.test(host),
  },
  {
    id: "shopify",
    label: "Shopify",
    test: (html, host) =>
      /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i.test(html) ||
      /\.myshopify\.com$/i.test(host),
  },
  {
    id: "webflow",
    label: "Webflow",
    test: (html, host) =>
      /webflow\.com|wf-page|w-mod-/i.test(html) || /\.webflow\.io$/i.test(host),
  },
  {
    id: "godaddy",
    label: "GoDaddy Website Builder",
    test: (html) => /godaddy\.com|secureserver\.net|gd-website/i.test(html),
  },
  {
    id: "wordpress-com",
    label: "WordPress.com",
    test: (html, host) =>
      /wordpress\.com|wp\.com\/|public-api\.wordpress\.com/i.test(html) ||
      /\.wordpress\.com$/i.test(host),
  },
  {
    id: "wordpress-org",
    label: "WordPress (self-hosted)",
    test: (html) => /wp-content\/|wp-includes\//i.test(html),
  },
];

export function detectPlatform(html: string, host: string): PlatformInfo {
  for (const rule of RULES) {
    if (rule.test(html, host)) return { id: rule.id, label: rule.label };
  }
  return { id: "unknown", label: "Custom / unknown platform" };
}

/** Platforms where server-header / deep theme edits are typically locked. */
export function isManagedBuilder(id: PlatformId): boolean {
  return id === "wix" || id === "squarespace" || id === "godaddy" || id === "webflow";
}

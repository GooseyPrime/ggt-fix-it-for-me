import { isManagedBuilder } from "./platform";
import type { Bucket, Finding, PlatformId } from "./types";

export function countBuckets(findings: Finding[]): Record<Bucket, number> {
  return {
    included: findings.filter((f) => f.bucket === "included").length,
    needs_decision: findings.filter((f) => f.bucket === "needs_decision").length,
    not_possible: findings.filter((f) => f.bucket === "not_possible").length,
  };
}

export function metaContent(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`,
    "i",
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim() || null;
}

export function titleText(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() || null;
}

export function hasLang(html: string): boolean {
  return /<html[^>]*\slang=["'][^"']+["']/i.test(html);
}

export function hasViewport(html: string): boolean {
  return /<meta[^>]*name=["']viewport["']/i.test(html);
}

export function imgWithoutAltCount(html: string): number {
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  let missing = 0;
  for (const tag of imgs) {
    if (!/\balt=/i.test(tag)) {
      missing += 1;
      continue;
    }
    const m = tag.match(/\balt=["']([^"']*)["']/i);
    if (m && m[1].trim() === "") missing += 1;
  }
  return missing;
}

export function h1Count(html: string): number {
  return (html.match(/<h1\b/gi) ?? []).length;
}

export function looksLikePlaceholderCopy(html: string): boolean {
  return /lorem ipsum|coming soon|your (?:company|business) (?:name|here)|sample text|placeholder/i.test(
    html,
  );
}

export function pushFinding(list: Finding[], finding: Finding) {
  if (!list.some((f) => f.id === finding.id)) list.push(finding);
}

export function applyDescriptionHints(
  findings: Finding[],
  description: string,
  platformId: PlatformId,
  platformLabel: string,
) {
  if (/phone|email|contact|hours|address|location|call us/i.test(description)) {
    pushFinding(findings, {
      id: "desc-contact",
      title: "Contact details need your real information",
      detail: "You mentioned contact, hours, or location issues.",
      bucket: "needs_decision",
      reason: "We will place what you provide; we will not invent a phone number or address.",
    });
  }
  if (/seo|title|meta|description|google|ranking|search/i.test(description)) {
    pushFinding(findings, {
      id: "desc-seo",
      title: "SEO basics from your description",
      detail: "You asked about search visibility or titles/descriptions.",
      bucket: "included",
      reason:
        "Title tags, meta descriptions you approve, and heading tidy-ups are in scope when the platform allows markup edits.",
    });
  }
  if (/alt text|accessibility|a11y|screen reader|contrast|keyboard/i.test(description)) {
    pushFinding(findings, {
      id: "desc-a11y",
      title: "Accessibility fixes need accurate labels",
      detail: "You mentioned accessibility or alt text.",
      bucket: "needs_decision",
      reason:
        "Meaningful labels require your confirmation — we will not invent what an image shows.",
    });
  }
  if (
    /wix|squarespace|shopify|webflow|godaddy|can't change|cannot change|locked|theme won't|theme wont/i.test(
      description,
    ) ||
    isManagedBuilder(platformId)
  ) {
    pushFinding(findings, {
      id: "desc-platform-lock",
      title: "Some requested changes may be blocked by the platform",
      detail: "Your notes suggest builder or theme limits.",
      bucket: "not_possible",
      reason: `If ${platformLabel} locks the control, we will say so instead of pretending we can force it.`,
    });
  }
  if (/broken link|404|redirect/i.test(description)) {
    pushFinding(findings, {
      id: "desc-links",
      title: "Broken links / redirects",
      detail: "You mentioned link or redirect problems.",
      bucket: "included",
      reason: "Fixing destinations you confirm is standard included work.",
    });
  }
}

export function buildSummary(
  counts: Record<Bucket, number>,
  platformLabel: string,
  fetchOk: boolean,
): string {
  const parts = [
    `${counts.included} included`,
    `${counts.needs_decision} need a decision from you`,
    `${counts.not_possible} not possible on this platform`,
  ];
  const base = `On ${platformLabel}: ${parts.join(" · ")}.`;
  if (!fetchOk) {
    return `${base} (Scored from your description because the page could not be fetched.)`;
  }
  return base;
}

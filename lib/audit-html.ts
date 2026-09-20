import { detectPlatform, isManagedBuilder } from "./platform";
import {
  applyDescriptionHints,
  buildSummary,
  countBuckets,
  hasLang,
  hasViewport,
  imgWithoutAltCount,
  h1Count,
  looksLikePlaceholderCopy,
  metaContent,
  pushFinding,
  titleText,
} from "./audit-helpers";
import type { AuditResult, Finding } from "./types";

export function auditFromHtml(opts: {
  html: string;
  host: string;
  inputUrl: string | null;
  finalUrl: string | null;
  description?: string;
  fetchOk: boolean;
  fetchNote?: string;
}): AuditResult {
  const platform = detectPlatform(opts.html, opts.host);
  const findings: Finding[] = [];
  const managed = isManagedBuilder(platform.id);

  const title = titleText(opts.html);
  if (!title) {
    pushFinding(findings, {
      id: "missing-title",
      title: "Page title is missing",
      detail: "Browsers and search results need a clear title tag.",
      bucket: "included",
      reason:
        "We can draft a factual title from the page heading once you confirm the business name.",
      evidence: "No title element found.",
    });
  } else if (title.length < 12 || /untitled|home page|welcome/i.test(title)) {
    pushFinding(findings, {
      id: "weak-title",
      title: "Page title is weak or generic",
      detail: `Current title: “${title.slice(0, 80)}”.`,
      bucket: "needs_decision",
      reason:
        "A better title needs your preferred wording and what you sell — we will not invent that.",
      evidence: title.slice(0, 120),
    });
  }

  if (!metaContent(opts.html, "description")) {
    pushFinding(findings, {
      id: "missing-meta-description",
      title: "Meta description is missing",
      detail: "Search snippets often fall back to random page text without one.",
      bucket: "needs_decision",
      reason:
        "The description should state what you offer in your own words. We will not invent claims.",
    });
  }

  if (!hasLang(opts.html)) {
    pushFinding(findings, {
      id: "missing-lang",
      title: "Document language is not set",
      detail: "Screen readers use the lang attribute to pronounce content correctly.",
      bucket: "included",
      reason: 'Setting lang="en" (or your language) is a standard markup fix on most builders.',
    });
  }

  if (!hasViewport(opts.html)) {
    pushFinding(findings, {
      id: "missing-viewport",
      title: "Mobile viewport meta tag is missing",
      detail: "Phones may render the page at desktop width without it.",
      bucket: managed ? "not_possible" : "included",
      reason: managed
        ? `${platform.label} usually controls the viewport in the theme shell; we cannot override the builder chrome.`
        : "Adding a standard viewport meta tag is a routine markup fix.",
    });
  }

  const missingAlt = imgWithoutAltCount(opts.html);
  if (missingAlt > 0) {
    pushFinding(findings, {
      id: "images-missing-alt",
      title: `${missingAlt} image${missingAlt === 1 ? "" : "s"} missing alt text`,
      detail: "Images without alt text are invisible to screen readers and often to search.",
      bucket: "needs_decision",
      reason: "Alt text must describe each image’s purpose. Only you know what the photos show.",
      evidence: `${missingAlt} img tags without useful alt`,
    });
  }

  const h1s = h1Count(opts.html);
  if (h1s === 0) {
    pushFinding(findings, {
      id: "missing-h1",
      title: "No H1 heading on the page",
      detail: "A single clear H1 helps people and search engines understand the page.",
      bucket: "included",
      reason: "We can promote an existing heading or add a factual H1 from visible page copy.",
    });
  } else if (h1s > 1) {
    pushFinding(findings, {
      id: "multiple-h1",
      title: "More than one H1 heading",
      detail: `Found ${h1s} H1 elements.`,
      bucket: "included",
      reason: "We can demote extras to H2 without changing your meaning.",
    });
  }

  if (looksLikePlaceholderCopy(opts.html)) {
    pushFinding(findings, {
      id: "placeholder-copy",
      title: "Placeholder or sample copy still on the page",
      detail: "Visitors will treat unfinished copy as a trust problem.",
      bucket: "needs_decision",
      reason: "Replacement text has to come from you — we do not invent business facts.",
    });
  }

  if (managed) {
    pushFinding(findings, {
      id: "platform-headers",
      title: "Custom security headers are locked on this platform",
      detail: "HSTS, CSP, and similar headers are usually set by the host, not the page editor.",
      bucket: "not_possible",
      reason: `${platform.label} does not expose raw server-header edits on typical plans.`,
    });
  }

  if (platform.id === "wix" || platform.id === "squarespace") {
    pushFinding(findings, {
      id: "platform-theme-shell",
      title: "Theme shell and branding chrome are platform-controlled",
      detail: "Deep theme CSS and some layout chrome cannot be rewritten like a custom site.",
      bucket: "not_possible",
      reason: `On ${platform.label}, fixes stay inside the editor and approved apps — we will not promise theme-engine rewrites.`,
    });
  }

  const description = (opts.description ?? "").trim();
  if (description) {
    applyDescriptionHints(findings, description, platform.id, platform.label);
  }

  if (findings.length === 0) {
    pushFinding(findings, {
      id: "no-automated-issues",
      title: "No automated issues found on this pass",
      detail:
        "That does not mean the site is perfect — it means this free check did not invent problems.",
      bucket: "included",
      reason: "If something still feels wrong, describe it in the box and run again.",
    });
  }

  const counts = countBuckets(findings);
  return {
    ok: true,
    inputUrl: opts.inputUrl,
    finalUrl: opts.finalUrl,
    platform: platform.id,
    platformLabel: platform.label,
    fetchOk: opts.fetchOk,
    fetchNote: opts.fetchNote,
    descriptionUsed: Boolean(description),
    findings,
    counts,
    summary: buildSummary(counts, platform.label, opts.fetchOk),
  };
}

export function auditFromDescriptionOnly(description: string): AuditResult {
  const findings: Finding[] = [];
  applyDescriptionHints(findings, description.trim(), "unknown", "your platform");

  if (findings.length === 0) {
    pushFinding(findings, {
      id: "desc-generic",
      title: "Describe what is broken for a sharper split",
      detail:
        "With only a short note and no live page, we keep the free preview honest and small.",
      bucket: "needs_decision",
      reason:
        "Paste a URL for automated checks, or list concrete problems (titles, images, contact, builder limits).",
    });
  }

  const counts = countBuckets(findings);
  return {
    ok: true,
    inputUrl: null,
    finalUrl: null,
    platform: "unknown",
    platformLabel: "Custom / unknown platform",
    fetchOk: false,
    fetchNote: "No URL provided — audited from your description only.",
    descriptionUsed: true,
    findings,
    counts,
    summary: buildSummary(counts, "your platform", false),
  };
}

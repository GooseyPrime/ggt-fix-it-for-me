import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditFromDescriptionOnly, auditFromHtml } from "@/lib/audit";

const fixtures = join(process.cwd(), "fixtures");

describe("auditFromHtml", () => {
  it("splits a sparse Wix page into buckets without inventing facts", () => {
    const html = readFileSync(join(fixtures, "wix-sparse.html"), "utf8");
    const result = auditFromHtml({
      html,
      host: "myshop.wixsite.com",
      inputUrl: "https://myshop.wixsite.com",
      finalUrl: "https://myshop.wixsite.com",
      fetchOk: true,
    });
    expect(result.ok).toBe(true);
    expect(result.platform).toBe("wix");
    expect(result.counts.not_possible).toBeGreaterThan(0);
    expect(result.findings.every((f) => f.reason.length > 0)).toBe(true);
  });

  it("does not invent platform locks on a solid custom page", () => {
    const html = readFileSync(join(fixtures, "custom-ok.html"), "utf8");
    const result = auditFromHtml({
      html,
      host: "riverdalebakery.example",
      inputUrl: "https://riverdalebakery.example",
      finalUrl: "https://riverdalebakery.example",
      fetchOk: true,
    });
    expect(result.ok).toBe(true);
    expect(result.platform).toBe("unknown");
    expect(result.findings.some((f) => f.id === "platform-headers")).toBe(false);
  });
});

describe("auditFromDescriptionOnly", () => {
  it("keeps description-only audits honest", () => {
    const result = auditFromDescriptionOnly(
      "Our Wix site has no alt text and we cannot change the header CSS",
    );
    expect(result.ok).toBe(true);
    expect(result.fetchOk).toBe(false);
    expect(
      result.counts.needs_decision + result.counts.not_possible + result.counts.included,
    ).toBeGreaterThan(0);
  });
});

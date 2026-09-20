import { fetchPage } from "./fetch-page";
import { normalizeUrl } from "./normalize-url";
import { auditFromDescriptionOnly, auditFromHtml } from "./audit-html";
import type { AuditError, AuditInput, AuditResult } from "./types";

export { auditFromDescriptionOnly, auditFromHtml } from "./audit-html";

export async function runAudit(input: AuditInput): Promise<AuditResult | AuditError> {
  const urlRaw = (input.url ?? "").trim();
  const description = (input.description ?? "").trim();

  if (!urlRaw && !description) {
    return {
      ok: false,
      message: "Paste a website address, or describe what is wrong.",
    };
  }

  if (!urlRaw) {
    return auditFromDescriptionOnly(description);
  }

  const normalized = normalizeUrl(urlRaw);
  if (!normalized.href || !normalized.host) {
    if (description) return auditFromDescriptionOnly(description);
    return { ok: false, message: normalized.error ?? "Enter a website address." };
  }

  const fetched = await fetchPage(normalized.href);
  if (!fetched.ok || !fetched.html) {
    if (description) {
      const fromDesc = auditFromDescriptionOnly(description);
      return {
        ...fromDesc,
        inputUrl: normalized.href,
        finalUrl: fetched.finalUrl,
        fetchNote: fetched.error ?? fromDesc.fetchNote,
      };
    }
    return {
      ok: false,
      message: fetched.error ?? "Could not reach that website.",
    };
  }

  let host = normalized.host;
  if (fetched.finalUrl) {
    try {
      host = new URL(fetched.finalUrl).hostname;
    } catch {
      /* keep */
    }
  }

  return auditFromHtml({
    html: fetched.html,
    host,
    inputUrl: normalized.href,
    finalUrl: fetched.finalUrl,
    description,
    fetchOk: true,
    fetchNote: fetched.note ?? normalized.note,
  });
}

import { isBlockedHost, normalizeUrl } from "./normalize-url";

const FETCH_MS = 10000;
const UA = "GoldenGooseTools-FixItForMe/0.1 (+https://www.goldengoosetools.com)";
const MAX_BYTES = 1_500_000;

export type FetchedPage = {
  ok: boolean;
  finalUrl: string | null;
  html: string | null;
  error?: string;
  note?: string;
};

export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized.href || !normalized.host) {
    return { ok: false, finalUrl: null, html: null, error: normalized.error ?? "Enter a website address." };
  }

  try {
    const res = await fetch(normalized.href, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(FETCH_MS),
    });

    const finalUrl = res.url || normalized.href;
    let finalHost: string;
    try {
      finalHost = new URL(finalUrl).hostname;
    } catch {
      return { ok: false, finalUrl: null, html: null, error: "That address cannot be checked from this tool." };
    }

    if (isBlockedHost(finalHost)) {
      return { ok: false, finalUrl: null, html: null, error: "That address cannot be checked from this tool." };
    }

    if (!res.ok) {
      return {
        ok: false,
        finalUrl,
        html: null,
        error: `The site responded with ${res.status}. Try again, or confirm the address.`,
        note: normalized.note,
      };
    }

    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain/i.test(type)) {
      return {
        ok: false,
        finalUrl,
        html: null,
        error: "That address did not return a web page.",
        note: normalized.note,
      };
    }

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    return {
      ok: true,
      finalUrl,
      html,
      note: normalized.note,
    };
  } catch {
    return {
      ok: false,
      finalUrl: normalized.href,
      html: null,
      error: "Could not reach that website. Check the address and try again.",
      note: normalized.note,
    };
  }
}

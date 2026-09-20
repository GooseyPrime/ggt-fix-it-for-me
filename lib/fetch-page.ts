import { lookup } from "node:dns/promises";
import { isBlockedAddress, isBlockedHost, normalizeUrl } from "./normalize-url";

const FETCH_MS = 10000;
const UA = "GoldenGooseTools-FixItForMe/0.1 (+https://www.goldengoosetools.com)";
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;
const BLOCKED_ERROR = "That address cannot be checked from this tool.";

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
    const { res, finalUrl } = await fetchWithValidatedRedirects(normalized.href);

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

    const html = await readLimitedText(res);

    return {
      ok: true,
      finalUrl,
      html,
      note: normalized.note,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false,
      finalUrl: normalized.href,
      html: null,
      error: message === BLOCKED_ERROR ? BLOCKED_ERROR : "Could not reach that website. Check the address and try again.",
      note: normalized.note,
    };
  }
}

async function fetchWithValidatedRedirects(
  inputUrl: string,
): Promise<{ res: Response; finalUrl: string }> {
  let currentUrl = inputUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeDestination(currentUrl);

    const res = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(FETCH_MS),
    });

    if (!isRedirect(res.status)) {
      return { res, finalUrl: currentUrl };
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new Error("too_many_redirects");
    }

    const location = res.headers.get("location");
    if (!location) {
      throw new Error("invalid_redirect");
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
      throw new Error("invalid_redirect");
    }
    currentUrl = nextUrl.toString();
  }

  throw new Error("too_many_redirects");
}

async function assertSafeDestination(inputUrl: string) {
  const url = new URL(inputUrl);
  const host = url.hostname;
  if (isBlockedHost(host)) {
    throw new Error(BLOCKED_ERROR);
  }

  const resolved = await lookup(host, { all: true, verbatim: true });
  if (resolved.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error(BLOCKED_ERROR);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readLimitedText(res: Response): Promise<string> {
  if (!res.body) {
    return "";
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const remaining = MAX_BYTES - total;
      if (remaining <= 0) {
        await reader.cancel();
        break;
      }

      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        total += remaining;
        await reader.cancel();
        break;
      }

      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = trimIncompleteUtf8(joinChunks(chunks, total));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function joinChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const joined = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return joined;
}

function trimIncompleteUtf8(bytes: Uint8Array): Uint8Array {
  let start = bytes.length - 1;
  while (start >= 0 && isContinuationByte(bytes[start])) {
    start -= 1;
  }

  if (start < 0) return new Uint8Array();

  const expectedLength = utf8SequenceLength(bytes[start]);
  if (expectedLength === 0) return bytes.slice(0, start);
  if (expectedLength === 1) return bytes;

  const actualLength = bytes.length - start;
  if (actualLength < expectedLength) {
    return bytes.slice(0, start);
  }
  return bytes;
}

function utf8SequenceLength(byte: number): number {
  if ((byte & 0b1000_0000) === 0) return 1;
  if ((byte & 0b1110_0000) === 0b1100_0000) return 2;
  if ((byte & 0b1111_0000) === 0b1110_0000) return 3;
  if ((byte & 0b1111_1000) === 0b1111_0000) return 4;
  return 0;
}

function isContinuationByte(byte: number): boolean {
  return (byte & 0b1100_0000) === 0b1000_0000;
}

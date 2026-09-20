const SCHEME = /^(https?:\/\/)/i;
const DOMAIN =
  /(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])+){1,}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?/i;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

export type NormalizedUrl = {
  href: string | null;
  host: string | null;
  note?: string;
  error?: string;
};

export function canonicalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, "");
}

export function extractUrlCandidate(raw: string): string {
  const stripped = stripWrappedText(raw);
  if (!stripped) return "";
  const match = stripped.match(DOMAIN);
  if (match?.[0]) return match[0];
  const firstToken = firstWhitespaceToken(stripped);
  return trimTrailingPunctuation(firstToken);
}

export function isBlockedHost(host: string): boolean {
  const h = canonicalizeHost(host);
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (isPrivateIpv4(h) || isPrivateIpv6(h)) return true;
  return false;
}

export function isBlockedAddress(address: string): boolean {
  return isPrivateIpv4(address) || isPrivateIpv6(address);
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = canonicalizeHost(host);
  if (normalized === "::1") return true;
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  const first = normalized.split(":")[0];
  if (!first || !/^[\da-f]{1,4}$/i.test(first)) return false;
  const value = Number.parseInt(first, 16);
  if (!Number.isFinite(value)) return false;
  if ((value & 0xfe00) === 0xfc00) return true;
  if ((value & 0xffc0) === 0xfe80) return true;
  return false;
}

export function normalizeUrl(raw: string): NormalizedUrl {
  const candidate = extractUrlCandidate(raw);
  if (!candidate) {
    return { href: null, host: null, error: "Enter a website address." };
  }

  let working = trimTrailingPunctuation(candidate);
  if (!SCHEME.test(working)) working = `https://${working}`;

  let parsed: URL;
  try {
    parsed = new URL(working);
  } catch {
    return {
      href: null,
      host: null,
      error: "That does not look like a website address. Try yourbusiness.com.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { href: null, host: null, error: "Use an http or https website address." };
  }

  if (!parsed.hostname.includes(".")) {
    return {
      href: null,
      host: null,
      error: "That does not look like a website address. Try yourbusiness.com.",
    };
  }

  const host = canonicalizeHost(parsed.hostname);
  if (isBlockedHost(host)) {
    return { href: null, host: null, error: "That address cannot be checked from this tool." };
  }

  parsed.hostname = host;
  parsed.hash = "";
  const href = parsed.toString();
  const note =
    candidate !== raw.trim() ? "Extra words around the address were ignored." : undefined;

  return { href, host, note };
}

function trimTrailingPunctuation(value: string): string {
  let end = value.length;
  while (end > 0 && ",.;:!?)".includes(value[end - 1] ?? "")) {
    end -= 1;
  }
  return value.slice(0, end);
}

function firstWhitespaceToken(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (
      code === 9 ||
      code === 10 ||
      code === 11 ||
      code === 12 ||
      code === 13 ||
      code === 32
    ) {
      return value.slice(0, index);
    }
  }
  return value;
}

function stripWrappedText(raw: string): string {
  const normalized = raw.split("\u00a0").join(" ");
  let start = 0;
  let end = normalized.length;

  while (start < end && isWrapperChar(normalized.charCodeAt(start), true)) {
    start += 1;
  }
  while (end > start && isWrapperChar(normalized.charCodeAt(end - 1), false)) {
    end -= 1;
  }

  return normalized.slice(start, end).trim();
}

function isWrapperChar(code: number, opening: boolean): boolean {
  if (code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32) {
    return true;
  }
  if (opening) {
    return code === 60 || code === 34 || code === 39 || code === 91;
  }
  return code === 62 || code === 34 || code === 39 || code === 93;
}

import { describe, expect, it } from "vitest";
import { isBlockedHost, normalizeUrl } from "@/lib/normalize-url";

describe("normalizeUrl", () => {
  it("adds https", () => {
    const n = normalizeUrl("example.com");
    expect(n.href).toMatch(/^https:\/\/example\.com\/?/);
    expect(n.host).toBe("example.com");
  });

  it("blocks private hosts", () => {
    expect(normalizeUrl("http://127.0.0.1/").error).toBeTruthy();
    expect(normalizeUrl("http://localhost/").error).toBeTruthy();
    expect(normalizeUrl("http://127.0.0.1./").error).toBeTruthy();
    expect(normalizeUrl("https://metadata.google.internal./").error).toBeTruthy();
    expect(isBlockedHost("192.168.1.1")).toBe(true);
    expect(isBlockedHost("10.0.0.5")).toBe(true);
    expect(isBlockedHost("::1")).toBe(true);
    expect(isBlockedHost("fc00::1")).toBe(true);
    expect(isBlockedHost("fe80::1")).toBe(true);
  });
});

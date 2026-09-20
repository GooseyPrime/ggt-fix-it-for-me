import { afterEach, describe, expect, it, vi } from "vitest";

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}));

import { fetchPage } from "@/lib/fetch-page";

afterEach(() => {
  lookupMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchPage", () => {
  it("blocks redirects to private destinations before following them", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPage("https://example.com");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("That address cannot be checked from this tool.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops reading once the response limit is reached", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    let cancelled = false;
    const chunk = new TextEncoder().encode("a".repeat(900_000));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );

    const result = await fetchPage("https://example.com");

    expect(result.ok).toBe(true);
    expect(result.html?.length).toBeGreaterThan(0);
    expect(result.html?.length).toBeLessThan(1_800_000);
    expect(cancelled).toBe(true);
  });
});

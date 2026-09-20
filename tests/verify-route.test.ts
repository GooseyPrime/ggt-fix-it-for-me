import { afterEach, describe, expect, it, vi } from "vitest";

const { verifySaleMock } = vi.hoisted(() => ({
  verifySaleMock: vi.fn(),
}));

vi.mock("@/lib/payments", () => ({
  verifySale: verifySaleMock,
}));

import { GET, POST } from "@/app/api/verify/route";

afterEach(() => {
  verifySaleMock.mockReset();
});

describe("/api/verify", () => {
  it("returns 200 for ordinary unpaid verification results", async () => {
    verifySaleMock.mockResolvedValue({ ok: false, paid: false, kind: "unpaid" });

    const response = await GET(new Request("https://tool.example/api/verify?session_id=sess_123"));

    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid verification requests", async () => {
    verifySaleMock.mockResolvedValue({ ok: false, paid: false, kind: "invalid_request" });

    const response = await POST(
      new Request("https://tool.example/api/verify", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { publicBasePath } from "@/lib/config";

const ORIGINAL = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
});

describe("publicBasePath", () => {
  it("normalizes the configured base path to an absolute app-relative path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "tools/fix-it/";
    expect(publicBasePath()).toBe("/tools/fix-it");
  });
});

import type { NextConfig } from "next";

/**
 * Served on the shop at goldengoosetools.com/tools/fix-it
 * (the shop proxies this deployment under the same path).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/tools/fix-it";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  reactStrictMode: true,
};

export default nextConfig;

import type { NextConfig } from "next";
import { normalizeBasePath } from "./lib/config";

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
};

export default nextConfig;

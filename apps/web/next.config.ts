import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../",
  ),
};

export default nextConfig;

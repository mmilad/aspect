import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@projectplaner/core", "@projectplaner/db"],
  outputFileTracingRoot: path.join(process.cwd(), "../..")
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  distDir: process.env.PROJECTPLANER_NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@projectplaner/core", "@projectplaner/db", "@projectplaner/workspace"],
  outputFileTracingRoot: path.join(process.cwd(), "../..")
};

export default nextConfig;

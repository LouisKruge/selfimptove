import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  typedRoutes: false,
  experimental: {
    optimizePackageImports: [],
  },
};

export default nextConfig;

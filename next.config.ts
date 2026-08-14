import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The libSQL client ships optional native bindings for local file access.
  // Keeping it external stops the bundler from trying to trace them.
  serverExternalPackages: ["@libsql/client", "libsql"],
  typedRoutes: false,
};

export default nextConfig;

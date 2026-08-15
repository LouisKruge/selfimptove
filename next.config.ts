import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The libSQL client ships optional native bindings for local file access.
  // Keeping it external stops the bundler from trying to trace them.
  serverExternalPackages: ["@libsql/client", "libsql"],
  typedRoutes: false,
  experimental: {
    // Free-text fields are uncapped, so the transport must not be the new
    // limit. The default 1MB would reject a long reflection or a pasted
    // document with an error that says nothing about length.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@imprint/content-core"],
  // Native/dynamic-require packages the server should load from node_modules.
  serverExternalPackages: ["mysql2"],
};

export default nextConfig;

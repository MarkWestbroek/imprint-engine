import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@imprint/content-core", "@imprint/extension-api"],
  // Native/dynamic-require database drivers the server loads from node_modules.
  serverExternalPackages: ["mysql2", "pg"],
};

export default nextConfig;

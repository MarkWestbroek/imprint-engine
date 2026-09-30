import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@imprint/content-core",
    "@imprint/extension-api",
    "@imprint/runtime-admin",
    "@imprint/widgets-standard",
    "@imprint/plugin-wiki",
    "@imprint/plugin-glossary",
    "@imprint/plugin-groups",
  ],
  // Loaded by Node from node_modules, not bundled: the database drivers
  // (native/dynamic require) and exifr, which imports fs/zlib dynamically
  // ("Couldn't load fs" when bundled). sharp is on Next's own list already.
  serverExternalPackages: ["mysql2", "pg", "exifr"],
  // Container build (Dockerfile sets NEXT_OUTPUT): a self-contained server in
  // .next/standalone. Opt-in, so local builds and `next start` stay as they were.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Trace from the monorepo root, so the workspace packages end up in the output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@imprint/content-core", "@imprint/extension-api", "@imprint/runtime-admin", "@imprint/widgets-standard"],
  // Native/dynamic-require database drivers the server loads from node_modules.
  serverExternalPackages: ["mysql2", "pg"],
  // Container build (Dockerfile sets NEXT_OUTPUT): a self-contained server in
  // .next/standalone. Opt-in, so local builds and `next start` stay as they were.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // The browser tests in dev mode (e2e/serve.ts) build into their own folder,
  // so they can run next to a `next dev` that holds the lock on .next/dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The dev indicator sits on top of the sign-out button; the tests click there.
  devIndicators: process.env.NEXT_DIST_DIR ? false : undefined,
  // Trace from the monorepo root, so the workspace packages end up in the output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import mysql from "mysql2/promise";

import { DATABASE_URL, INGEST_TOKEN, PORT, USERS } from "./env";

/**
 * What Playwright starts as its web server (playwright.config.ts): a fresh
 * database, a production build against it, and `next start`. Production mode
 * on purpose — it is what visitors get, and it does not share a cache with a
 * `next dev` that may be running (that one lives in .next/dev).
 *
 *   E2E_SKIP_BUILD=1   reuse the last build (only the specs changed)
 *   E2E_MODE=dev       `next dev` instead. Slower per page, but React only
 *                      reports hydration mismatches and non-plain client props
 *                      in development — a production build stays silent about
 *                      them. Uses its own folder (.next-e2e), so it runs next
 *                      to the `next dev` you are working in.
 *
 * Content goes in through the seed script and users through the user CLI, so
 * through the stores — never raw SQL (CLAUDE.md); only the reset drops tables.
 */
const site = path.resolve(import.meta.dirname, "..");
const root = path.resolve(site, "../..");

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL,
  SESSION_SECRET: "e2e-session-secret-not-used-anywhere-else",
  INGEST_TOKEN,
  SEED_ADMIN_USER: USERS.admin.name,
  SEED_ADMIN_PASSWORD: USERS.admin.password,
};

function run(cwd: string, command: string, args: string[]): void {
  console.log(`[e2e] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function resetDatabase(): Promise<void> {
  const db = await mysql.createConnection(DATABASE_URL);
  for (const table of ["content_items", "users", "__drizzle_migrations"]) {
    await db.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
  await db.end();
}

async function main() {
  await resetDatabase();
  run(root, "npx", ["drizzle-kit", "migrate"]);
  run(root, "npx", ["tsx", "scripts/seed.ts"]);
  for (const user of [USERS.editor, USERS.reader]) {
    run(root, "npx", ["tsx", "scripts/user.ts", "add", user.name, user.role, user.password]);
  }
  const dev = process.env.E2E_MODE === "dev";
  if (dev) env.NEXT_DIST_DIR = ".next-e2e";
  else if (!process.env.E2E_SKIP_BUILD) run(site, "npx", ["next", "build"]);

  const server = spawn("npx", ["next", dev ? "dev" : "start", "--port", String(PORT)], {
    cwd: site,
    env,
    stdio: "inherit",
    shell: true,
  });
  server.on("exit", (code) => process.exit(code ?? 0));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.kill());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

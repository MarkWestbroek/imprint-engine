import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Postgres dialect — own schema file and own migration journal (drizzle-pg/),
 * next to the MariaDB one in drizzle.config.ts / drizzle/. Use with
 * `npm run db:generate:pg` / `npm run db:migrate:pg`; the URL comes from
 * DATABASE_URL when that is a postgres:// URL, else the local compose service.
 */
const envUrl = process.env.DATABASE_URL;
const url =
  envUrl && /^postgres(ql)?:/.test(envUrl)
    ? envUrl
    : "postgres://imprint:imprint-dev@localhost:5433/imprint";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/content-core/src/db-schema.pg.ts",
  out: "./drizzle-pg",
  dbCredentials: { url },
});

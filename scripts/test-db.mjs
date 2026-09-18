import { spawnSync } from "node:child_process";

/**
 * `npm run test:db` — the whole test suite, database backends included,
 * against the throwaway databases of `npm run db:up`. Set TEST_DATABASE_URL
 * or TEST_PG_DATABASE_URL yourself to point elsewhere. A script rather than
 * inline `VAR=… npm test`, because npm runs scripts through cmd.exe on Windows.
 */
const env = {
  ...process.env,
  TEST_DATABASE_URL:
    process.env.TEST_DATABASE_URL || "mysql://imprint:imprint-dev@localhost:3306/imprint_test",
  TEST_PG_DATABASE_URL:
    process.env.TEST_PG_DATABASE_URL || "postgres://imprint:imprint-dev@localhost:5434/imprint_test",
};

const result = spawnSync("npm", ["test"], { stdio: "inherit", env, shell: true });
process.exit(result.status ?? 1);

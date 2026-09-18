import { spawnSync } from "node:child_process";

// `npm run test:e2e:dev` — the same specs against `next dev` (see e2e/serve.ts).
// A script, because npm runs `VAR=… command` through cmd.exe on Windows.
const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, E2E_MODE: "dev" },
});
process.exit(result.status ?? 1);

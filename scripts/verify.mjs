#!/usr/bin/env node
/**
 * verify — the same checks as CI (.github/workflows/ci.yml), for what changed.
 *
 *   npm run verify                      what changed against origin/main (committed, staged, unstaged, new files)
 *   npm run verify -- --base=main       against another base
 *   npm run verify -- --all             everything: every package and every site
 *   npm run verify -- --site=paratmos   one site: typecheck, lint, test and build (CI's per-site job)
 *   npm run verify -- --packages        the engine packages: boundaries, typecheck, lint, test (CI's packages job)
 *   npm run verify -- --list            only say what would run (CI reads this as JSON with --json)
 *
 * What "changed" means: a change in packages/ or in the root's package files
 * (package.json, package-lock.json, tsconfig*) touches every site, because
 * every site renders with the packages. A change in sites/<name>/ touches
 * that site. Docs and deploy files touch nothing here (CI checks the deploy
 * files separately, in seconds).
 *
 * Builds run without DATABASE_URL, on the content in git (file store), as in CI.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const SITES = readdirSync(path.join(root, "sites"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(root, "sites", d.name, "package.json")))
  .map((d) => d.name)
  .sort();
const PACKAGES = readdirSync(path.join(root, "packages"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(root, "packages", d.name, "package.json")))
  .map((d) => d.name)
  .sort();

/** Files that touch every site when they change. */
const SHARED = [/^packages\//, /^package(-lock)?\.json$/, /^tsconfig[^/]*\.json$/, /^scripts\/check-boundaries\.mjs$/];

function git(...a) {
  return execFileSync("git", a, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
}

/** Changed files: against the base, plus what is not committed yet. */
function changedFiles(base) {
  const files = new Set([
    ...git("diff", "--name-only", `${base}...HEAD`),
    ...git("diff", "--name-only", "HEAD"),
    ...git("ls-files", "--others", "--exclude-standard"),
  ]);
  return [...files].map((f) => f.replace(/\\/g, "/"));
}

/**
 * What to check: the packages, which sites, and whether the browser tests
 * (they test the admin through MusicBrain) are needed.
 */
export function plan(files) {
  const shared = files.some((f) => SHARED.some((re) => re.test(f)));
  const sites = shared ? SITES : SITES.filter((s) => files.some((f) => f.startsWith(`sites/${s}/`)));
  return { packages: shared, sites, e2e: shared || sites.includes("musicbrain") };
}

function run(label, cmd, cmdArgs) {
  const started = Date.now();
  process.stdout.write(`\n── ${label}\n`);
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  const secs = Math.round((Date.now() - started) / 1000);
  if (r.status !== 0) {
    console.error(`\n✗ ${label} (${secs}s)`);
    process.exit(r.status ?? 1);
  }
  console.log(`✓ ${label} (${secs}s)`);
}

/** npm's script in one workspace, if that workspace has it. */
const ws = (dir, script) => ["npm", ["run", script, `--workspace=${dir}`, "--if-present"]];

function checkPackages() {
  run("package boundaries", "node", ["scripts/check-boundaries.mjs"]);
  for (const script of ["typecheck", "lint", "test"]) {
    for (const p of PACKAGES) run(`${script} packages/${p}`, ...ws(`packages/${p}`, script));
  }
}

function checkSite(site) {
  if (!SITES.includes(site)) {
    console.error(`No site "${site}" (there are: ${SITES.join(", ")})`);
    process.exit(2);
  }
  for (const script of ["typecheck", "lint", "test", "build"]) run(`${script} sites/${site}`, ...ws(`sites/${site}`, script));
}

let todo;
if (value("site")) todo = { packages: false, sites: [value("site")], e2e: false };
else if (flag("packages")) todo = { packages: true, sites: [], e2e: false };
else if (flag("all")) todo = { packages: true, sites: SITES, e2e: true };
else todo = plan(changedFiles(value("base") ?? "origin/main"));

if (flag("list")) {
  if (flag("json")) console.log(JSON.stringify(todo));
  else console.log(`packages: ${todo.packages ? "yes" : "no"}\nsites: ${todo.sites.join(", ") || "none"}\nbrowser tests (CI only): ${todo.e2e ? "yes" : "no"}`);
  process.exit(0);
}

const started = Date.now();
if (!todo.packages && todo.sites.length === 0) console.log("Nothing to check: no package or site changed (docs and deploy files only).");
if (todo.packages) checkPackages();
for (const site of todo.sites) checkSite(site);
console.log(`\nAll green in ${Math.round((Date.now() - started) / 1000)}s.`);

#!/usr/bin/env node
/**
 * Package-boundary check (revisievoorstel §9, Fase 6 hardening): engine
 * packages must never depend on a site, and the framework-free packages must
 * stay free of React and Next. Runs before the unit suites (`npm test`); a
 * violation names the file and the import.
 *
 *   packages/*      may not import "@/…", "sites/…" or "../sites/…"
 *   content-core    may not import react, next or zod-free? (no: zod is fine)
 *   extension-api   may not import react or next
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const FRAMEWORK_FREE = ["content-core", "extension-api"];
const IMPORT_RE = /(?:from|import)\s+["']([^"']+)["']/g;

async function* files(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(p);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) yield p;
  }
}

const problems = [];
for (const pkg of await fs.readdir(path.join(root, "packages"))) {
  const src = path.join(root, "packages", pkg, "src");
  try {
    await fs.access(src);
  } catch {
    continue;
  }
  for await (const file of files(src)) {
    const text = await fs.readFile(file, "utf8");
    for (const [, spec] of text.matchAll(IMPORT_RE)) {
      const rel = path.relative(root, file);
      if (spec.startsWith("@/") || spec.startsWith("sites/") || spec.includes("/sites/")) {
        problems.push(`${rel}: imports a site ("${spec}")`);
      }
      if (FRAMEWORK_FREE.includes(pkg) && /^(react|react-dom|next)(\/|$)/.test(spec)) {
        problems.push(`${rel}: ${pkg} is framework-free but imports "${spec}"`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error("Package boundaries violated:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("package boundaries ok");

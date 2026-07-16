#!/usr/bin/env node
/**
 * Release-ritueel voor de Imprint-engine. Eén commando:
 *
 *   npm run release -- 0.8.0
 *
 * Doet: package-versies bumpen (root + beide workspaces), de CHANGELOG
 * [Unreleased]-notities onder een nieuwe versiekop schuiven, de lockfile
 * bijwerken, committen en een geannoteerde tag zetten. Pusht NIET — je
 * reviewt eerst, dan `git push origin main --follow-tags`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const version = process.argv[2]?.replace(/^v/, "");
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Gebruik: npm run release -- <major.minor.patch>   (bijv. 0.8.0)");
  process.exit(1);
}
const tag = `v${version}`;
const run = (cmd) => execSync(cmd, { stdio: "pipe" }).toString().trim();

// Schone werkboom vereist (anders sleep je onbedoelde wijzigingen mee).
if (run("git status --porcelain")) {
  console.error("Werkboom is niet schoon — commit of stash eerst.");
  process.exit(1);
}
try {
  run(`git rev-parse ${tag}`);
  console.error(`Tag ${tag} bestaat al.`);
  process.exit(1);
} catch {
  /* tag bestaat nog niet — goed */
}

// 1. package-versies gelijktrekken.
const pkgs = [
  "package.json",
  "packages/content-core/package.json",
  "sites/musicbrain/package.json",
];
for (const file of pkgs) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  pkg.version = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}

// 2. CHANGELOG: [Unreleased]-inhoud onder een nieuwe versiekop schuiven.
const changelogPath = "CHANGELOG.md";
const changelog = readFileSync(changelogPath, "utf8");
if (!changelog.includes("## [Unreleased]")) {
  console.error("CHANGELOG.md mist de '## [Unreleased]'-sectie.");
  process.exit(1);
}
const date = new Date().toISOString().slice(0, 10);
// CRLF-tolerant (Windows-checkouts): match beide regeleindes en behoud de stijl.
const rolled = changelog.replace(
  /## \[Unreleased\](\r?\n)/,
  `## [Unreleased]$1$1## [${version}] - ${date}$1`
);
if (rolled === changelog) {
  console.error("CHANGELOG-rollover mislukt (patroon niet gevonden) — niets gewijzigd.");
  process.exit(1);
}
writeFileSync(changelogPath, rolled);

// 3. Lockfile bijwerken, committen, taggen.
execSync("npm install --package-lock-only", { stdio: "inherit" });
run("git add -A");
run(`git commit -m "Release ${tag}"`);
run(`git tag -a ${tag} -m "${tag}"`);

console.log(`\n✓ ${tag} gecommit en getagd.`);
console.log("  Controleer de CHANGELOG-notities, en push dan:");
console.log("    git push origin main --follow-tags");

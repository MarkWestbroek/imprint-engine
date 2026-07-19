import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

/**
 * Asset-GC (backlog §3): content-hashing laat bij elke herpublicatie oude
 * bestanden achter. Dit script verwijdert alleen échte wezen: bestanden
 * waar geen enkele rij in content_items naar verwijst — ook de historische
 * niet, want oude versies (History, time travel) moeten hun assets houden.
 *
 *   node scripts/assets-gc.mjs             # dry-run: toont wat weg zou mogen
 *   node scripts/assets-gc.mjs --delete    # verwijdert echt
 *
 * Bestanden jonger dan een dag blijven altijd staan (een ingest kan bezig
 * zijn: bestand al geschreven, rij nog niet).
 */

const doDelete = process.argv.includes("--delete");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ontbreekt (.env).");
  process.exit(1);
}
const assetRoot =
  process.env.ASSET_ROOT || path.join(process.cwd(), "sites", "musicbrain", ".assets");
const urlBase = process.env.ASSET_BASE_URL || "/api/assets";
if (!fs.existsSync(assetRoot)) {
  console.error(`Geen asset-map op ${assetRoot} — niets te doen.`);
  process.exit(0);
}

// Alle asset-URLs uit ALLE rijen (volledige bitemporale historie).
const conn = await mysql.createConnection(url);
const [rows] = await conn.query("SELECT data FROM content_items");
await conn.end();
const referenced = new Set();
const re = new RegExp(`${urlBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^"'\\\\ )]+`, "g");
for (const row of rows) {
  const text = typeof row.data === "string" ? row.data : JSON.stringify(row.data);
  for (const m of text.match(re) ?? []) referenced.add(decodeURIComponent(m));
}

// Alle bestanden op schijf.
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(assetRoot);

const dayAgo = Date.now() - 24 * 3600 * 1000;
let orphanBytes = 0;
const orphans = [];
for (const file of files) {
  const rel = path.relative(assetRoot, file).split(path.sep).join("/");
  if (referenced.has(`${urlBase}/${rel}`)) continue;
  const stat = fs.statSync(file);
  if (stat.mtimeMs > dayAgo) continue; // mogelijk ingest-in-vlucht
  orphans.push(rel);
  orphanBytes += stat.size;
}

console.log(
  `${files.length} bestanden, ${referenced.size} gerefereerde URLs, ` +
    `${orphans.length} wezen (${(orphanBytes / 1024 / 1024).toFixed(1)} MB)`
);
for (const rel of orphans) {
  if (doDelete) {
    fs.rmSync(path.join(assetRoot, rel));
    console.log(`  ✗ verwijderd: ${rel}`);
  } else {
    console.log(`  wees: ${rel}`);
  }
}
if (!doDelete && orphans.length > 0) {
  console.log("\nDry-run — draai met --delete om echt op te ruimen.");
}

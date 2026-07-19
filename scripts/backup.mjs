import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

/**
 * Backup van de content-database + assets (backlog §6). Node-only — geen
 * mysqldump nodig, dus hij draait overal waar de app draait (ook Plesk
 * zonder SSH, via een Scheduled Task: `cd imprint && npm run backup`).
 *
 * Maakt backups/<timestamp>/ met:
 *   content_items.jsonl  — elke rij (volledige bitemporale historie)
 *   users.jsonl          — accounts incl. wachtwoordhashes
 *   assets.tgz           — de AssetStore-map (of assets/ als kopie zonder tar)
 *   manifest.json        — aantallen + herkomst, voor de restore-sanity-check
 *
 * Retentie: de nieuwste 14 backups blijven staan. Terugzetten: zie
 * docs/backups.md.
 *
 *   node scripts/backup.mjs [--dest=<map>] [--keep=<n>]
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ontbreekt (.env) — niets te back-uppen.");
  process.exit(1);
}
const destRoot = path.resolve(args.dest ?? process.env.BACKUP_DIR ?? "backups");
const keep = Number(args.keep ?? 14);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(destRoot, stamp);
fs.mkdirSync(dest, { recursive: true });

const conn = await mysql.createConnection(url);
const manifest = { at: new Date().toISOString(), tables: {}, assets: null };

for (const table of ["content_items", "users"]) {
  const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
  const file = path.join(dest, `${table}.jsonl`);
  const out = fs.createWriteStream(file);
  for (const row of rows) out.write(JSON.stringify(row) + "\n");
  await new Promise((res) => out.end(res));
  manifest.tables[table] = rows.length;
  console.log(`✓ ${table}: ${rows.length} rijen → ${path.relative(process.cwd(), file)}`);
}
await conn.end();

// Assets: tar als het kan (compact), anders een kale kopie.
const assetRoot =
  process.env.ASSET_ROOT || path.join(process.cwd(), "sites", "musicbrain", ".assets");
if (fs.existsSync(assetRoot)) {
  try {
    // Relatief uitvoerpad + cwd: GNU tar leest "D:\…" anders als remote host.
    execFileSync("tar", ["czf", "assets.tgz", "-C", assetRoot, "."], { cwd: dest });
    manifest.assets = "assets.tgz";
  } catch {
    fs.cpSync(assetRoot, path.join(dest, "assets"), { recursive: true });
    manifest.assets = "assets/ (kopie; tar niet beschikbaar)";
  }
  console.log(`✓ assets (${assetRoot}) → ${manifest.assets}`);
} else {
  console.log(`- geen asset-map op ${assetRoot} (ASSET_ROOT niet gezet?) — overgeslagen`);
}

fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(manifest, null, 2));

// Retentie: nieuwste `keep` mappen blijven.
const all = fs
  .readdirSync(destRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .reverse();
for (const old of all.slice(keep)) {
  fs.rmSync(path.join(destRoot, old), { recursive: true, force: true });
  console.log(`✓ retentie: ${old} verwijderd (keep=${keep})`);
}

console.log(`\nBackup klaar: ${dest}`);

#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Componenten + board-specs van een draaiende site naar een andere kopiëren
 * (standaard: live → lokaal). Voor als je lokale database achterloopt: een
 * release die door de KiCad-toolkit lokaal wordt gepost verwijst naar
 * componentversies die alleen live bestaan — dan geeft /components/<slug>
 * een 404 en missen borden hun 3D-tab.
 *
 * Strikt eenrichtingsverkeer: van de bron worden alleen **GET**-calls gedaan
 * (de publieke read-API), schrijven gebeurt uitsluitend op het doel via
 * POST /api/content/<type>/<slug> met de lokale INGEST_TOKEN — dus via de
 * WritableContentStore, zodat de bitemporale historie klopt.
 *
 * Meegekopieerd worden ook de assets waar de specs naar wijzen
 * (/api/assets/<component>/<versie>/<bestand> → de lokale AssetStore).
 * Items die alleen op het doel bestaan blijven ongemoeid; identieke items
 * worden overgeslagen (geen lege nieuwe versie).
 *
 *   node scripts/sync-from-live.mjs [--from=https://musicbrain.nl]
 *                                   [--to=http://localhost:3000] [--dry]
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);

const FROM = (args.from ?? "https://musicbrain.nl").replace(/\/$/, "");
const TO = (args.to ?? "http://localhost:3000").replace(/\/$/, "");
const DRY = args.dry === "true";
const TOKEN = process.env.INGEST_TOKEN;
const ASSET_ROOT =
  process.env.ASSET_ROOT ||
  path.join(process.cwd(), "sites", "musicbrain", ".assets");
const ASSET_URL = process.env.ASSET_BASE_URL || "/api/assets";

if (!TOKEN && !DRY) {
  console.error("INGEST_TOKEN ontbreekt (.env) — nodig om op het doel te schrijven.");
  process.exit(1);
}
if (FROM === TO) {
  console.error("--from en --to zijn gelijk; niets te doen.");
  process.exit(1);
}

/** Sleutels sorteren zodat twee items vergelijkbaar zijn ongeacht volgorde. */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])])
    );
  }
  return value;
}
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

async function getJson(base, route) {
  const res = await fetch(`${base}${route}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${base}${route} → ${res.status}`);
  return res.json();
}

/** Alle asset-URL's uit een item (diep; strings die met /api/assets beginnen). */
function assetUrls(value, found = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith(`${ASSET_URL}/`)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) assetUrls(v, found);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) assetUrls(v, found);
  }
  return found;
}

/** Statische /boards/-verwijzingen (oude stijl) — die horen in git, niet hier. */
function staticRefs(value, found = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith("/boards/")) found.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) staticRefs(v, found);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) staticRefs(v, found);
  }
  return found;
}

async function downloadAsset(url) {
  const rel = url.slice(ASSET_URL.length + 1);
  const dest = path.join(ASSET_ROOT, rel);
  try {
    await fs.access(dest);
    return "aanwezig"; // hash zit in de bestandsnaam: zelfde naam = zelfde inhoud
  } catch {
    /* ophalen */
  }
  if (DRY) return "zou downloaden";
  const res = await fetch(`${FROM}${url}`);
  if (!res.ok) throw new Error(`GET ${FROM}${url} → ${res.status}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return "gedownload";
}

async function put(type, slug, data) {
  if (DRY) return;
  const res = await fetch(`${TO}/api/content/${type}/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST ${type}/${slug} → ${res.status}: ${body.slice(0, 300)}`);
  }
}

/**
 * Eén contenttype overzetten. Volgorde doet ertoe: componenten vóór
 * board-specs, want een spec verwijst naar zijn component (enforced).
 */
async function syncType({ type, listRoute, itemRoute }) {
  const items = (await getJson(FROM, listRoute)) ?? [];
  let nieuw = 0;
  let gewijzigd = 0;
  let gelijk = 0;
  const assets = { gedownload: 0, aanwezig: 0, "zou downloaden": 0 };
  const missendeStatics = new Set();

  for (const item of items) {
    for (const url of assetUrls(item)) {
      assets[await downloadAsset(url)]++;
    }
    for (const ref of staticRefs(item)) {
      const file = path.join(process.cwd(), "sites", "musicbrain", "public", ref);
      try {
        await fs.access(file);
      } catch {
        missendeStatics.add(ref);
      }
    }

    const local = await getJson(TO, `${itemRoute}/${encodeURIComponent(item.slug)}`);
    if (local && same(local, item)) {
      gelijk++;
      continue;
    }
    await put(type, item.slug, item);
    if (local) gewijzigd++;
    else nieuw++;
    console.log(`  ${local ? "bijgewerkt" : "nieuw     "}  ${item.slug}`);
  }

  console.log(
    `${type}: ${items.length} op de bron — ${nieuw} nieuw, ${gewijzigd} bijgewerkt, ${gelijk} ongewijzigd`
  );
  const a = Object.entries(assets).filter(([, n]) => n > 0);
  if (a.length) console.log(`  assets: ${a.map(([k, n]) => `${n} ${k}`).join(", ")}`);
  if (missendeStatics.size) {
    console.log(
      `  ⚠ verwijzingen naar public/ die hier ontbreken: ${[...missendeStatics].join(", ")}`
    );
  }
}

console.log(`Sync ${FROM} → ${TO}${DRY ? "  (dry-run)" : ""}`);
await syncType({
  type: "component",
  listRoute: "/api/content/components",
  itemRoute: "/api/content/components",
});
await syncType({
  type: "board-spec",
  listRoute: "/api/content/board-specs",
  itemRoute: "/api/content/board-specs",
});
console.log("Klaar. Items die alleen op het doel staan zijn niet aangeraakt.");

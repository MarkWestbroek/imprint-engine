import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Beelden } from "@imprint/plugin-taal/woorden";

/**
 * Pictures for "check a word": a Fluent Emoji (Microsoft, MIT) beside a
 * concrete word (de appel 🍎, zamek 🏰 🔒). Abstract words get none.
 *
 *   npx tsx --tsconfig tsconfig.test.json scripts/beelden-maken.ts <fluent-tree.json> <cldr-dir> <cache-dir>
 *
 *   - fluent-tree.json: the file list of github.com/microsoft/fluentui-emoji
 *     (`GET /repos/microsoft/fluentui-emoji/git/trees/main?recursive=1`);
 *   - cldr-dir: `cldr-nl.json` and `cldr-pl.json`, the emoji names of Unicode
 *     (cldr-json, cldr-annotations-full/annotations/<taal>/annotations.json);
 *   - cache-dir: where the metadata and the pictures are downloaded once.
 *
 * Unicode gives every emoji a name and keywords per language: 🍎 is "rode
 * appel" with the keyword "appel", and "czerwone jabłko" with "jabłko". A word
 * of a word list gets the emoji whose name it is; else the emoji whose keyword
 * it is, when at most two emoji have that keyword (more is a word like
 * "gebouw" or "voedsel", too wide to picture). A word may keep two pictures:
 * two meanings (bank 🏦 🛋, zamek 🏰 🔒).
 *
 * What the match gets wrong is corrected by hand in woorden/beelden-aanvullingen.json:
 * `weg` (no picture), `keuze` (exactly these emoji). Writes woorden/beelden.json
 * and copies the pictures used to public/beeld/<code>.svg.
 */

const [boomFile, cldrDir, cache] = process.argv.slice(2);
if (!boomFile || !cldrDir || !cache) throw new Error("usage: beelden-maken.ts <fluent-tree.json> <cldr-dir> <cache-dir>");
const SITE = path.resolve(import.meta.dirname, "..");
const PUBLIEK = path.join(SITE, "public", "beeld");
const RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/";
const TALEN = ["nl", "pl"] as const;
type Taal = (typeof TALEN)[number];

/** Groups of pictures that show a thing or an action; no faces, symbols or flags. */
const GROEPEN = new Set(["Food & Drink", "Animals & Nature", "Travel & Places", "Objects", "Activities", "People & Body"]);
/** At most this many emoji per keyword: more is too wide a word to picture. */
const MAX_PER_TREFWOORD = 2;

type Meta = { glyph: string; group: string; unicode: string; unicodeSkintones?: string[] };
type Emoji = { code: string; glyph: string; svg: string };

const aanvullingen = JSON.parse(readFileSync(path.join(SITE, "woorden", "beelden-aanvullingen.json"), "utf8")) as Record<
  Taal,
  { weg: string[]; keuze: Record<string, string[]> }
>;

/** Download once into the cache. */
async function haal(rel: string): Promise<string> {
  const doel = path.join(cache!, ...rel.split("/"));
  if (!existsSync(doel)) {
    const res = await fetch(RAW + rel.split("/").map(encodeURIComponent).join("/"));
    if (!res.ok) throw new Error(`${res.status} for ${rel}`);
    mkdirSync(path.dirname(doel), { recursive: true });
    writeFileSync(doel, Buffer.from(await res.arrayBuffer()));
  }
  return doel;
}

/** Run `taak` over `items`, `n` at a time. */
async function perStuk<T, U>(items: T[], n: number, taak: (x: T) => Promise<U>): Promise<U[]> {
  const uit: U[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const j = i++;
        uit[j] = await taak(items[j]!);
      }
    }),
  );
  return uit;
}

/** Every Fluent emoji with a flat picture, by its glyph (without the variation selector). */
async function emoji(): Promise<Map<string, Emoji>> {
  const boom = JSON.parse(readFileSync(boomFile!, "utf8")) as { tree: { path: string }[] };
  const paden = boom.tree.map((e) => e.path);
  const mappen = paden.filter((p) => /^assets\/[^/]+\/metadata\.json$/.test(p)).map((p) => p.split("/")[1]!);
  const vlak = (map: string) =>
    // An emoji with skin tones has its pictures per tone; the neutral one is "Default".
    paden.find((p) => p.startsWith(`assets/${map}/Flat/`) && p.endsWith(".svg")) ?? paden.find((p) => p.startsWith(`assets/${map}/Default/Flat/`) && p.endsWith(".svg"));
  const alle = await perStuk(mappen, 16, async (map) => {
    const meta = JSON.parse(readFileSync(await haal(`assets/${map}/metadata.json`), "utf8")) as Meta;
    const svg = vlak(map);
    return svg && GROEPEN.has(meta.group) ? { code: meta.unicode.replace(/ /g, "-"), glyph: meta.glyph.replace(/️/g, ""), svg } : null;
  });
  return new Map(alle.filter((e): e is Emoji => !!e).map((e) => [e.glyph, e]));
}

type Naam = { tts: string[]; trefwoorden: string[] };

/** word → the emoji it names (`tts`), and the emoji it is a keyword of. */
function index(taal: Taal, bekend: Map<string, Emoji>): { naam: Map<string, string[]>; trefwoord: Map<string, string[]> } {
  const cldr = JSON.parse(readFileSync(path.join(cldrDir!, `cldr-${taal}.json`), "utf8")) as { annotations: { annotations: Record<string, { default?: string[]; tts?: string[] }> } };
  const naam = new Map<string, string[]>();
  const trefwoord = new Map<string, string[]>();
  const voeg = (m: Map<string, string[]>, w: string, code: string) => {
    const k = w.toLowerCase().trim();
    const nu = m.get(k) ?? [];
    if (!nu.includes(code)) m.set(k, [...nu, code]);
  };
  for (const [glyph, a] of Object.entries(cldr.annotations.annotations)) {
    const e = bekend.get(glyph.replace(/️/g, ""));
    if (!e) continue;
    const n: Naam = { tts: a.tts ?? [], trefwoorden: a.default ?? [] };
    for (const t of n.tts) voeg(naam, t, e.code);
    for (const t of n.trefwoorden) voeg(trefwoord, t, e.code);
  }
  return { naam, trefwoord };
}

/** The words of a list: its nouns and verbs (`w`). */
function woorden(taal: Taal): string[] {
  const lijst = JSON.parse(readFileSync(path.join(SITE, "woorden", `${taal}.json`), "utf8")) as { naamwoorden: { w: string }[]; werkwoorden: { w: string }[] };
  return [...lijst.naamwoorden, ...lijst.werkwoorden].map((x) => x.w);
}

async function main(): Promise<void> {
  const bekend = await emoji();
  const perCode = new Map([...bekend.values()].map((e) => [e.code, e]));
  console.log(`${bekend.size} Fluent emoji with a flat picture in the groups used`);

  const uit: Record<Taal, Record<string, string[]>> = { nl: {}, pl: {} };
  for (const taal of TALEN) {
    const { naam, trefwoord } = index(taal, bekend);
    const { weg, keuze } = aanvullingen[taal];
    const regels: string[] = [];
    for (const w of woorden(taal)) {
      if (weg.includes(w)) continue;
      const codes =
        keuze[w] ??
        (() => {
          const opNaam = naam.get(w) ?? [];
          const opTrefwoord = (trefwoord.get(w) ?? []).filter((c) => !opNaam.includes(c));
          // By its name first; a keyword adds a second meaning (bank: 🏦 by name, 🛋 by keyword) only when it is a narrow keyword.
          const ruim = opTrefwoord.length > MAX_PER_TREFWOORD;
          return [...opNaam, ...(ruim ? [] : opTrefwoord)].slice(0, 2);
        })();
      const geldig = codes.filter((c) => perCode.has(c));
      if (codes.length !== geldig.length) throw new Error(`${taal} ${w}: no Fluent picture for ${codes.filter((c) => !perCode.has(c)).join(", ")}`);
      if (geldig.length === 0) continue;
      uit[taal][w] = geldig;
      regels.push(`${w}\t${geldig.map((c) => String.fromCodePoint(...c.split("-").map((h) => parseInt(h, 16)))).join(" ")}\t${keuze[w] ? "hand" : (naam.get(w) ?? []).some((c) => geldig.includes(c)) ? "naam" : "trefwoord"}`);
    }
    // For the hand check: every word with its picture(s) and how it got them.
    writeFileSync(path.join(cache!, `beelden-${taal}.tsv`), regels.join("\n") + "\n");
    console.log(`${taal}: ${Object.keys(uit[taal]).length} words with a picture (review: ${path.join(cache!, `beelden-${taal}.tsv`)})`);
  }

  // The pictures used, into public/: only those, so the site carries no more than it shows.
  const gebruikt = [...new Set(TALEN.flatMap((t) => Object.values(uit[t]).flat()))].sort();
  rmSync(PUBLIEK, { recursive: true, force: true });
  mkdirSync(PUBLIEK, { recursive: true });
  await perStuk(gebruikt, 16, async (code) => copyFileSync(await haal(perCode.get(code)!.svg), path.join(PUBLIEK, `${code}.svg`)));
  copyFileSync(await haal("LICENSE"), path.join(PUBLIEK, "LICENSE.txt"));
  const groot = readdirSync(PUBLIEK).reduce((s, f) => s + readFileSync(path.join(PUBLIEK, f)).length, 0);
  console.log(`${gebruikt.length} pictures, ${Math.round(groot / 1024)} KB → public/beeld/`);

  const beelden = Beelden.parse({
    bron: "Fluent Emoji (Microsoft, MIT)",
    pad: "/beeld/",
    ...uit,
  });
  // One word per line: a correction is a readable diff.
  const blok = (m: Record<string, string[]>) =>
    Object.entries(m)
      .map(([w, c]) => `    ${JSON.stringify(w)}: ${JSON.stringify(c)}`)
      .join(",\n");
  writeFileSync(
    path.join(SITE, "woorden", "beelden.json"),
    `{\n  "bron": ${JSON.stringify(beelden.bron)},\n  "pad": ${JSON.stringify(beelden.pad)},\n  "nl": {\n${blok(beelden.nl)}\n  },\n  "pl": {\n${blok(beelden.pl)}\n  }\n}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

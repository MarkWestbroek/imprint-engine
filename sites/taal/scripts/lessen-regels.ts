import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseLes } from "@imprint/plugin-taal/import";
import type { Les } from "@imprint/plugin-taal/schemas";

/**
 * The rules of SCHRIJFWIJZER.md that a machine can check, for the lesson
 * files under lessen/. Used by `npm run check:lessen` and by the site's test.
 * The schema says what a lesson may be; this says what a good file is.
 */
export const LESSEN_DIR = path.resolve(import.meta.dirname, "../lessen");

export type Gelezen = { file: string; les?: Les; fouten: string[] };

const woorden = (s: string) => s.trim().split(/\s+/).length;

/** What is wrong with one lesson, as sentences; empty = fine. */
export function controleer(file: string, les: Les): string[] {
  const fouten: string[] = [];
  const fout = (m: string) => fouten.push(m);
  const [, fase, nr] = /fase-(\d+)[\\/](\d+)-/.exec(file) ?? [];
  if (!fase || !nr) fout("the path is not nl/fase-<n>/<nr>-<slug>.md");
  else {
    if (les.fase !== Number(fase)) fout(`fase ${les.fase} in folder fase-${fase}`);
    if (les.id !== `${les.taal}-${fase}-${nr}`) fout(`id ${les.id}, expected ${les.taal}-${fase}-${nr}`);
  }
  if (!les.steuntaal) return [...fouten, "no steuntaal"];
  const steun = les.steuntaal;

  les.dialoog.forEach((r, i) => {
    if (!r[les.taal]?.trim() || !r[steun]?.trim()) fout(`dialoog ${i + 1}: needs ${les.taal} and ${steun}`);
  });
  const types = new Set(les.oefeningen.map((o) => o.type));
  les.oefeningen.forEach((o, i) => {
    const waar = `oefening ${i + 1} (${o.type})`;
    if ("opties" in o && new Set(o.opties).size !== o.opties.length) fout(`${waar}: an option twice`);
    if (o.type === "orden" && (woorden(o.zin) < 3 || woorden(o.zin) > 7)) fout(`${waar}: ${woorden(o.zin)} words, 3 to 7 expected`);
    if (o.type === "orden" && new Set(o.zin.split(/\s+/)).size !== woorden(o.zin)) fout(`${waar}: a word twice, so more than one right order`);
  });

  // Phase 0 came before the writing guide: only the rules above apply to it.
  if (les.fase === 0) return fouten;

  if (!les.ombouwen.startsWith("**Ombouwen:**")) fout("the body must start with **Ombouwen:**");
  for (const veld of ["situatie", "patroon"] as const) {
    for (const taal of [steun, les.taal]) if (!les[veld][taal]?.trim()) fout(`${veld}: no ${taal}`);
  }
  if (les.dialoog.length < 5 || les.dialoog.length > 8) fout(`dialoog: ${les.dialoog.length} lines, 5 to 8 expected`);
  if (les.brokken.length < 6 || les.brokken.length > 10) fout(`brokken: ${les.brokken.length}, 6 to 10 expected`);
  if (les.oefeningen.length < 6 || les.oefeningen.length > 8) fout(`oefeningen: ${les.oefeningen.length}, 6 to 8 expected`);
  for (const type of ["luister", "kies", "typ", "orden", "zeg"]) if (!types.has(type as never)) fout(`no exercise of type ${type}`);
  return fouten;
}

/** Every lesson file, parsed and checked; ids and slugs must be unique. */
export function leesLessen(dir = LESSEN_DIR): Gelezen[] {
  const files = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith(".md")).sort();
  const gelezen: Gelezen[] = files.map((file) => {
    try {
      const les = parseLes(file, readFileSync(path.join(dir, file), "utf8"));
      return { file, les, fouten: controleer(file, les) };
    } catch (err) {
      return { file, fouten: [`does not parse: ${err instanceof Error ? err.message.slice(0, 400) : String(err)}`] };
    }
  });
  for (const key of ["id", "slug"] as const) {
    const seen = new Map<string, string>();
    for (const g of gelezen) {
      if (!g.les) continue;
      const other = seen.get(g.les[key]);
      if (other) g.fouten.push(`${key} ${g.les[key]} is also in ${other}`);
      else seen.set(g.les[key], g.file);
    }
  }
  return gelezen;
}

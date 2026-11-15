import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { GRAMMATICA, WOORDEN } from "@imprint/plugin-taal/href";
import { parseGrammatica, parseLes } from "@imprint/plugin-taal/import";
import { zinnen } from "@imprint/plugin-taal/audio";
import type { Grammatica, Les } from "@imprint/plugin-taal/schemas";
import { vormenKloppen } from "@imprint/plugin-taal/tekst";

/**
 * The rules of SCHRIJFWIJZER.md that a machine can check, for the lesson
 * files under lessen/ and the grammar files under grammatica/. Used by
 * `npm run check:lessen` and by the site's test. The schema says what a lesson
 * may be; this says what a good file is.
 */
export const LESSEN_DIR = path.resolve(import.meta.dirname, "../lessen");
export const GRAMMATICA_DIR = path.resolve(import.meta.dirname, "../grammatica");

/** The interface languages of this site: every grammar topic is written for both. */
const LEZERS = ["pl", "nl"];

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
  if (les.slug === GRAMMATICA || les.slug === WOORDEN) fout(`a lesson may not be called ${les.slug}: that address is taken (grammar, word search)`);
  if (!les.steuntaal) return [...fouten, "no steuntaal"];
  const steun = les.steuntaal;

  les.dialoog.forEach((r, i) => {
    if (!r[les.taal]?.trim() || !r[steun]?.trim()) fout(`dialoog ${i + 1}: needs ${les.taal} and ${steun}`);
  });
  // Forms per learner (`Pracował{em|am}`) are for the support language: what is read out or answered has none.
  const gesproken = [...zinnen(les).map((z) => z.text), ...les.oefeningen.flatMap((o) => ("antwoorden" in o ? o.antwoorden : []))];
  for (const zin of gesproken) if (/[{}]/.test(zin)) fout(`a form in ${les.taal}: ${zin}`);
  const steunteksten = [les.situatie[steun], les.patroon[steun], ...les.dialoog.map((r) => r[steun]), ...les.oefeningen.flatMap((o) => ("vraag" in o ? [o.vraag] : "opties" in o ? o.opties : []))];
  for (const tekst of steunteksten) if (tekst && !vormenKloppen(tekst)) fout(`a form that is not {a|b}: ${tekst}`);
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

export type GelezenGrammatica = { file: string; grammatica?: Grammatica; fouten: string[] };

/** What is wrong with one grammar topic; empty = fine. */
export function controleerGrammatica(file: string, g: Grammatica): string[] {
  const fouten: string[] = [];
  const fout = (m: string) => fouten.push(m);
  const map = file.replace(/\\/g, "/").split("/")[0];
  if (map !== g.taal) fout(`taal ${g.taal} in folder ${map}`);
  for (const veld of ["titel", "kort", "tekst"] as const) {
    for (const lezer of LEZERS) if (!g[veld][lezer]?.trim()) fout(`${veld}: no ${lezer}`);
  }
  for (const lezer of Object.keys(g.anders)) if (!LEZERS.includes(lezer)) fout(`anders: ${lezer} is not a language of this site`);
  if (g.soort === "verschil" && Object.keys(g.anders).length > 0) fout("a verschil is all difference: no separate anders");
  for (const tekst of [...Object.values(g.tekst), ...Object.values(g.anders), ...Object.values(g.kort)]) {
    if (!vormenKloppen(tekst)) fout(`a form that is not {a|b}: ${tekst.slice(0, 80)}`);
    // Bold is the language taught and is read out: no forms per learner in it.
    for (const [, vet] of tekst.matchAll(/\*\*([^*]+)\*\*/g)) if (/[{}]/.test(vet)) fout(`a form in bold: ${vet}`);
  }
  return fouten;
}

/** Every grammar file, parsed and checked; slugs unique per language. */
export function leesGrammatica(dir = GRAMMATICA_DIR): GelezenGrammatica[] {
  const files = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith(".md")).sort();
  const gelezen: GelezenGrammatica[] = files.map((file) => {
    try {
      const grammatica = parseGrammatica(file, readFileSync(path.join(dir, file), "utf8"));
      return { file, grammatica, fouten: controleerGrammatica(file, grammatica) };
    } catch (err) {
      return { file, fouten: [`does not parse: ${err instanceof Error ? err.message.slice(0, 400) : String(err)}`] };
    }
  });
  const seen = new Map<string, string>();
  for (const g of gelezen) {
    if (!g.grammatica) continue;
    const other = seen.get(g.grammatica.id);
    if (other) g.fouten.push(`id ${g.grammatica.id} is also in ${other}`);
    else seen.set(g.grammatica.id, g.file);
  }
  return gelezen;
}

/** A lesson's links to the grammar must lead somewhere, in its own package. */
export function controleerLinks(lessen: Gelezen[], grammatica: GelezenGrammatica[]): void {
  const topics = new Map(grammatica.flatMap((g) => (g.grammatica ? [[g.grammatica.id, g.grammatica] as const] : [])));
  for (const l of lessen) {
    for (const id of l.les?.grammatica ?? []) {
      const g = topics.get(id);
      if (!g) l.fouten.push(`grammatica: no topic ${id}`);
      else if (g.taal !== l.les?.taal) l.fouten.push(`grammatica: ${id} is about another language`);
    }
  }
}

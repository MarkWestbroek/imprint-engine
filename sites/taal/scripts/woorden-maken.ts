import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { Woordenlijst, type Naamwoord, type Werkwoord } from "@imprint/plugin-taal/woorden";

/**
 * Make the word list for "check a word" (woorden/nl.json) from two open
 * sources, both CC BY-SA 4.0:
 *
 *   - Wiktionary as JSON lines (kaikki.org, wiktextract): gender, plural and
 *     diminutive of the nouns, the forms and the auxiliary of the verbs;
 *   - a frequency list from film subtitles (FrequencyWords, OpenSubtitles
 *     2018, `nl_50k.txt`): which words are common enough to be in it.
 *
 *   npx tsx --tsconfig tsconfig.test.json scripts/woorden-maken.ts <kaikki-Dutch.jsonl> <nl_50k.txt> [nouns=2000] [verbs=450]
 *
 * The downloads are big and not in the repo; the result is. Hand-made
 * corrections live in woorden/nl-aanvullingen.json and win over Wiktionary.
 *
 * The frequency list counts word forms, not words: `niet` is counted for the
 * adverb, not for the noun "de niet" (a rivet) or a form of `nieten`. So a
 * form only counts for a noun or a verb when it is not also another kind of
 * word, and not a form of a real verb; a verb is real when its own forms
 * (`werkte`, `gewerkt`) are used. Words that lose out but belong in a basic
 * list (`de weg`, `het werk`) are in the `houd` list of the corrections.
 *
 * At the end the script lists the weak verbs whose forms do not follow the
 * rule ('t kofschip); they are marked irregular. Look at those by hand.
 */

const [jsonl, freqFile, nNoun = "2000", nVerb = "450"] = process.argv.slice(2);
if (!jsonl || !freqFile) throw new Error("usage: woorden-maken.ts <kaikki-Dutch.jsonl> <nl_50k.txt> [nouns] [verbs]");
const DIR = path.resolve(import.meta.dirname, "../woorden");
const aanvullingen = JSON.parse(readFileSync(path.join(DIR, "nl-aanvullingen.json"), "utf8")) as {
  hulp: Record<string, Werkwoord["hulp"]>;
  houd: string[];
  weg: string[];
};
const weg = new Set(aanvullingen.weg);
const houd = new Set(aanvullingen.houd);

/** word → count in the subtitles. */
const freq = new Map<string, number>();
for (const line of readFileSync(freqFile, "utf8").split("\n")) {
  const [w, n] = line.trim().split(" ");
  if (w && n) freq.set(w, Number(n));
}
const aantal = (v: string) => freq.get(v) ?? 0;

type Vorm = { form: string; tags?: string[] };
type Entry = {
  word: string;
  pos: string;
  forms?: Vorm[];
  head_templates?: { name: string; args: Record<string, string> }[];
  inflection_templates?: { name: string; args: Record<string, string> }[];
  senses?: { tags?: string[]; form_of?: unknown; alt_of?: unknown; categories?: { name: string }[] }[];
};

/** Senses that make a word unfit for a basic list for learners. */
const GROF = ["vulgar", "offensive", "derogatory", "slur", "ethnic"];
const ONGEBRUIKELIJK = [...GROF, "obsolete", "archaic", "misspelling", "dated", "rare", "dialectal"];
const VLEES = /^(nl:)?(Meats|Seafood)$/;

const eigenSenses = (e: Entry) => (e.senses ?? []).filter((s) => !s.form_of && !s.alt_of);

function bruikbaar(e: Entry): boolean {
  if (!/^[a-zà-ÿ]+(-[a-zà-ÿ]+)?$/.test(e.word) || weg.has(e.word)) return false;
  const senses = eigenSenses(e);
  if (senses.length === 0) return false;
  // One coarse sense is enough to leave the word out: a learner should not meet it by accident.
  if (senses.some((s) => s.tags?.some((t) => GROF.includes(t)))) return false;
  if (senses.every((s) => s.tags?.some((t) => ONGEBRUIKELIJK.includes(t)))) return false;
  if (senses.some((s) => s.categories?.some((c) => VLEES.test(c.name)))) return false;
  return true;
}

/** The forms of the first conjugation table, without archaic, Flemish, formal or subordinate-clause variants. */
const NIET_DEZE = ["archaic", "Flanders", "colloquial", "formal", "majestic", "subjunctive", "imperative", "subordinate-clause", "dialectal", "obsolete", "rare"];
function vorm(e: Entry, ...tags: string[]): string | undefined {
  return e.forms?.find((f) => tags.every((t) => f.tags?.includes(t)) && !f.tags?.some((t) => NIET_DEZE.includes(t)))?.form;
}

type Zwak = { stam: string; sep?: string; pref?: string };
type NwKandidaat = Naamwoord & { /** senses of the entry the gender comes from */ zwaarte: number };
type WwKandidaat = Werkwoord & { zwak?: Zwak; /** single-word forms that may count for it */ telvormen: string[]; sep?: string; eigenHulp: boolean };

/** word → the kinds of word it is a lemma of (noun, adv, prep, verb, …). */
const lemmaVan = new Map<string, Set<string>>();
/** The plurals of all nouns: `dagen` is the plural of dag, not a form of the verb "dagen". */
const meervouden = new Set<string>();
const naamwoorden = new Map<string, NwKandidaat>();
const werkwoorden = new Map<string, WwKandidaat>();

async function lees(): Promise<void> {
  const rl = createInterface({ input: createReadStream(jsonl!, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    const e = JSON.parse(line) as Entry;
    if (eigenSenses(e).length > 0) {
      const s = lemmaVan.get(e.word) ?? new Set<string>();
      s.add(e.pos);
      lemmaVan.set(e.word, s);
    }
    if ((e.pos !== "noun" && e.pos !== "verb") || !bruikbaar(e)) continue;

    if (e.pos === "noun") {
      const head = e.head_templates?.find((h) => h.name === "nl-noun");
      const g = (head?.args["1"] ?? "")
        .split(/[,/]/)
        .map((x) => x.trim())
        .filter((x) => /^[mfn]$/.test(x));
      if (g.length === 0) continue;
      const mv = (e.forms ?? []).filter((f) => f.tags?.includes("plural") && !f.tags.includes("diminutive")).map((f) => f.form);
      const vk = (e.forms ?? []).find((f) => f.tags?.includes("diminutive") && !f.tags.includes("plural"))?.form;
      mv.forEach((m) => meervouden.add(m));
      // Two entries for one word are two meanings (de school, het school vissen): the one with the most senses gives gender and plural.
      const zwaarte = eigenSenses(e).length;
      const oud = naamwoorden.get(e.word);
      if (oud && oud.zwaarte >= zwaarte) continue;
      naamwoorden.set(e.word, {
        w: e.word,
        // In Wiktionary's order: the usual gender first (`n,f`: het hart, rarely de).
        g: [...new Set(g)].join("/"),
        mv,
        ...(vk ? { vk } : {}),
        r: 0,
        zwaarte,
      });
    } else {
      if (werkwoorden.has(e.word)) continue; // the first entry is the common verb (werken: not "wrocht")
      const tpl = e.inflection_templates?.[0];
      const sep = tpl?.args.sep;
      const hoofd = sep ? ["main-clause"] : [];
      const ik = vorm(e, "first-person", "present", "singular", ...hoofd);
      const jij = vorm(e, "second-person", "present", "singular", ...hoofd);
      const hij = vorm(e, "third-person", "present", "singular", ...hoofd);
      const wij = vorm(e, "plural", "present", ...hoofd);
      const vtEv = vorm(e, "first-person", "past", "singular", ...hoofd);
      const vtMv = vorm(e, "past", "plural", ...hoofd);
      const vd = vorm(e, "participle", "past");
      if (!ik || !jij || !hij || !wij || !vtEv || !vtMv || !vd) continue;
      const aux = tpl?.args.aux ?? (tpl?.args.trans === "unacc" ? "zijn" : "hebben");
      const eigenHulp = !!aanvullingen.hulp[e.word] || !!tpl?.args.aux || tpl?.args.trans === "unacc";
      werkwoorden.set(e.word, {
        w: e.word,
        tt: [ik, jij, hij, wij],
        vt: [vtEv, vtMv],
        vd,
        hulp: aanvullingen.hulp[e.word] ?? (/zijn/.test(aux) && /hebben/.test(aux) ? "beide" : /zijn/.test(aux) ? "zijn" : "hebben"),
        sterk: !tpl?.name.startsWith("nl-conj-wk"),
        r: 0,
        ...(sep ? { sep } : {}),
        eigenHulp,
        // A separable verb counts by its one-word forms: `opstaan`, `opgestaan`.
        telvormen: [...new Set([e.word, ik, jij, hij, vtEv, vtMv, vd].filter((v) => !v.includes(" ")))],
        // The written stem is the ik-form (`bericht`, `leg` of `leg uit`); Wiktionary's own argument leaves the prefix out.
        ...(tpl?.name === "nl-conj-wk" ? { zwak: { stam: ik.split(" ")[0]!, sep, pref: tpl.args.pref } } : {}),
      });
    }
  }
}

/** A form that is also a lemma of another kind of word (`niet`, `voor`, `goed`) says nothing about this one. */
const alleen = (v: string, pos: string) => [...(lemmaVan.get(v) ?? [])].every((p) => p === pos) && (pos === "noun" || !meervouden.has(v));

/** 't kofschip: what a weak verb should look like, to compare with Wiktionary. */
function regelmatig(inf: string, { stam, sep, pref }: Zwak): { vt: string; vd: string } {
  // The sound decides, so the infinitive without -en (leven → lev: -de), not the written stem (leef).
  const kaal = inf.slice(sep?.length ?? 0).replace(/en$/, "");
  const t = /[tkfscp]$|ch$|x$/.test(kaal);
  const vt = stam + (t ? "te" : "de") + (sep ? ` ${sep}` : "");
  const eind = stam.endsWith(t ? "t" : "d") ? "" : t ? "t" : "d";
  // No ge- after an unstressed prefix (be-, ver-, ont-…); ge- before e, i, u gets a diaeresis (geëindigd).
  const trema: Record<string, string> = { e: "ë", i: "ï", u: "ü" };
  const vd = pref ? stam : trema[stam[0]!] ? `ge${trema[stam[0]!]}${stam.slice(1)}` : `ge${stam}`;
  return { vt, vd: (sep ?? "") + vd + eind };
}

async function main(): Promise<void> {
  await lees();
  // A separable verb whose base takes zijn says where to: weglopen, terugrijden → is weggelopen. Unless Wiktionary or the corrections say otherwise.
  for (const v of werkwoorden.values()) {
    const basis = v.sep ? werkwoorden.get(v.w.slice(v.sep.length)) : undefined;
    if (basis && !v.eigenHulp && basis.hulp !== "hebben") v.hulp = "zijn";
  }

  // Verbs: a form shared by two verbs (`weet`: weten and wijten) counts for the more used one.
  const ww = [...werkwoorden.values()];
  // Forms that are nouns too count here (weten, geweten: otherwise wissen takes `wist` from weten), but not
  // function words (niet: otherwise nieten takes `geniet` from genieten).
  const FUNCTIEWOORD = ["adv", "prep", "conj", "pron", "det", "article", "num", "particle", "intj", "postp", "contraction"];
  const geenFunctiewoord = (f: string) => ![...(lemmaVan.get(f) ?? [])].some((p) => FUNCTIEWOORD.includes(p));
  const eerste = new Map(ww.map((v) => [v.w, v.telvormen.filter(geenFunctiewoord).reduce((s, f) => s + aantal(f), 0)]));
  const eigenaar = new Map<string, string>();
  for (const v of ww) {
    for (const f of v.telvormen) {
      const nu = eigenaar.get(f);
      if (!nu || eerste.get(v.w)! > eerste.get(nu)!) eigenaar.set(f, v.w);
    }
  }
  const wwScore = new Map(ww.map((v) => [v.w, v.telvormen.filter((f) => eigenaar.get(f) === v.w && alleen(f, "verb")).reduce((s, f) => s + aantal(f), 0)]));
  // Real: its own past forms are used. `huizen`, `mannen` or `tafelen` are in Wiktionary, but nobody says "huisde".
  // Only forms of its own count: `geniet` is the participle of nieten, but it is said for genieten.
  const eigen = (v: WwKandidaat, f: string) => (eigenaar.get(f) === v.w ? aantal(f) : 0);
  const echt = (v: WwKandidaat) => eigen(v, v.vt[0].split(" ")[0]!) + eigen(v, v.vd) >= 50;
  const echteVormen = new Set(ww.filter(echt).flatMap((v) => v.telvormen));

  // Nouns: by singular and plural, where the form is not something else.
  const nwScore = (n: NwKandidaat) => {
    const telt = (f: string) => alleen(f, "noun") && !echteVormen.has(f);
    const s = [n.w, ...n.mv.slice(0, 1)].filter(telt).reduce((t, f) => t + aantal(f), 0);
    // Kept by hand: a basic noun whose forms are all also something else (de weg, het werk); half its count.
    return houd.has(n.w) ? Math.max(s, Math.round(aantal(n.w) / 2)) : s;
  };

  const nouns = [...naamwoorden.values()]
    .map((n) => ({ x: n, n: nwScore(n) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, Number(nNoun));
  const verbs = ww
    .filter((v) => echt(v) || houd.has(v.w))
    .map((v) => ({ x: v, n: wwScore.get(v.w)! }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, Number(nVerb));

  // One rank across both: the suggestions mix nouns and verbs.
  [...nouns, ...verbs].sort((a, b) => b.n - a.n).forEach((y, i) => (y.x.r = i));

  // A "weak" verb that does not follow the rule is mixed (zeggen → zei, bakken → gebakken): not regular for the learner either.
  const afwijkend = verbs.flatMap(({ x: v }) => {
    if (!v.zwak) return [];
    const r = regelmatig(v.w, v.zwak);
    if (r.vt === v.vt[0] && r.vd === v.vd) return [];
    v.sterk = true;
    return [`${v.w}: Wiktionary ${v.vt[0]} / ${v.vd}, regel ${r.vt} / ${r.vd}`];
  });

  const lijst = Woordenlijst.parse({
    taal: "nl",
    bron: "Wiktionary (CC BY-SA 4.0, kaikki.org) · FrequencyWords / OpenSubtitles 2018 (CC BY-SA 4.0)",
    // The schema drops the working fields (zwaarte, zwak, telvormen, …).
    naamwoorden: nouns.map(({ x }) => x).sort((a, b) => a.r - b.r),
    werkwoorden: verbs.map(({ x }) => x).sort((a, b) => a.r - b.r),
  });

  // One word per line: a correction is a readable diff.
  const regels = (xs: unknown[]) => xs.map((x) => "    " + JSON.stringify(x)).join(",\n");
  writeFileSync(
    path.join(DIR, "nl.json"),
    `{\n  "taal": ${JSON.stringify(lijst.taal)},\n  "bron": ${JSON.stringify(lijst.bron)},\n  "naamwoorden": [\n${regels(lijst.naamwoorden)}\n  ],\n  "werkwoorden": [\n${regels(lijst.werkwoorden)}\n  ]\n}\n`,
  );
  console.log(`${lijst.naamwoorden.length} nouns, ${lijst.werkwoorden.length} verbs → woorden/nl.json`);
  console.log(`weak verbs not by the rule, marked irregular (${afwijkend.length}); check these by hand:`);
  for (const a of afwijkend) console.log("  " + a);

  // For the `houd` list: common nouns that lost their count to another word.
  const gemist = [...naamwoorden.values()]
    .filter((n) => !nouns.some((y) => y.x === n) && aantal(n.w) > 3000)
    .sort((a, b) => aantal(b.w) - aantal(a.w))
    .slice(0, 150)
    .map((n) => n.w);
  console.log(`common nouns not in the list (candidates for houd): ${gemist.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

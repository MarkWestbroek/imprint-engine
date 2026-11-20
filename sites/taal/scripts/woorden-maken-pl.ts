import { createReadStream, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { parseGrammatica, parseLes } from "@imprint/plugin-taal/import";
import { NAAMVALLEN, PoolseWoordenlijst, type PoolsNaamwoord, type PoolsWerkwoord } from "@imprint/plugin-taal/woorden";

/**
 * Make the Polish word list for "check a word" (woorden/pl.json), like
 * woorden-maken.ts does for Dutch, from the same two open sources (both
 * CC BY-SA 4.0): Wiktionary as JSON lines (kaikki.org: gender and the seven
 * cases of the nouns; aspect, its partner and the forms of the verbs; a short
 * English gloss) and the subtitle frequency list (`pl_50k.txt`).
 *
 *   npx tsx --tsconfig tsconfig.test.json scripts/woorden-maken-pl.ts <kaikki-Polish.jsonl> <pl_50k.txt> [nouns=2500] [verbs=500]
 *
 * The downloads are big and not in the repo; the result is. Hand-made
 * corrections live in woorden/pl-aanvullingen.json.
 *
 * Polish spreads a word over many forms, and many forms are shared: `mam` is
 * "I have" and "of the mums", `dobra` an adjective and a noun. So a form
 * never counts for a noun or a verb when it is also a function word or a form
 * of an adjective, pronoun or numeral; and a form shared by several nouns and
 * verbs counts for the one that is used most in the forms it has alone.
 *
 * A verb comes with its partner of the other aspect when Wiktionary has both
 * (robić with zrobić), and every noun and verb of the Polish lessons and of
 * the bold examples in the grammar is in the list whatever its count, so the
 * list has somewhat more words than asked for.
 */

const [jsonl, freqFile, nNoun = "2500", nVerb = "500"] = process.argv.slice(2);
if (!jsonl || !freqFile) throw new Error("usage: woorden-maken-pl.ts <kaikki-Polish.jsonl> <pl_50k.txt> [nouns] [verbs]");
const DIR = path.resolve(import.meta.dirname, "../woorden");
const aanvullingen = JSON.parse(readFileSync(path.join(DIR, "pl-aanvullingen.json"), "utf8")) as { houd: string[]; weg: string[]; sie: string[] };
const sie = new Set(aanvullingen.sie);
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
  senses?: { tags?: string[]; glosses?: string[]; form_of?: unknown; alt_of?: unknown; categories?: { name: string }[] }[];
};

/**
 * A word of its own, not an entry for one form of another word ("genitive
 * plural of …"). By the head line, not by the senses: Wiktionary also marks
 * "female equivalent of pan" (pani, sąsiadka) as a form.
 */
const isLemma = (e: Entry) => !e.head_templates?.some((h) => h.name === "head" && / form$/.test(h.args["2"] ?? ""));

/** Senses that make a word unfit for a basic list for learners. */
const GROF = ["vulgar", "offensive", "derogatory", "slur", "ethnic", "pejorative"];
const ONGEBRUIKELIJK = [...GROF, "obsolete", "archaic", "misspelling", "dated", "rare", "dialectal", "Middle", "historical", "regional"];
const VLEES = /^(pl:)?(Meats|Seafood|Sausages)$/;
const LETTERS = /^[a-ząćęłńóśźż]+$/;

const eigenSenses = (e: Entry) => (isLemma(e) ? (e.senses ?? []).filter((s) => !s.alt_of) : []);
const gewoon = (s: { tags?: string[] }) => !s.tags?.some((t) => ONGEBRUIKELIJK.includes(t));

function bruikbaar(e: Entry): boolean {
  const kaal = e.word.replace(/ się$/, "");
  if (!LETTERS.test(kaal) || weg.has(e.word) || weg.has(kaal)) return false;
  const senses = eigenSenses(e);
  if (senses.length === 0) return false;
  // One coarse sense is enough to leave the word out: a learner should not meet it by accident.
  if (senses.some((s) => s.tags?.some((t) => GROF.includes(t)))) return false;
  if (!senses.some(gewoon)) return false;
  if (senses.some((s) => s.categories?.some((c) => VLEES.test(c.name)))) return false;
  return true;
}

/** The first usual sense, in a few words: "shop, store (establishment that…)" → "shop, store". */
function betekenis(e: Entry): string | undefined {
  const ruw = eigenSenses(e).find(gewoon)?.glosses?.at(-1);
  if (!ruw) return undefined;
  // "female equivalent of pan (“woman”) (…)" → woman; "Suppletive plural of człowiek; people" → people.
  const gloss = /^(?:fe)?male equivalent of \S+ \(“([^”]+)”\)/.exec(ruw)?.[1] ?? ruw.replace(/^Suppletive plural of \S+; /i, "").replace(/^(?:fe)?male equivalent of /, "female ");
  const kort = gloss
    .replace(/\s*\([^()]*\)/g, "")
    .replace(/\s*\([^()]*\)/g, "")
    .split(/[;:]/)[0]!
    .replace(/\s+/g, " ")
    .trim();
  if (!kort) return undefined;
  return kort.length <= 48 ? kort : kort.slice(0, 48).replace(/[,\s]+\S*$/, "") + "…";
}

const NIET_DEZE = ["archaic", "dialectal", "obsolete", "rare", "alternative", "dated", "Middle", "colloquial", "nonstandard", "proscribed"];
const goed = (f: Vorm) => !f.tags?.some((t) => NIET_DEZE.includes(t)) && !f.form.startsWith("-") && f.form !== "-";

const NAAM: Record<(typeof NAAMVALLEN)[number], string> = { nom: "nominative", gen: "genitive", dat: "dative", acc: "accusative", ins: "instrumental", loc: "locative", voc: "vocative" };

/** The seven cases of one number, the first form given for each; empty when the noun has no such number. */
function verbuiging(e: Entry, getal: "singular" | "plural"): string[] {
  const vormen = NAAMVALLEN.map((nv) => (e.forms ?? []).find((f) => goed(f) && f.tags?.includes(NAAM[nv]) && f.tags.includes(getal))?.form);
  return vormen.every((v) => v && LETTERS.test(v)) ? (vormen as string[]) : [];
}

type NwKandidaat = PoolsNaamwoord & { zwaarte: number };
type WwKandidaat = PoolsWerkwoord & { /** the forms without `się`, that may count for it */ telvormen: string[] };

/** word → the kinds of word it is a lemma of. */
const lemmaVan = new Map<string, Set<string>>();
/** Every form of the adjectives, pronouns, numerals and determiners: `dobra`, `tego`, `moja` say nothing about a noun. */
const andereVormen = new Set<string>();
const naamwoorden = new Map<string, NwKandidaat>();
/** Nouns whose own entry has no table (pani: Wiktionary declines it under the pronoun), and the tables of the pronouns. */
const zonderTabel = new Map<string, NwKandidaat>();
const tabelElders = new Map<string, { ev: string[]; mv: string[] }>();
const werkwoorden = new Map<string, WwKandidaat>();

const BUIGT = ["adj", "pron", "num", "det"];

/** The verb's own forms of one tense, in the order of Wiktionary's table: ja, my, ty, wy, on, oni. */
function personen(e: Entry, tijd: "present" | "future"): string[] | null {
  const kaal = (e.forms ?? []).filter((f) => goed(f) && f.tags?.includes(tijd) && !f.tags.includes("impersonal") && !/^(będ|niech )/.test(f.form) && !f.tags.includes("imperative"));
  const ev = kaal.filter((f) => f.tags!.includes("singular"));
  const mv = kaal.filter((f) => f.tags!.includes("plural"));
  const derde = (xs: Vorm[]) => xs.find((f) => f.tags!.includes("third-person"))?.form;
  const eersteTwee = (xs: Vorm[]) => xs.filter((f) => !f.tags!.includes("third-person")).map((f) => f.form);
  const [ja, ty] = eersteTwee(ev);
  const [my, wy] = eersteTwee(mv);
  const on = derde(ev);
  const oni = derde(mv);
  return ja && ty && on && my && wy && oni ? [ja, ty, on, my, wy, oni] : null;
}

function verleden(e: Entry): string[] | null {
  const past = (e.forms ?? []).filter((f) => goed(f) && f.tags?.includes("past") && !f.tags.includes("impersonal") && !f.form.includes(" by"));
  const vind = (...tags: string[]) => past.find((f) => tags.every((t) => f.tags!.includes(t)) && (tags.includes("third-person") || !f.tags!.includes("third-person")))?.form;
  const vormen = [vind("masculine", "singular"), vind("feminine", "singular"), vind("masculine", "singular", "third-person"), vind("feminine", "singular", "third-person"), vind("virile", "plural", "third-person"), vind("nonvirile", "plural", "third-person")];
  return vormen.every(Boolean) ? (vormen as string[]) : null;
}

/** `zrobić,porobić<l:dialectal>` → the usual partners. */
const partners = (arg: string | undefined): string[] =>
  (arg ?? "")
    .split(",")
    .filter((p) => !p.includes("<"))
    .map((p) => p.trim())
    .filter(Boolean);

async function lees(): Promise<void> {
  const rl = createInterface({ input: createReadStream(jsonl!, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    const e = JSON.parse(line) as Entry;
    if (eigenSenses(e).length > 0) {
      const s = lemmaVan.get(e.word) ?? new Set<string>();
      s.add(e.pos);
      lemmaVan.set(e.word, s);
      if (BUIGT.includes(e.pos)) for (const f of e.forms ?? []) andereVormen.add(f.form);
    }
    if (e.pos === "pron" && isLemma(e)) tabelElders.set(e.word, { ev: verbuiging(e, "singular"), mv: verbuiging(e, "plural") });
    if ((e.pos !== "noun" && e.pos !== "verb") || !bruikbaar(e)) continue;

    if (e.pos === "noun") {
      const eerste = (e.head_templates?.find((h) => h.name === "pl-noun")?.args["1"] ?? "").split(",")[0]!.trim();
      // m-pr, m-an, m-in, f, n; plural only: vr-p (men: rodzice), nv-p (drzwi).
      const g = eerste.endsWith("-p") ? (eerste.startsWith("vr") ? "pv" : "p") : /^[mfn]/.test(eerste) ? (eerste[0] as "m" | "f" | "n") : null;
      if (!g) continue;
      const ev = g === "p" || g === "pv" ? [] : verbuiging(e, "singular");
      const mv = verbuiging(e, "plural");
      if (ev.length === 0 && mv.length === 0) {
        const b = betekenis(e);
        if (g !== "p" && g !== "pv" && !zonderTabel.has(e.word)) zonderTabel.set(e.word, { w: e.word, g, ev, mv, ...(b ? { b } : {}), r: 0, zwaarte: 0 });
        continue;
      }
      // Two entries for one word are two meanings: the one with the most senses gives gender and forms.
      const zwaarte = eigenSenses(e).filter(gewoon).length;
      const oud = naamwoorden.get(e.word);
      if (oud && oud.zwaarte >= zwaarte) continue;
      const b = betekenis(e);
      naamwoorden.set(e.word, { w: e.word, g, ev, mv, ...(b ? { b } : {}), r: 0, zwaarte });
    } else {
      if (werkwoorden.has(e.word)) continue; // the first entry is the common verb
      const head = e.head_templates?.find((h) => h.name === "pl-verb");
      const soort = head?.args["1"] ?? "";
      const asp = /impf/.test(soort) && /(^|[,-])pf/.test(soort) ? "beide" : soort.startsWith("impf") ? "ndk" : soort.startsWith("pf") ? "dk" : null;
      if (!asp) continue;
      // The forms without a helper: the present of an imperfective verb, the future of a perfective one.
      const tt = personen(e, "present") ?? personen(e, "future");
      const vt = verleden(e);
      if (!tt || !vt) continue;
      const b = betekenis(e);
      const zonderSie = (v: string) => v.replace(/ się$/, "");
      werkwoorden.set(e.word, {
        w: e.word,
        // Only with `się`: by hand, Wiktionary's tags do not tell it reliably.
        ...(sie.has(e.word) ? { sie: true } : {}),
        asp,
        paar: partners(asp === "dk" ? head?.args.impf : head?.args.pf),
        tt: tt as PoolsWerkwoord["tt"],
        vt: vt as PoolsWerkwoord["vt"],
        ...(b ? { b } : {}),
        r: 0,
        telvormen: [...new Set([e.word, ...tt, ...vt].map(zonderSie).filter((v) => !v.includes(" ")))],
      });
    }
  }
}

const FUNCTIEWOORD = ["adv", "prep", "conj", "pron", "det", "article", "num", "particle", "intj", "postp", "contraction", "adj"];
/** A form that is also a function word or a form of an adjective or pronoun says nothing about a noun or a verb. */
const telt = (f: string) => !andereVormen.has(f) && ![...(lemmaVan.get(f) ?? [])].some((p) => FUNCTIEWOORD.includes(p));

/** The Polish of the lessons and the bold examples of the grammar, as words. */
function lesWoorden(): Set<string> {
  const root = path.resolve(import.meta.dirname, "..");
  const bestanden = (map: string) => (readdirSync(path.join(root, map), { recursive: true }) as string[]).filter((f) => f.endsWith(".md")).map((f) => path.join(root, map, f));
  const teksten: string[] = [];
  for (const f of bestanden("lessen/pl")) {
    const les = parseLes(f, readFileSync(f, "utf8"));
    teksten.push(...les.dialoog.map((r) => r.pl ?? ""), ...les.brokken);
    for (const o of les.oefeningen) {
      if (o.type === "luister") teksten.push(o.tekst);
      if (o.type === "orden") teksten.push(o.zin);
      if (o.type === "typ" || o.type === "zeg") teksten.push(...o.antwoorden);
    }
  }
  for (const f of bestanden("grammatica/pl")) {
    const g = parseGrammatica(path.relative(path.join(root, "grammatica"), f), readFileSync(f, "utf8"));
    for (const [, vet] of (g.tekst.nl ?? "").matchAll(/\*\*([^*]+)\*\*/g)) teksten.push(vet!);
  }
  // Only words written small: a capital is a name (Polka, Warszawa) or the start of a sentence.
  return new Set(teksten.flatMap((t) => t.match(/(?<![\p{L}])[a-ząćęłńóśźż]+/gu) ?? []));
}

async function main(): Promise<void> {
  await lees();
  for (const [w, n] of zonderTabel) {
    const tabel = tabelElders.get(w);
    if (tabel && tabel.ev.length > 0 && !naamwoorden.has(w)) naamwoorden.set(w, { ...n, ...tabel });
  }
  type K = { w: string; soort: "n" | "v"; vormen: string[] };
  const alle: K[] = [
    ...[...naamwoorden.values()].map((n) => ({ w: n.w, soort: "n" as const, vormen: [...new Set([...n.ev, ...n.mv])].filter(telt) })),
    ...[...werkwoorden.values()].map((v) => ({ w: v.w, soort: "v" as const, vormen: v.telvormen.filter(telt) })),
  ];
  const sleutel = (k: K) => `${k.soort}:${k.w}`;
  // How many words have each form.
  const houders = new Map<string, number>();
  for (const k of alle) for (const f of k.vormen) houders.set(f, (houders.get(f) ?? 0) + 1);
  // First by the forms a word has alone; a shared form then goes to the word that is used most.
  const alleen = new Map(alle.map((k) => [sleutel(k), k.vormen.filter((f) => houders.get(f) === 1).reduce((s, f) => s + aantal(f), 0)]));
  const eigenaar = new Map<string, string>();
  for (const k of alle) {
    for (const f of k.vormen) {
      const nu = eigenaar.get(f);
      if (!nu || alleen.get(sleutel(k))! > alleen.get(nu)!) eigenaar.set(f, sleutel(k));
    }
  }
  const score = new Map(alle.map((k) => [sleutel(k), k.vormen.filter((f) => eigenaar.get(f) === sleutel(k)).reduce((s, f) => s + aantal(f), 0)]));
  // Kept by hand: a basic word whose forms are all also something else; half the count of the word itself.
  const punten = (soort: "n" | "v", w: string) => {
    const s = score.get(`${soort}:${w}`) ?? 0;
    return houd.has(w) ? Math.max(s, Math.round(aantal(w.replace(/ się$/, "")) / 2), 1) : s;
  };

  // The words of the lessons: a form found there brings in the word it counts for (or, uncounted, every word that has it).
  const inLes = lesWoorden();
  const uitLes = new Set<string>();
  const perVorm = new Map<string, string[]>();
  for (const k of alle) for (const f of k.vormen) perVorm.set(f, [...(perVorm.get(f) ?? []), sleutel(k)]);
  for (const f of inLes) {
    const eig = eigenaar.get(f);
    if (eig) uitLes.add(eig);
  }

  const kies = <T extends { w: string }>(alleVan: T[], soort: "n" | "v", n: number) => {
    const gesorteerd = alleVan.map((x) => ({ x, n: punten(soort, x.w) })).sort((a, b) => b.n - a.n);
    const top = gesorteerd.filter((y) => y.n > 0).slice(0, n);
    const erbij = gesorteerd.filter((y) => !top.includes(y) && uitLes.has(`${soort}:${y.x.w}`)).map((y) => ({ x: y.x, n: Math.max(y.n, 1) }));
    return [...top, ...erbij];
  };
  const nouns = kies([...naamwoorden.values()], "n", Number(nNoun));
  const verbs = kies([...werkwoorden.values()], "v", Number(nVerb));
  // The partner of the other aspect comes along, so the pair is complete; not a partner nobody uses (mrzeć beside umierać).
  const gekozen = new Set(verbs.map((y) => y.x.w));
  for (const y of [...verbs]) {
    for (const p of y.x.paar) {
      const partner = werkwoorden.get(p);
      if (partner && !gekozen.has(p) && punten("v", p) >= 300) {
        gekozen.add(p);
        verbs.push({ x: partner, n: Math.max(punten("v", p), 1) });
      }
    }
  }
  // Only partners that are in the list: a link must lead somewhere.
  for (const y of verbs) y.x.paar = y.x.paar.filter((p) => gekozen.has(p));

  // One rank across both: the suggestions mix nouns and verbs.
  [...nouns, ...verbs].sort((a, b) => b.n - a.n).forEach((y, i) => (y.x.r = i));

  const lijst = PoolseWoordenlijst.parse({
    taal: "pl",
    bron: "Wiktionary (CC BY-SA 4.0, kaikki.org) · FrequencyWords / OpenSubtitles 2018 (CC BY-SA 4.0)",
    // The schema drops the working fields (zwaarte, telvormen).
    naamwoorden: nouns.map(({ x }) => x).sort((a, b) => a.r - b.r),
    werkwoorden: verbs.map(({ x }) => x).sort((a, b) => a.r - b.r),
  });

  // One word per line: a correction is a readable diff.
  const regels = (xs: unknown[]) => xs.map((x) => "    " + JSON.stringify(x)).join(",\n");
  writeFileSync(
    path.join(DIR, "pl.json"),
    `{\n  "taal": ${JSON.stringify(lijst.taal)},\n  "bron": ${JSON.stringify(lijst.bron)},\n  "naamwoorden": [\n${regels(lijst.naamwoorden)}\n  ],\n  "werkwoorden": [\n${regels(lijst.werkwoorden)}\n  ]\n}\n`,
  );
  console.log(`${lijst.naamwoorden.length} nouns, ${lijst.werkwoorden.length} verbs → woorden/pl.json`);
  console.log(`reflexive only: ${lijst.werkwoorden.filter((v) => v.sie).map((v) => v.w).join(", ")}`);
  console.log(`first nouns: ${lijst.naamwoorden.slice(0, 60).map((n) => n.w).join(", ")}`);
  console.log(`first verbs: ${lijst.werkwoorden.slice(0, 60).map((v) => v.w).join(", ")}`);
  console.log(`last nouns: ${lijst.naamwoorden.slice(-40).map((n) => n.w).join(", ")}`);
  console.log(`last verbs: ${lijst.werkwoorden.slice(-40).map((v) => v.w).join(", ")}`);

  // For the `houd` list: common words that lost their count to another word.
  const inLijst = new Set([...lijst.naamwoorden, ...lijst.werkwoorden].map((x) => x.w));
  const gemist = [...naamwoorden.values(), ...werkwoorden.values()]
    .filter((x) => !inLijst.has(x.w) && aantal(x.w.replace(/ się$/, "")) > 4000)
    .sort((a, b) => aantal(b.w) - aantal(a.w))
    .slice(0, 150)
    .map((x) => x.w);
  console.log(`common words not in the list (candidates for houd): ${gemist.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

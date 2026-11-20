import Link from "next/link";
import { Markdown } from "@imprint/runtime-admin";
import { grammaticaHref, pakketHref } from "./href";
import { teksten, vul } from "./i18n";
import { tekstVoor } from "./lessen";
import type { Grammatica } from "./schemas";
import { Woordenlijst } from "./woorden";
import { Woordzoeker } from "./woordzoeker";

/** Where a site gets the word list of a package: the raw JSON (woorden/nl.json), or null. */
export type WoordenBron = (taal: string) => Promise<unknown | null>;

const geparst = new Map<string, Promise<Woordenlijst | null>>();

/** The word list of a package, checked once per process: a broken file fails the build, not a visitor. */
export function woordenlijst(bron: WoordenBron | undefined, taal: string): Promise<Woordenlijst | null> {
  if (!bron) return Promise.resolve(null);
  let lijst = geparst.get(taal);
  if (!lijst) {
    lijst = bron(taal).then((ruw) => (ruw ? Woordenlijst.parse(ruw) : null));
    geparst.set(taal, lijst);
  }
  return lijst;
}

/** "Check a word" (server): the page around the search, which runs in the browser. */
export function WoordenView({ ui, lijst, topics }: { ui: string; lijst: Woordenlijst; topics: Grammatica[] }) {
  const t = teksten(ui);
  const w = t.woorden;
  // From a word to the grammar: the first topic of its group (verbs: the present tense; nouns: the articles).
  const eerste = (groep: Grammatica["groep"]) => {
    const g = topics.find((x) => x.groep === groep);
    return g ? { href: grammaticaHref(ui, g.taal, g.slug), titel: tekstVoor(g.titel, ui) } : undefined;
  };
  // Polish: from a noun to the cases.
  const meer = { werkwoord: eerste("werkwoorden"), naamwoord: (lijst.taal === "pl" ? eerste("naamvallen") : undefined) ?? eerste("naamwoorden") };
  const aantal = Math.round((lijst.naamwoorden.length + lijst.werkwoorden.length) / 100) * 100;
  return (
    <div lang={ui} className="max-w-3xl">
      <Link href={topics.length > 0 ? grammaticaHref(ui, lijst.taal) : pakketHref(ui, lijst.taal)} className="text-sm text-muted hover:underline">
        ← {topics.length > 0 ? t.grammatica.alle : t.alleLessen}
      </Link>
      <p className="eyebrow mt-4">{t.pakket[lijst.taal] ?? lijst.taal}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{w.naam}</h1>
      <div className="mt-3 text-lg text-muted">
        <Markdown>{vul(lijst.taal === "pl" ? w.pools.intro : w.intro, { aantal })}</Markdown>
      </div>
      <div className="mt-6">
        <Woordzoeker lijst={lijst} labels={{ ...w, uitspreken: t.grammatica.uitspreken }} meer={meer} />
      </div>
      <p className="mt-10 text-xs text-muted">{vul(w.bron, { bron: lijst.bron })}</p>
    </div>
  );
}

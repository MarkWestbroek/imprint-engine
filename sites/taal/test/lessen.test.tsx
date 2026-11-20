import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { FileContentStore, type ContentRecord, type WritableContentStore } from "@imprint/content-core";
import { PageRenderer, type WidgetContext } from "@imprint/runtime-admin";
import { leesbaar, metVertaling, oefeningenVoor, taalPublicRoute, taalStaticPaths } from "@imprint/plugin-taal";
import { opnamen } from "@imprint/plugin-taal/audio";
import { widgetComponents } from "../src/widgets/components";
import { widgetRegistry } from "../src/widgets/registry";
import { TAAL } from "../imprint.config";
import { controleerLinks, leesGrammatica, leesLessen } from "../scripts/lessen-regels";
import { lidwoord, NederlandseWoordenlijst, PoolseWoordenlijst, zoek } from "@imprint/plugin-taal";
import woordenJson from "../woorden/nl.json";
import poolsJson from "../woorden/pl.json";
import poolseAanvullingen from "../woorden/pl-aanvullingen.json";
import aanvullingen from "../woorden/nl-aanvullingen.json";

/** The lesson files of this site are valid, and render through the plugin's route and the two widgets. */

const gelezen = leesLessen();
const gelezenGrammatica = leesGrammatica();
controleerLinks(gelezen, gelezenGrammatica);
const alleLessen = gelezen.flatMap((g) => (g.les ? [g.les] : []));
const alleGrammatica = gelezenGrammatica.flatMap((g) => (g.grammatica ? [g.grammatica] : []));
/** The package Dutch (for Polish and English readers) … */
const lessen = alleLessen.filter((l) => l.taal === "nl");
const grammatica = alleGrammatica.filter((g) => g.taal === "nl");
/** … and the package Polish (for Dutch readers). */
const pools = alleLessen.filter((l) => l.taal === "pl");
const poolseGrammatica = alleGrammatica.filter((g) => g.taal === "pl");
const fase0 = lessen.filter((l) => l.fase === 0);

/** The lessons as the store would hand them out. */
const store = {
  listItems: async (type: string) =>
    type === "les"
      ? alleLessen.map((l) => ({ slug: l.id, data: l }) as ContentRecord)
      : type === "grammatica"
        ? alleGrammatica.map((g) => ({ slug: g.id, data: g }) as ContentRecord)
        : [],
  getItem: async (_type: string, slug: string) => {
    const les = alleLessen.find((l) => l.id === slug);
    return les ? ({ slug, data: les } as ContentRecord) : null;
  },
} as unknown as WritableContentStore;

const route = taalPublicRoute(TAAL);
const visit = (slug: string) => route({ imprint: { writableStore: store } as never, slug: slug.split("/").filter(Boolean), members: false, session: null });

async function renderHtml(element: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(element);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

describe("taal: the lesson files", () => {
  it("all parse and follow the writing guide (SCHRIJFWIJZER.md)", () => {
    const fout = gelezen.filter((g) => g.fouten.length > 0).map((g) => `${g.file}: ${g.fouten.join("; ")}`);
    assert.deepEqual(fout, []);
  });

  it("with the grammar topics: all valid, every link from a lesson leads to one", () => {
    const fout = gelezenGrammatica.filter((g) => g.fouten.length > 0).map((g) => `${g.file}: ${g.fouten.join("; ")}`);
    assert.deepEqual(fout, []);
    assert.equal(grammatica.length, 23, "the reference: 17 rules and 6 differences");
    assert.equal(grammatica.filter((g) => g.soort === "verschil").length, 6);
    // A rule is for every reader; a difference is with one language (two of them with both).
    const leest = (ui: string) => grammatica.filter((g) => leesbaar(g, ui)).length;
    assert.deepEqual([leest("pl"), leest("en"), leest("nl")], [21, 21, 23]);
    // Every topic is reached from at least one lesson.
    for (const g of grammatica) assert.ok(lessen.some((l) => l.grammatica.includes(g.id)), `no lesson links to ${g.id}`);
    assert.ok(lessen.some((l) => l.grammatica.length > 0));
  });

  it("are the 45 lessons of the plan, in order, six phases", () => {
    assert.deepEqual(lessen.map((l) => l.id), [...lessen.map((l) => l.id)].sort(), "files sort like their ids");
    assert.deepEqual(fase0.map((l) => l.slug), ["dit-en-dat", "heeft-u", "misschien-te-genoeg", "betalen", "niet-verstaan"]);
    const perFase = [0, 1, 2, 3, 4, 5].map((f) => lessen.filter((l) => l.fase === f).length);
    assert.deepEqual(perFase, [5, 7, 8, 10, 10, 5]);
    assert.deepEqual(lessen.map((l) => Number(l.id.split("-")[2])), Array.from({ length: 45 }, (_, i) => i + 1));
    for (const l of lessen) {
      assert.equal(l.taal, "nl", l.id);
      assert.equal(l.steuntaal, "pl", l.id);
    }
  });

  it("has a second package: Polish for Dutch readers, 45 lessons of its own with a grammar", () => {
    const perFase = [0, 1, 2, 3, 4, 5].map((f) => pools.filter((l) => l.fase === f).length);
    assert.deepEqual(perFase, [5, 7, 8, 10, 10, 5]);
    assert.deepEqual(pools.map((l) => Number(l.id.split("-")[2])), Array.from({ length: 45 }, (_, i) => i + 1));
    for (const l of pools) {
      assert.equal(l.steuntaal, "nl", l.id);
      assert.ok(metVertaling(l, "nl"), l.id);
      assert.equal(oefeningenVoor(l, "nl").length, l.oefeningen.length, l.id);
      assert.ok(l.situatie.nl && l.patroon.nl, `${l.id}: situation and pattern from phase 0 on`);
      assert.ok(l.grammatica.length > 0, `${l.id}: no link to the grammar`);
    }
    assert.equal(new Set(pools.map((l) => l.slug)).size, 45);
    assert.equal(poolseGrammatica.length, 31);
    assert.equal(poolseGrammatica.filter((g) => g.soort === "verschil").length, 4);
    assert.equal(poolseGrammatica.filter((g) => g.groep === "naamvallen").length, 6);
    for (const g of poolseGrammatica) {
      assert.ok(leesbaar(g, "nl") && !leesbaar(g, "pl"), g.id);
      assert.ok(pools.some((l) => l.grammatica.includes(g.id)), `no lesson links to ${g.id}`);
    }
  });

  it("serve the English reader too: the translation, and as many exercises as the Polish reader gets", () => {
    for (const l of lessen) {
      assert.ok(metVertaling(l, "en"), l.id);
      assert.equal(oefeningenVoor(l, "en").length, l.oefeningen.length, l.id);
      // No Polish left in what the English reader is asked.
      for (const o of oefeningenVoor(l, "en")) {
        const tekst = "vraag" in o ? o.vraag : o.type === "luister" ? o.opties.join(" ") : "";
        assert.doesNotMatch(tekst, /[ąćęłńśźż{]/i, `${l.id}: ${tekst}`);
      }
    }
  });

  it("need a known number of recordings (what the first Audio run asks for)", () => {
    const uniek = new Map(lessen.flatMap((l) => opnamen(l).map((o) => [o.sleutel, o.text.length] as const)));
    const tekens = [...uniek.values()].reduce((a, b) => a + b, 0);
    assert.ok(uniek.size > 1000 && uniek.size < 2500, `${uniek.size} recordings`);
    assert.ok(tekens < 40000, `${tekens} characters`);
  });
});

describe("taal: the addresses", () => {
  it("lists every lesson in every interface language for the prerender", async () => {
    const paths = (await taalStaticPaths(store, TAAL)).map((p) => p.join("/"));
    // Per language: the package, the lessons, the grammar overview with the topics that reader can read, the words.
    const topics = TAAL.ui.reduce((n, ui) => n + grammatica.filter((g) => leesbaar(g, ui)).length, 0);
    const nederlands = TAAL.ui.length * (1 + lessen.length + 1 + 1) + topics;
    // The Polish package: its lessons and its word list in every language, its grammar for the Dutch reader only.
    const polski = TAAL.ui.length * (1 + pools.length + 1) + 1 + poolseGrammatica.length;
    assert.equal(paths.length, nederlands + polski);
    assert.ok(paths.includes("nl/polski/co-to-jest"));
    assert.ok(paths.includes("nl/polski/grammatica/naamvallen-overzicht"));
    assert.ok(!paths.includes("pl/polski/grammatica"));
    assert.ok(paths.includes("nl/polski/woorden"));
    assert.ok(paths.includes("en/nederlands/dit-en-dat"));
    assert.ok(paths.includes("en/nederlands/grammatica/geen-do-geen-ing"));
    assert.ok(!paths.includes("pl/nederlands/grammatica/geen-do-geen-ing"), "a difference with English is not for the Polish reader");
    assert.ok(!paths.includes("en/nederlands/grammatica/geen-naamvallen"));
    assert.ok(paths.includes("pl/nederlands/woorden"));
    assert.ok(paths.includes("pl/nederlands/grammatica"));
    assert.ok(paths.includes("nl/nederlands/grammatica/lidwoorden"));
    assert.ok(paths.includes("pl/nederlands"));
    assert.ok(paths.includes("pl/nederlands/dit-en-dat"));
    assert.ok(paths.includes("nl/nederlands/niet-verstaan"));
  });

  it("sends /pl to the package, and knows no other languages or packages", async () => {
    assert.deepEqual(await visit("pl"), { redirect: "/pl/nederlands" });
    assert.equal(await visit("de/nederlands"), null);
    assert.equal(await visit("pl/italiano"), null, "no Italian lessons");
    assert.equal(await visit("pl/nederlands/nope"), null);
    assert.equal(await visit("pl/nederlands/grammatica/nope"), null);
    assert.equal(await visit("pl/nederlands/dit-en-dat/meer"), null, "a lesson has nothing under it");
    assert.equal(await visit("o-metodzie"), null, "a page from the store, not the plugin's");
  });

  it("shows the overview in Polish, with a link per lesson", async () => {
    const hit = await visit("pl/nederlands");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Niderlandzki/);
    assert.match(html, /Etap/);
    for (const l of lessen) assert.ok(html.includes(`href="/pl/nederlands/${l.slug}"`), l.slug);
  });

  it("shows a lesson in Polish: dialogue with translation, chunks, all five exercises", async () => {
    const hit = await visit("pl/nederlands/dit-en-dat");
    assert.ok(hit && "render" in hit);
    assert.deepEqual(hit.item, { type: "les", slug: "nl-0-01" });
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Goedemiddag\. Wat is dit\?/);
    assert.match(html, /Dzień dobry\. Co to jest\?/);
    assert.match(html, /Zwroty/);
    assert.match(html, /Ćwiczenia/);
    assert.match(html, /1 \/ 5/);
    assert.match(html, /href="\/pl\/nederlands\/heeft-u"/, "the next lesson");
    assert.doesNotMatch(html, /Zauważyłeś/, "phase 0 has no pattern box");
    assert.match(html, /aria-label="Odtwórz: Dat is een peer\."/);
    assert.match(html, /aria-label="Powoli: Dat is een peer\."/);
  });

  it("shows the situation and the pattern of a phase-1 lesson, in the language of the interface", async () => {
    const pl = await visit("pl/nederlands/ik-ben");
    assert.ok(pl && "render" in pl);
    const html = await renderHtml(pl.render as ReactElement);
    assert.match(html, /Nowy sąsiad puka do drzwi/);
    assert.match(html, /Zauważyłeś\/aś\?/, "both forms until the learner chooses");
    assert.match(html, /aria-label="Formy:"/);
    assert.match(html, /<strong>ik ben<\/strong>/);
    const nl = await visit("nl/nederlands/ik-ben");
    assert.ok(nl && "render" in nl);
    const htmlNl = await renderHtml(nl.render as ReactElement);
    assert.match(htmlNl, /Een nieuwe buurman belt aan/);
    assert.match(htmlNl, /Zag je dat\?/);
    assert.doesNotMatch(htmlNl, /Nowy sąsiad/);
    assert.doesNotMatch(htmlNl, /Vormen:/, "Dutch has no forms to choose");
  });

  it("shows a lesson in English: the translation, the pattern, all the exercises, no forms to choose", async () => {
    const hit = await visit("en/nederlands/ik-ben-gegaan");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Ewa is thuisgebleven\./);
    assert.match(html, /Where have you been\?/);
    assert.match(html, /Did you see that\?/);
    assert.match(html, /More about this:/);
    assert.match(html, /href="\/en\/nederlands\/grammatica\/voltooide-tijd"/);
    assert.match(html, /1 \/ 8/);
    assert.doesNotMatch(html, /Gdzie byłeś|Forms:|[{}]/);
    assert.deepEqual(await visit("en"), { redirect: "/en/nederlands" }, "without the site's own front page");
  });

  it("shows both forms of a sentence that depends on the learner", async () => {
    const hit = await visit("pl/nederlands/ik-ben-gegaan");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Wróciłeś\/aś z Polski/);
    assert.doesNotMatch(html, /[{}]/);
  });

  it("shows the same lesson in Dutch without translations, with the exercises that need none", async () => {
    const hit = await visit("nl/nederlands/dit-en-dat");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Goedemiddag\. Wat is dit\?/);
    assert.doesNotMatch(html, /Co to jest/);
    assert.match(html, /1 \/ 2/);
    assert.match(html, /Brokken/);
  });
});

describe("taal: Polish for Dutch readers", () => {
  it("shows the overview and a lesson in Dutch: Polish to learn, Dutch around it", async () => {
    const overzicht = await visit("nl/polski");
    assert.ok(overzicht && "render" in overzicht);
    const lijst = await renderHtml(overzicht.render as ReactElement);
    assert.match(lijst, /Pools/);
    assert.match(lijst, /href="\/nl\/polski\/grammatica"/);
    for (const l of pools) assert.ok(lijst.includes(`href="/nl/polski/${l.slug}"`), l.slug);
    const hit = await visit("nl/polski/co-to-jest");
    assert.ok(hit && "render" in hit);
    assert.deepEqual(hit.item, { type: "les", slug: "pl-0-01" });
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Co to jest\?/);
    assert.match(html, /Zag je dat\?/, "a pattern from phase 0 on");
    assert.match(html, /Meer hierover:/);
    assert.match(html, /aria-label="Speel af: /);
    assert.match(html, new RegExp(`1 \\/ ${pools[0]!.oefeningen.length}`));
    assert.doesNotMatch(html, /Vormen:|[{}]/);
  });

  it("has a grammar with the cases as a group of their own, and the differences with Dutch", async () => {
    const hit = await visit("nl/polski/grammatica");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Naamvallen/);
    assert.match(html, /Verschillen met je eigen taal/);
    assert.match(html, /href="\/nl\/polski\/grammatica\/uitspraak-en-spelling"/);
    assert.equal(await visit("pl/polski/grammatica"), null, "written for the Dutch reader only");
    const topic = await visit("nl/polski/grammatica/accusatief");
    assert.ok(topic && "render" in topic);
    assert.match(await renderHtml(topic.render as ReactElement), /aria-label="Luister: /);
  });
});

describe("taal: the grammar reference", () => {
  it("lists the topics per group, the differences apart, with a link from the lessons overview", async () => {
    const hit = await visit("pl/nederlands/grammatica");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Gramatyka/);
    assert.match(html, /Czasowniki/);
    assert.match(html, /Inaczej niż po polsku/);
    assert.match(html, /href="\/pl\/nederlands\/grammatica\/tegenwoordige-tijd"/);
    const overzicht = await visit("pl/nederlands");
    assert.ok(overzicht && "render" in overzicht);
    assert.match(await renderHtml(overzicht.render as ReactElement), /href="\/pl\/nederlands\/grammatica"/);
  });

  it("shows a topic: the table, Dutch to listen to, how Polish does it, the lessons", async () => {
    const hit = await visit("pl/nederlands/grammatica/tegenwoordige-tijd");
    assert.ok(hit && "render" in hit);
    assert.deepEqual(hit.item, { type: "grammatica", slug: "nl-tegenwoordige-tijd" });
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /<table>/);
    assert.match(html, /aria-label="Posłuchaj: hij werkt"/);
    assert.match(html, /Inaczej niż po polsku/);
    assert.match(html, /href="\/pl\/nederlands\/ik-werk"/, "a lesson about it");
    assert.doesNotMatch(html, /De tegenwoordige tijd/, "not the Dutch text");
    const nl = await visit("nl/nederlands/grammatica/tegenwoordige-tijd");
    assert.ok(nl && "render" in nl);
    const htmlNl = await renderHtml(nl.render as ReactElement);
    assert.match(htmlNl, /De tegenwoordige tijd/);
    assert.doesNotMatch(htmlNl, /Inaczej|Anders dan/, "no difference for a Dutch reader");
  });

  it("explains in English against English: the overview, a rule with 'unlike in English', a difference of its own", async () => {
    const overzicht = await visit("en/nederlands/grammatica");
    assert.ok(overzicht && "render" in overzicht);
    const lijst = await renderHtml(overzicht.render as ReactElement);
    assert.match(lijst, /Differences from English/);
    assert.match(lijst, /href="\/en\/nederlands\/grammatica\/werkwoord-op-plaats-twee"/);
    assert.doesNotMatch(lijst, /geen-naamvallen/);
    const regel = await visit("en/nederlands/grammatica/tegenwoordige-tijd");
    assert.ok(regel && "render" in regel);
    const html = await renderHtml(regel.render as ReactElement);
    assert.match(html, /Unlike in English/);
    assert.match(html, /aria-label="Listen: hij werkt"/);
    assert.doesNotMatch(html, /po polsku/);
    assert.equal(await visit("en/nederlands/grammatica/geen-naamvallen"), null);
    assert.equal(await visit("pl/nederlands/grammatica/geen-do-geen-ing"), null);
  });

  it("links a lesson to its topic, under 'did you see that?'", async () => {
    const hit = await visit("pl/nederlands/ik-werk");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Więcej na ten temat:/);
    assert.match(html, /href="\/pl\/nederlands\/grammatica\/tegenwoordige-tijd"/);
  });
});

describe("taal: check a word", () => {
  const lijst = NederlandseWoordenlijst.parse(woordenJson);
  const nw = (w: string) => lijst.naamwoorden.find((n) => n.w === w);
  const ww = (w: string) => lijst.werkwoorden.find((v) => v.w === w);

  it("has a basic list of about B1: 2000 nouns and 450 verbs, each once", () => {
    assert.equal(lijst.naamwoorden.length, 2000);
    assert.equal(lijst.werkwoorden.length, 450);
    assert.equal(new Set(lijst.naamwoorden.map((n) => n.w)).size, 2000);
    assert.equal(new Set(lijst.werkwoorden.map((v) => v.w)).size, 450);
  });

  it("knows the basics right", () => {
    assert.deepEqual({ art: lidwoord(nw("huis")!.g).hoofd, mv: nw("huis")!.mv[0] }, { art: "het", mv: "huizen" });
    assert.equal(lidwoord(nw("tafel")!.g).hoofd, "de");
    assert.equal(lidwoord(nw("school")!.g).hoofd, "de");
    assert.equal(lidwoord(nw("hart")!.g).hoofd, "het");
    assert.deepEqual(ww("zijn")!.tt, ["ben", "bent", "is", "zijn"]);
    assert.deepEqual([ww("lopen")!.vt[0], ww("lopen")!.vd, ww("lopen")!.hulp], ["liep", "gelopen", "beide"]);
    assert.equal(ww("gaan")!.hulp, "zijn");
    assert.equal(ww("werken")!.sterk, false);
    assert.equal(ww("zeggen")!.sterk, true, "zei: mixed, so not regular");
    assert.deepEqual([ww("opstaan")!.tt[0], ww("opstaan")!.vd, ww("opstaan")!.hulp], ["sta op", "opgestaan", "zijn"]);
    assert.equal(ww("weglopen")?.hulp ?? "zijn", "zijn", "a separable verb of lopen says where to");
  });

  it("keeps out what the corrections leave out, and keeps what they keep", () => {
    const alle = new Set([...lijst.naamwoorden.map((n) => n.w), ...lijst.werkwoorden.map((v) => v.w)]);
    for (const w of aanvullingen.weg) assert.ok(!alle.has(w), w);
    for (const w of aanvullingen.houd) assert.ok(alle.has(w), w);
    // Counted for another word with the same form: the adverb niet, the plural dagen.
    for (const w of ["niet", "een", "voor"]) assert.ok(!nw(w), `noun ${w}`);
    for (const w of ["nieten", "dagen", "dingen"]) assert.ok(!ww(w), `verb ${w}`);
  });

  it("shows the page with the list and where it comes from", async () => {
    const hit = await visit("pl/nederlands/woorden");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Sprawdź słowo/);
    assert.match(html, /type="search"/);
    assert.match(html, /Wiktionary \(CC BY-SA 4\.0/);
    assert.equal(await visit("pl/nederlands/woorden/huis"), null);
    const overzicht = await visit("pl/nederlands/grammatica");
    assert.ok(overzicht && "render" in overzicht);
    assert.match(await renderHtml(overzicht.render as ReactElement), /href="\/pl\/nederlands\/woorden"/);
  });
});

describe("taal: check a Polish word", () => {
  const lijst = PoolseWoordenlijst.parse(poolsJson);
  const nw = (w: string) => lijst.naamwoorden.find((n) => n.w === w);
  const ww = (w: string) => lijst.werkwoorden.find((v) => v.w === w);
  const vind = (q: string) => zoek(lijst, q).map((t) => t.woord.w);

  it("has a basic list: about 2500 nouns and 700 verbs, each once", () => {
    assert.ok(lijst.naamwoorden.length >= 2500 && lijst.naamwoorden.length < 2700, `${lijst.naamwoorden.length} nouns`);
    assert.ok(lijst.werkwoorden.length >= 500 && lijst.werkwoorden.length < 800, `${lijst.werkwoorden.length} verbs`);
    assert.equal(new Set(lijst.naamwoorden.map((n) => n.w)).size, lijst.naamwoorden.length);
    assert.equal(new Set(lijst.werkwoorden.map((v) => v.w)).size, lijst.werkwoorden.length);
  });

  it("knows the basics right", () => {
    assert.deepEqual(nw("sklep")!.ev, ["sklep", "sklepu", "sklepowi", "sklep", "sklepem", "sklepie", "sklepie"]);
    assert.deepEqual([nw("torba")!.g, nw("torba")!.ev[3], nw("torba")!.ev[4]], ["f", "torbę", "torbą"]);
    assert.deepEqual([nw("brat")!.ev[3], nw("brat")!.mv[0]], ["brata", "bracia"], "a man: accusative like the genitive");
    assert.deepEqual([nw("drzwi")!.g, nw("drzwi")!.ev.length], ["p", 0], "plural only");
    assert.equal(nw("pani")!.ev[3], "panią");
    assert.deepEqual(ww("być")!.tt, ["jestem", "jesteś", "jest", "jesteśmy", "jesteście", "są"]);
    assert.deepEqual(ww("iść")!.vt.slice(0, 4), ["szedłem", "szłam", "szedł", "szła"]);
    assert.deepEqual([ww("robić")!.asp, ww("robić")!.paar, ww("zrobić")!.asp, ww("zrobić")!.paar], ["ndk", ["zrobić"], "dk", ["robić"]]);
    assert.deepEqual([ww("bać")!.sie, ww("bać")!.tt[0]], [true, "boję"]);
    assert.equal(ww("móc")!.vt[2], "mógł");
  });

  it("finds a word by any form, with or without Polish letters", () => {
    assert.equal(vind("sklepie")[0], "sklep");
    assert.equal(vind("poszlam")[0], "pójść");
    assert.equal(vind("bylam")[0], "być");
    assert.equal(vind("drzwiami")[0], "drzwi");
    assert.equal(vind("kupilem")[0], "kupić");
  });

  it("links every partner to a verb in the list, and has the words of the lessons", () => {
    const werkwoorden = new Set(lijst.werkwoorden.map((v) => v.w));
    for (const v of lijst.werkwoorden) for (const p of v.paar) assert.ok(werkwoorden.has(p), `${v.w} → ${p}`);
    for (const w of ["chleb", "klucz", "jabłko", "bankomat", "peron", "piekarnia"]) assert.ok(nw(w), w);
    for (const w of ["mieszkać", "pracować", "kupić", "chcieć", "jechać"]) assert.ok(ww(w), w);
  });

  it("keeps out what the corrections leave out, and keeps what they keep", () => {
    const alle = new Set([...lijst.naamwoorden.map((n) => n.w), ...lijst.werkwoorden.map((v) => v.w)]);
    for (const w of poolseAanvullingen.weg) assert.ok(!alle.has(w), w);
    for (const w of poolseAanvullingen.houd) assert.ok(alle.has(w), w);
    // Counted for another word with the same form: the particle nie, the pronoun to, the preposition bez.
    for (const w of ["nie", "to", "bez", "jak", "miał"]) assert.ok(!nw(w), `noun ${w}`);
  });

  it("shows the page in Dutch, with a link from the grammar", async () => {
    const hit = await visit("nl/polski/woorden");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Zoek een woord/);
    assert.match(html, /Typ een Pools zelfstandig naamwoord/);
    assert.match(html, /placeholder="bijv\. sklep/);
    assert.match(html, /Wiktionary \(CC BY-SA 4\.0/);
    const overzicht = await visit("nl/polski/grammatica");
    assert.ok(overzicht && "render" in overzicht);
    assert.match(await renderHtml(overzicht.render as ReactElement), /href="\/nl\/polski\/woorden"/);
  });
});

describe("taal: the widgets on a page", () => {
  const ctx: WidgetContext = { store: new FileContentStore(path.resolve(import.meta.dirname, "../content"), { widgets: widgetRegistry }), writableStore: store, readOptions: {} };

  it("render the dialogue and the exercises of a lesson by id", async () => {
    const layout = { rows: [{ cells: [{ span: 1, widgets: [{ type: "lesdialoog", config: { les: "nl-0-04" } }, { type: "oefeningen", config: { les: "nl-0-04" } }] }] }] };
    const html = await renderHtml(
      <PageRenderer page={{ slug: "proef", title: "", layout } as never} viewers={widgetComponents} ctx={ctx} />
    );
    assert.match(html, /Kan ik pinnen\?/);
    assert.match(html, /Czy mogę zapłacić kartą\?/);
    assert.match(html, /1 \/ \d/);
  });

  it("say so when the lesson does not exist", async () => {
    const layout = { rows: [{ cells: [{ span: 1, widgets: [{ type: "lesdialoog", config: { les: "nope", ui: "", brokken: true } }] }] }] };
    const html = await renderHtml(<PageRenderer page={{ slug: "proef", title: "", layout } as never} viewers={widgetComponents} ctx={ctx} />);
    assert.match(html, /No lesson/);
  });

  it("render the front page: the hero, and 'continue' pointing at lesson 1 before anything is done", async () => {
    const page = await ctx.store.getPage("home");
    assert.ok(page?.layout);
    const html = await renderHtml(<PageRenderer page={page as never} viewers={widgetComponents} ctx={ctx} />);
    assert.match(html, /od pierwszego zdania/);
    assert.match(html, /Zacznij od lekcji 1/);
    assert.match(html, /href="\/pl\/nederlands\/dit-en-dat"/);
    assert.match(html, /Sześć etapów/);
  });

  it("has valid starting content: the menu and its page", async () => {
    const menu = await ctx.store.getMenu("main");
    assert.ok(menu && menu.items.length === 4);
    assert.ok(await ctx.store.getPage("o-metodzie"));
  });
});

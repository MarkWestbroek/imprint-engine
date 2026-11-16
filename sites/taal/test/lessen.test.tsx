import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { FileContentStore, type ContentRecord, type WritableContentStore } from "@imprint/content-core";
import { PageRenderer, type WidgetContext } from "@imprint/runtime-admin";
import { taalPublicRoute, taalStaticPaths } from "@imprint/plugin-taal";
import { opnamen } from "@imprint/plugin-taal/audio";
import { widgetComponents } from "../src/widgets/components";
import { widgetRegistry } from "../src/widgets/registry";
import { TAAL } from "../imprint.config";
import { controleerLinks, leesGrammatica, leesLessen } from "../scripts/lessen-regels";
import { lidwoord, Woordenlijst } from "@imprint/plugin-taal";
import woordenJson from "../woorden/nl.json";
import aanvullingen from "../woorden/nl-aanvullingen.json";

/** The lesson files of this site are valid, and render through the plugin's route and the two widgets. */

const gelezen = leesLessen();
const gelezenGrammatica = leesGrammatica();
controleerLinks(gelezen, gelezenGrammatica);
const lessen = gelezen.flatMap((g) => (g.les ? [g.les] : []));
const grammatica = gelezenGrammatica.flatMap((g) => (g.grammatica ? [g.grammatica] : []));
const fase0 = lessen.filter((l) => l.fase === 0);

/** The lessons as the store would hand them out. */
const store = {
  listItems: async (type: string) =>
    type === "les"
      ? lessen.map((l) => ({ slug: l.id, data: l }) as ContentRecord)
      : type === "grammatica"
        ? grammatica.map((g) => ({ slug: g.id, data: g }) as ContentRecord)
        : [],
  getItem: async (_type: string, slug: string) => {
    const les = lessen.find((l) => l.id === slug);
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
    assert.equal(grammatica.length, 21, "the reference: 17 rules and 4 differences");
    assert.equal(grammatica.filter((g) => g.soort === "verschil").length, 4);
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

  it("need a known number of recordings (what the first Audio run asks for)", () => {
    const uniek = new Map(lessen.flatMap((l) => opnamen(l).map((o) => [o.sleutel, o.text.length] as const)));
    const tekens = [...uniek.values()].reduce((a, b) => a + b, 0);
    assert.ok(uniek.size > 1000 && uniek.size < 2500, `${uniek.size} recordings`);
    assert.ok(tekens < 40000, `${tekens} characters`);
  });
});

describe("taal: the addresses", () => {
  it("lists every lesson in both interface languages for the prerender", async () => {
    const paths = (await taalStaticPaths(store, TAAL)).map((p) => p.join("/"));
    assert.equal(paths.length, 2 * (1 + lessen.length + 1 + grammatica.length + 1));
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
    assert.equal(await visit("pl/polski"), null, "no Polish lessons yet");
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

  it("links a lesson to its topic, under 'did you see that?'", async () => {
    const hit = await visit("pl/nederlands/ik-werk");
    assert.ok(hit && "render" in hit);
    const html = await renderHtml(hit.render as ReactElement);
    assert.match(html, /Więcej na ten temat:/);
    assert.match(html, /href="\/pl\/nederlands\/grammatica\/tegenwoordige-tijd"/);
  });
});

describe("taal: check a word", () => {
  const lijst = Woordenlijst.parse(woordenJson);
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

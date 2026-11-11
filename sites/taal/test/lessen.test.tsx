import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";

import { FileContentStore, type ContentRecord, type WritableContentStore } from "@imprint/content-core";
import { PageRenderer, type WidgetContext } from "@imprint/runtime-admin";
import { taalPublicRoute, taalStaticPaths } from "@imprint/plugin-taal";
import { opnamen } from "@imprint/plugin-taal/audio";
import { parseLes } from "@imprint/plugin-taal/import";
import { widgetComponents } from "../src/widgets/components";
import { widgetRegistry } from "../src/widgets/registry";
import { TAAL } from "../imprint.config";

/** The lesson files of this site are valid, and render through the plugin's route and the two widgets. */

const LESSEN = path.resolve(import.meta.dirname, "../lessen");
const files = (readdirSync(LESSEN, { recursive: true }) as string[]).filter((f) => f.endsWith(".md")).sort();
const lessen = files.map((f) => parseLes(f, readFileSync(path.join(LESSEN, f), "utf8")));

/** The lessons as the store would hand them out. */
const store = {
  listItems: async (type: string) => (type === "les" ? lessen.map((l) => ({ slug: l.id, data: l }) as ContentRecord) : []),
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
  it("are five valid lessons of phase 0, Dutch with Polish beside it", () => {
    assert.deepEqual(lessen.map((l) => l.id), ["nl-0-01", "nl-0-02", "nl-0-03", "nl-0-04", "nl-0-05"]);
    assert.deepEqual(lessen.map((l) => l.slug), ["dit-en-dat", "heeft-u", "misschien-te-genoeg", "betalen", "niet-verstaan"]);
    for (const l of lessen) {
      assert.equal(l.taal, "nl");
      assert.equal(l.steuntaal, "pl");
      assert.equal(l.fase, 0);
      assert.ok(l.dialoog.every((r) => r.nl && r.pl), `${l.id}: every line in both languages`);
      assert.ok(l.oefeningen.length >= 4, l.id);
      assert.ok(l.ombouwen, l.id);
    }
    const types = new Set(lessen.flatMap((l) => l.oefeningen.map((o) => o.type)));
    assert.deepEqual([...types].sort(), ["kies", "luister", "orden", "typ", "zeg"]);
  });

  it("need a known number of recordings (what the first Audio run asks for)", () => {
    const keys = new Set(lessen.flatMap((l) => opnamen(l).map((o) => o.sleutel)));
    const tekens = [...new Map(lessen.flatMap((l) => opnamen(l).map((o) => [o.sleutel, o.text.length] as const))).values()].reduce((a, b) => a + b, 0);
    assert.ok(keys.size > 100 && keys.size < 200, `${keys.size} recordings`);
    assert.ok(tekens < 5000, `${tekens} characters`);
  });
});

describe("taal: the addresses", () => {
  it("lists every lesson in both interface languages for the prerender", async () => {
    const paths = (await taalStaticPaths(store, TAAL)).map((p) => p.join("/"));
    assert.equal(paths.length, 2 * (1 + lessen.length));
    assert.ok(paths.includes("pl/nederlands"));
    assert.ok(paths.includes("pl/nederlands/dit-en-dat"));
    assert.ok(paths.includes("nl/nederlands/niet-verstaan"));
  });

  it("sends /pl to the package, and knows no other languages or packages", async () => {
    assert.deepEqual(await visit("pl"), { redirect: "/pl/nederlands" });
    assert.equal(await visit("de/nederlands"), null);
    assert.equal(await visit("pl/polski"), null, "no Polish lessons yet");
    assert.equal(await visit("pl/nederlands/nope"), null);
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
    assert.match(html, /aria-label="Odtwórz: Dat is een peer\."/);
    assert.match(html, /aria-label="Powoli: Dat is een peer\."/);
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

  it("has valid starting content: the menu and its page", async () => {
    const menu = await ctx.store.getMenu("main");
    assert.ok(menu && menu.items.length === 2);
    assert.ok(await ctx.store.getPage("o-metodzie"));
  });
});

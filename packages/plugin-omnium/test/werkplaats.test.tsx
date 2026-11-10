import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, test } from "node:test";
import type { ReactElement } from "react";
import { createMemoryDb, MemoryContentStore } from "@imprint/content-core/memory-store";
import type { WidgetContext } from "@imprint/runtime-admin";
import { omniumPage } from "../src/page";
import { omniumViewers } from "../src/widgets";

/**
 * The werkplaats of an e-dienstversie (werkplaats-plan, Fase A), against the fixture.
 * built-in view (no studio template in the store), links by key, the
 * relation's fields, and a 401 that says so.
 */

const dir = path.join(import.meta.dirname, "fixture", "full");
let token = "omt_ok";

before(() => {
  process.env.OMNIUM_REGISTER_URL = "http://register.test";
  process.env.OMNIUM_REGISTER_TOKEN = "omt_ok";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const auth = ((init?.headers ?? {}) as Record<string, string>).authorization;
    if (auth !== `Bearer ${token}`) return new Response(JSON.stringify({ error: "Authenticatie vereist." }), { status: 401 });
    const pad = new URL(String(input)).pathname.split("/")[2]!;
    const rows = JSON.parse(readFileSync(path.join(dir, `${pad}.json`), "utf8"));
    return new Response(JSON.stringify({ [pad]: rows, page: 1, size: 500, has_more: false }));
  }) as typeof fetch;
});

async function html(element: ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import("react-dom/static");
  const errors: unknown[] = [];
  const { prelude } = await prerenderToNodeStream(element, { onError: (e) => void errors.push(e) });
  let out = "";
  for await (const chunk of prelude) out += chunk;
  if (errors.length) throw errors[0];
  return out;
}

const ctx = (): WidgetContext => {
  const store = new MemoryContentStore(createMemoryDb());
  return { store, writableStore: store, readOptions: {} };
};

const base = ["ediensten", "gehandicaptenparkeerkaart-aanvragen", "versies", "0.1.0", "werkplaats"];

const page = async (stap?: string, vraag?: string) => {
  const p = await omniumPage({ path: stap === undefined ? base : [...base, stap], viewers: omniumViewers, ctx: ctx(), vraag });
  return p && { title: p.title, html: (await html(p.render as ReactElement)).replaceAll("<!-- -->", "") };
};
const text = (h: string) => h.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("werkplaats: under the version's key path, the step in the URL, crumbs back to the version; an unknown step is a 404", async () => {
  const p = await page("velden");
  assert.ok(p);
  assert.equal(p.title, "Werkplaats Gehandicaptenparkeerkaart aanvragen 0.1.0");
  assert.match(p.html, /href="\/inrichting\/ediensten\/gehandicaptenparkeerkaart-aanvragen\/versies\/0.1.0"/); // crumb to the version
  assert.match(p.html, /aria-current="step"[^>]*>[\s\S]*?Velden en vragen/);
  assert.ok((await page())!.html.includes('aria-current="step"'), "without a step: the default step");
  assert.equal(await page("onbekend"), null);
});

test("werkplaats: the stappenbalk is derived from the register (no catalogue yet for steps 1-2)", async () => {
  const h = (await page("velden"))!.html;
  // Each step link: its title (the derived state), then its text.
  const stap = (titel: string) => [...h.matchAll(/<a[^>]*title="([^"]*)"[^>]*>(.*?)<\/a>/g)].find((m) => m[2]!.includes(titel))?.[1];
  assert.match(stap("Basis kiezen")!, /nog geen catalogus/);
  assert.match(stap("Genereren")!, /In het register aanwezig/); // there are results
  assert.match(stap("Uitrollen")!, /In het register aanwezig/); // a geslaagde uitrol
  assert.match(stap("Proces en regels")!, /Nog niet/); // no BPMN or DMN in the fixture
});

test("werkplaats step 3: the questions, the uitsnede from bronElementId, the form as the resident sees it, and what a question touches", async () => {
  const h = (await page("velden", "soort"))!.html;
  const t = text(h);
  assert.match(t, /Welke kaart vraagt u aan\? verplicht soort · keuzerondjes uit Kaart\.soort/);
  assert.match(t, /alleen als soort = bestuurder/);
  assert.match(h, /href="[^"]*\/werkplaats\/velden\?vraag=kenteken"/); // a question selects
  // The uitsnede: the element the traceregels point at, with its fields, and a button for the whole set.
  assert.match(t, /Gpk Kaart kenteken · soort/);
  assert.match(t, /Toon in diagram:/);
  // The effect: the form rendered by Imprint (radio buttons), the selected question highlighted.
  assert.match(h, /type="radio"[^>]*value="bestuurder"/);
  assert.match(h, /bg-yellow-100[^"]*"[^>]*>[\s\S]{0,400}Welke kaart vraagt u aan/);
  assert.match(t, /Deze keuze raakt \(Kaart\.soort\) Formulier GPK-aanvraag · formulier/);
  assert.match(t, /Open in Open Formulieren/);
});

test("werkplaats steps 6 and 7: results per component, the uitrol and what runs; step 1 says it cannot yet", async () => {
  assert.match(text((await page("genereren"))!.html), /2 artefacten gegenereerd[\s\S]*openformulieren Formulier GPK-aanvraag formulier[\s\S]*nog geen vorige inhoud/);
  assert.match(text((await page("uitrollen"))!.html), /Uitrol 2026-11-05T10:00:00Z geslaagd[\s\S]*Open Zaak: 1\.31\.0 \(cg-test\)/);
  assert.match(text((await page("basis"))!.html), /Deze stap kan nog niet/);
});

test("the version page links to its werkplaats", async () => {
  const p = await omniumPage({ path: base.slice(0, 4), viewers: omniumViewers, ctx: ctx() });
  assert.match(await html(p!.render as ReactElement), /href="\/inrichting\/ediensten\/gehandicaptenparkeerkaart-aanvragen\/versies\/0.1.0\/werkplaats"/);
});

test("werkplaats: the uitsnede shows what the e-dienstmodel chose and left out (its traceregels gekozen/weggelaten)", async () => {
  const h = (await page("velden"))!.html;
  const t = text(h);
  assert.match(t, /Model van deze dienst 1 velden gekozen · 2 weggelaten/);
  assert.match(h, /<s>geldigTot<\/s>/); // a left-out field of a used element, struck through
  assert.match(h, /line-through[^"]*"[^>]*>[\s\S]{0,300}Ander/); // an element left out entirely
  assert.match(t, /Doorgestreept: wel in het model, door deze dienst weggelaten/);
});

test("werkplaats (Mark 9-11): says it is view-only, lists what the model has but the form leaves out, and shows conditional questions greyed with when they appear", async () => {
  const t = text((await page("velden"))!.html);
  assert.match(t, /Alleen bekijken\. Kiezen en wijzigen komt in een volgende versie/);
  assert.match(t, /Klik op een vraag om te zien wat hij raakt/);
  assert.match(t, /Niet in het formulier 2 velden staan wel in het model/);
  assert.match(t, /Ander : x Gpk › Kaart : geldigTot/); // sorted by name
  // Kenteken only shows for a bestuurder: at rest it is there, greyed, with its condition.
  assert.match(t, /Verschijnt als “Welke kaart vraagt u aan\?” = Bestuurder Kenteken/);
});

test("werkplaats step 6: results grouped by generation (ArtefactHerkomst.generatie), unlabeled last", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const res = await real(input, init);
    if (!String(input).includes("/full/artefacten")) return res;
    const body = (await res.json()) as { artefacten: Record<string, unknown>[] };
    const form = body.artefacten.find((a) => a.id === 3)!;
    const v = { artefact_id: 3, rel_id: 9, versie: 1, opvoer: "2026-11-09T10:00:00Z", generatie: "2026-11-09a", totVolgnummer: 4473, regelsetId: "canoniek-naar-formulier" };
    form.artefact_herkomsten = [{ artefact_id: 3, rel_id: 9, opvoer: v.opvoer, data: [v] }];
    return new Response(JSON.stringify(body));
  }) as typeof fetch;
  try {
    const t = text((await page("genereren"))!.html);
    assert.match(t, /Generatie 2026-11-09a · 1 artefacten · uit de Studio tot op wijziging 4473 openformulieren Formulier GPK-aanvraag/);
    assert.match(t, /Zonder generatielabel · 1 artefacten openzaak Zaaktype Aanvraag/);
    assert.match(t, /Generatie 2026-11-09a is de eerste met een label/);
  } finally {
    globalThis.fetch = real;
  }
});

test("uitrollen: newest first (Mark 10-11)", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const res = await real(input, init);
    if (!String(input).includes("/full/uitrollen")) return res;
    const body = (await res.json()) as { uitrollen: Record<string, unknown>[] };
    const later = JSON.parse(JSON.stringify(body.uitrollen[0]).replaceAll("2026-11-05T10:00:0", "2026-11-07T09:00:0"));
    later.id = 99;
    body.uitrollen.push(later);
    return new Response(JSON.stringify(body));
  }) as typeof fetch;
  try {
    const t = text((await page("uitrollen"))!.html);
    assert.match(t, /Uitrol 2026-11-07T09:00:0\dZ[\s\S]*Uitrol 2026-11-05T10:00:00Z/);
  } finally {
    globalThis.fetch = real;
  }
});

test("werkplaats step 3, edit mode (laag 1): says nothing is saved, the questions get controls, the preview stays", async () => {
  const view = (await page("velden"))!.html;
  assert.match(view, /href="[^"]*\/werkplaats\/velden\?bewerk=1"/); // the way in
  const p = await omniumPage({ path: [...base, "velden"], viewers: omniumViewers, ctx: ctx(), bewerk: true });
  const h = (await html(p!.render as ReactElement)).replaceAll("<!-- -->", "");
  const t = text(h);
  assert.match(t, /Proefbewerken\. Je wijzigt een kopie in je browser: er wordt niets opgeslagen/);
  assert.match(h, /aria-label="kenteken omhoog"/);
  assert.match(h, /aria-label="soort weglaten"/);
  assert.match(t, /Wijzigingen \(0\) Nog niets gewijzigd/);
  assert.match(h, /type="radio"[^>]*value="bestuurder"/); // the preview
});

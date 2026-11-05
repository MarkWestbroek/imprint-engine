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
 * The page of a register record end to end, against the fixture: the
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

test("an uitrol: crumbs, the record, the results with their actions and a link to each artefact", async () => {
  const page = await omniumPage({
    path: ["ediensten", "Gehandicaptenparkeerkaart aanvragen", "versies", "0.1.0", "uitrollen", "2026-11-05T10:00:00Z"],
    viewers: omniumViewers,
    ctx: ctx(),
  });
  assert.ok(page);
  const out = await html(page.render as ReactElement);
  assert.match(out, /Uitrol 2026-11-05T10:00:00Z/);
  assert.match(out, /href="\/inrichting\/ediensten\/Gehandicaptenparkeerkaart%20aanvragen\/versies\/0.1.0"/);
  assert.match(out, /href="\/inrichting\/artefacten\/zaaktype\/openzaak\/aanvraag"/);
  assert.match(out, /aangemaakt/);
  assert.match(out, /href="https:\/\/openzaak.example\/zaaktypen\/1"/);
});

test("an e-dienstversie lists its artefacts and uitrollen; a withdrawn traceregel stays away", async () => {
  const page = await omniumPage({ path: ["ediensten", "Gehandicaptenparkeerkaart aanvragen", "versies", "0.1.0"], viewers: omniumViewers, ctx: ctx() });
  const out = await html(page!.render as ReactElement);
  assert.match(out, /Formulier GPK-aanvraag/);
  assert.match(out, /Zaaktype Aanvraag/);
  assert.doesNotMatch(out, /Objecttype Aanvraag/); // belongs to the other e-dienst
  const art = await omniumPage({ path: ["artefacten", "formulier", "openformulieren", "gpk-aanvraag"], viewers: omniumViewers, ctx: ctx() });
  const a = await html(art!.render as ReactElement);
  assert.match(a, /Aanvraag\.kenteken/);
  assert.doesNotMatch(a, /Aanvraag\.oud/);
});

test("sources: under the version (no component), with their drawings; results without them", async () => {
  const v = await html(
    (await omniumPage({ path: ["ediensten", "gehandicaptenparkeerkaart-aanvragen", "versies", "0.1.0"], viewers: omniumViewers, ctx: ctx() }))!
      .render as ReactElement
  );
  const bronnen = v.slice(v.indexOf(">Bronnen<"));
  const resultaten = v.slice(v.indexOf(">Resultaten<"), v.indexOf(">Bronnen<"));
  assert.match(bronnen, /href="\/inrichting\/ediensten\/gehandicaptenparkeerkaart-aanvragen\/versies\/0.1.0\/bronnen\/logisch-model\/gehandicaptenparkeerkaart-aanvragen"/);
  assert.match(bronnen, /bronnen\/diagram-weergave\/gehandicaptenparkeerkaart-aanvragen.logisch-model.overzicht"[^>]*>Overzicht</);
  assert.doesNotMatch(resultaten, /Logisch model GPK|Overzicht/);
});

test("a drawing renders inline, sanitised; a generated artefact links to its source", async () => {
  const t = await html(
    (await omniumPage({
      path: ["ediensten", "gehandicaptenparkeerkaart-aanvragen", "versies", "0.1.0", "bronnen", "diagram-weergave", "gehandicaptenparkeerkaart-aanvragen.logisch-model.overzicht"],
      viewers: omniumViewers,
      ctx: ctx(),
    }))!.render as ReactElement
  );
  assert.match(t, /<svg[^>]*viewBox="0 0 10 10"/);
  assert.doesNotMatch(t, /<script>alert|data-render-versie/);
  assert.match(t, /Getekend door render (<!-- -->)?0.3.0/);
  assert.doesNotMatch(t, /Payload \(/); // the SVG text is not shown again as data
  const form = await html((await omniumPage({ path: ["artefacten", "formulier", "openformulieren", "gpk-aanvraag"], viewers: omniumViewers, ctx: ctx() }))!.render as ReactElement);
  assert.match(form, /href="\/inrichting\/ediensten\/gehandicaptenparkeerkaart-aanvragen\/versies\/0.1.0\/bronnen\/logisch-model\/[^"]*"[^>]*>Logisch model GPK</);
});

test("a form links to its live page: the host of the uitrol, the slug of the form (else the identifier)", async () => {
  const form = await html((await omniumPage({ path: ["artefacten", "formulier", "openformulieren", "gpk-aanvraag"], viewers: omniumViewers, ctx: ctx() }))!.render as ReactElement);
  assert.match(form, /href="https:\/\/formulieren.example\/gpk-aanvraag\/"/);
});

test("a JSON payload is a tree you can fold open, not a wall of text", async () => {
  const page = (await html((await omniumPage({ path: ["artefacten", "zaaktype", "openzaak", "aanvraag"], viewers: omniumViewers, ctx: ctx() }))!.render as ReactElement)).replaceAll("<!-- -->", "");
  assert.match(page, /Payload \(JSON, \d+ tekens\)/);
  assert.match(page, /<details open=""[^>]*><summary[^>]*><span class="text-muted">\{1\}<\/span><\/summary>/);
  assert.match(page, /<span class="text-muted">omschrijving: <\/span>/);
});

test("a form: per step the questions, where each comes from in the model and goes in the objecttype", async () => {
  const out = (await html((await omniumPage({ path: ["artefacten", "formulier", "openformulieren", "gpk-aanvraag"], viewers: omniumViewers, ctx: ctx() }))!.render as ReactElement)).replaceAll("<!-- -->", "");
  assert.match(out, /Stap 1: Soort kaart/);
  assert.match(out, /Welke kaart vraagt u aan\?<\/span><\/td><td[^>]*><code[^>]*>soort<\/code><\/td><td[^>]*>keuzerondjes<\/td><td[^>]*>ja<\/td><td[^>]*>Bestuurder, Passagier/);
  assert.match(out, /alleen als soort = bestuurder/);
  assert.match(out, /<code class="[^"]*">Gpk.Kaart.kenteken<\/code>/);
  assert.match(out, /<code class="[^"]*">data.kaart.kenteken<\/code>/);
  assert.match(out, /Ook naar het objecttype/);
  assert.match(out, /vast_status/);
  assert.match(out, /Bij afronden: ingediendOp = now/);
});

test("unknown key: null (the site answers 404); refused token: a visible message", async () => {
  assert.equal(await omniumPage({ path: ["ediensten", "Bestaat niet"], viewers: omniumViewers, ctx: ctx() }), null);
  token = "omt_new";
  const page = await omniumPage({ path: ["ediensten", "Aanvraag (voorbeeld)"], viewers: omniumViewers, ctx: ctx() });
  token = "omt_ok";
  assert.match(await html(page!.render as ReactElement), /weigert het leestoken/);
});

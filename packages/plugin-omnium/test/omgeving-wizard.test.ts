import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { OmniumRegister } from "../src/client";
import { Inrichting } from "../src/inrichting";
import { herken, inrichtingstool, namespaces, scan, type ScanComponent } from "../src/omgeving-scan";
import { bestaandeKoppelingen, kaartenPerLaag, LAAG_ONBEKEND, opnameGegevens } from "../src/omgeving-wizard";
import { lijnenVan } from "../src/omgeving-lijnen";

const dir = path.join(import.meta.dirname, "fixture", "full");
const registerFetch = (async (input: string | URL | Request) => {
  const pad = new URL(String(input)).pathname.split("/")[2]!;
  return new Response(JSON.stringify({ [pad]: JSON.parse(readFileSync(path.join(dir, `${pad}.json`), "utf8")), has_more: false }));
}) as typeof fetch;
const inrichting = () => new Inrichting(new OmniumRegister({ baseUrl: "http://register.test", fetch: registerFetch }));

const sc = (x: Partial<ScanComponent>): ScanComponent => ({ namespace: "tnt-x", naam: "x", bron: "deployment", herkend: null, bereikbaar: null, ...x });

test("herkennen: the plugin's verdict when the register has that component; else by name, chart or image name; else nothing", () => {
  const namen = ["openzaak", "openforms"];
  assert.equal(herken(sc({ herkend: { componentNaam: "openzaak" } }), namen), "openzaak");
  assert.equal(herken(sc({ herkend: { componentNaam: "keycloak" } }), namen), undefined, "recognised, not in the register");
  assert.equal(herken(sc({ naam: "open-forms" }), namen), "openforms");
  assert.equal(herken(sc({ image: "openzaak/open-zaak:1.31.2" }), namen), "openzaak");
  assert.equal(herken(sc({ naam: "mailpit", image: "axllent/mailpit:v1" }), namen), undefined);
  assert.equal(herken(sc({ image: "maykinmedia/openzaak:1.31.2" }), namen), "openzaak");
});

test("without a scan endpoint: the example from the register (omgevingen as namespaces), labelled; cards per layer, unrecognised last", async () => {
  delete process.env.SCAN_URL;
  delete process.env.SCAN_OPNAME;
  const i = inrichting();
  const ns = await namespaces(i);
  assert.equal(ns.voorbeeld, true);
  const s = await scan(i, ["*"]);
  assert.equal(s.voorbeeld, true);
  const lagen = await kaartenPerLaag(i, s);
  assert.equal(lagen.at(-1)!.laag, LAAG_ONBEKEND);
  assert.ok(lagen.flatMap((l) => l.kaarten).some((k) => k.component?.naam === "openzaak"));
});

test("a recorded scan (SCAN_OPNAME): its namespaces, filtered per chosen namespace, still labelled as not live", async () => {
  delete process.env.SCAN_URL;
  const f = path.join(mkdtempSync(path.join(tmpdir(), "scan-")), "scan.json");
  writeFileSync(
    f,
    JSON.stringify({
      gescandOp: "2026-11-24T23:36:37Z",
      namespaces: ["tnt-a", "tnt-b"],
      componenten: [sc({ namespace: "tnt-a", naam: "openzaak", herkend: { componentNaam: "openzaak" } }), sc({ namespace: "tnt-b", naam: "mailpit" })],
    })
  );
  process.env.SCAN_OPNAME = f;
  try {
    const i = inrichting();
    assert.deepEqual((await namespaces(i)).namen.map((n) => n.naam), ["tnt-a", "tnt-b"]);
    const s = await scan(i, ["tnt-a"]);
    assert.deepEqual([s.voorbeeld, s.opgenomen, s.componenten.map((c) => c.naam)], [true, "2026-11-24T23:36:37Z", ["openzaak"]]);
  } finally {
    delete process.env.SCAN_OPNAME;
  }
});

test("existing links: every generated artefact with a target component, model side → component", async () => {
  const k = await bestaandeKoppelingen(inrichting());
  assert.ok(k.length > 0);
  assert.ok(k.every((x) => x.doel.component && x.naam));
});

test("live scan configured but not answering: the recording as fallback, still labelled, with the error", async () => {
  const f = path.join(mkdtempSync(path.join(tmpdir(), "scan-")), "scan.json");
  writeFileSync(f, JSON.stringify({ gescandOp: "2026-11-24T23:36:37Z", namespaces: ["tnt-a"], componenten: [sc({ namespace: "tnt-a", naam: "openzaak" })] }));
  process.env.SCAN_URL = "http://127.0.0.1:1";
  process.env.SCAN_OPNAME = f;
  try {
    const i = inrichting();
    const ns = await namespaces(i);
    assert.deepEqual([ns.voorbeeld, ns.namen.map((n) => n.naam), Boolean(ns.fout)], [true, ["tnt-a"], true]);
    const s = await scan(i, ["tnt-a"]);
    assert.deepEqual([s.voorbeeld, s.componenten.length, Boolean(s.fout)], [true, 1, true]);
  } finally {
    delete process.env.SCAN_URL;
    delete process.env.SCAN_OPNAME;
  }
});

test("lines: one per model element a link reads, to the link's target", () => {
  const k = { id: "artefact:1", naam: "x", soort: "s", bron: { label: "", ids: ["a", "b", "a"] }, doel: { component: "openzaak", weergavenaam: "Open Zaak" } };
  assert.deepEqual(lijnenVan([k]), [
    { id: "artefact:1|a", koppeling: "artefact:1", van: "a", naar: "openzaak" },
    { id: "artefact:1|b", koppeling: "artefact:1", van: "b", naar: "openzaak" },
  ]);
});

test("step 1: the plugin's Inrichtingstool; a missing endpoint or an error is said, not thrown", async () => {
  const echt = globalThis.fetch;
  process.env.SCAN_URL = "http://scan.test";
  try {
    globalThis.fetch = (async () => new Response("", { status: 404 })) as typeof fetch;
    assert.match((await inrichtingstool()).fout ?? "", /ontbreekt/);
    globalThis.fetch = (async () => new Response(JSON.stringify({ fout: "geen toegang" }), { status: 502 })) as typeof fetch;
    assert.match((await inrichtingstool()).fout ?? "", /502: geen toegang/);
    const tool = { spec: { register: { gebruik: "bestaand", namespace: "tnt-a", naam: "omnium-api" } }, status: { fase: "Klaar", gevonden: { register: [{ namespace: "tnt-a", naam: "omnium-api" }] } } };
    globalThis.fetch = (async () => new Response(JSON.stringify(tool))) as typeof fetch;
    assert.deepEqual((await inrichtingstool()).tool, tool);
  } finally {
    globalThis.fetch = echt;
    delete process.env.SCAN_URL;
  }
});

test("opnameGegevens: the register's component names and the layers in use, sorted", async () => {
  const { bestaandeNamen, lagen } = await opnameGegevens(inrichting());
  assert.ok(bestaandeNamen.length > 0);
  assert.ok(bestaandeNamen.every(Boolean));
  assert.ok(lagen.length > 0);
  assert.deepEqual(lagen, [...new Set(lagen)].sort((a, b) => a.localeCompare(b, "nl", { numeric: true })));
});

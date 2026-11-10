import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { OmniumRegister } from "../src/client";
import { Inrichting } from "../src/inrichting";
import { OmniumStudio, speelNa } from "../src/studio-client";
import type { Elementen, Operatie, StudioElement } from "../src/studio-formulier";
import { leesWerkplaatsBranch, slaWerkplaatsOp } from "../src/werkplaats-opslaan";

/**
 * Saving from the werkplaats against a fake Studio (projects, op log, afsplitsen,
 * 409 on a moved sequence number) and the fixture register, whose form says it
 * came from project "inrichten" (ArtefactHerkomst.studioProjectId).
 */

const dir = path.join(import.meta.dirname, "fixture", "full");
const registerFetch = (async (input: string | URL | Request) => {
  const pad = new URL(String(input)).pathname.split("/")[2]!;
  const rows = JSON.parse(readFileSync(path.join(dir, `${pad}.json`), "utf8")) as Record<string, unknown>[];
  if (pad === "artefacten") {
    const form = rows.find((a) => a.id === 3)!;
    const v = { artefact_id: 3, rel_id: 9, versie: 1, opvoer: "2026-11-10T08:00:00Z", generatie: "2026-11-10a", studioProjectId: "inrichten", totVolgnummer: 10 };
    form.artefact_herkomsten = [{ artefact_id: 3, rel_id: 9, opvoer: v.opvoer, data: [v] }];
  }
  return new Response(JSON.stringify({ [pad]: rows, has_more: false }));
}) as typeof fetch;

const K = "Aanvraag.aanvraag_kaarten";
const el = (e: StudioElement) => [e.id, e] as const;
const fd = (): Elementen =>
  Object.fromEntries([
    el({ id: "f", naam: "GPK", elementType: "formulier", compartimenten: [{ compartmentType: "velden", velden: [] }], data: { code: "gpk-aanvraag" } }),
    el({
      id: "s1",
      naam: "Soort kaart",
      elementType: "stap",
      compartimenten: [
        {
          compartmentType: "velden",
          velden: [
            { naam: "soort", fieldType: "veld", data: { veld: `${K}.soort`, key: "soort", elementId: "Gpk_Kaart", verplicht: true, volgorde: "0" } },
            { naam: "kenteken", fieldType: "veld", data: { veld: `${K}.kenteken`, key: "kenteken", elementId: "Gpk_Kaart", volgorde: "1" } },
          ],
        },
      ],
      data: { key: "soort-kaart" },
    }),
    el({ id: "b1", naam: "", elementType: "bevat", source: "f", target: "s1", compartimenten: [], data: { volgorde: "0" } }),
  ]);

/** A fake Studio: one project "inrichten" with the form in its blob; the op log; afsplitsen copies the blob. */
function fakeStudio() {
  type P = { meta: Record<string, unknown>; inhoud: Record<string, unknown>; ops: (Operatie & { volgnummer: number })[] };
  const projecten = new Map<string, P>();
  projecten.set("inrichten", {
    meta: { id: "inrichten", naam: "Inrichten", tot_volgnummer: 10 },
    inhoud: { formaat: "studio-project", profielen: { formulierdiagram: { elements: fd(), diagrams: { d1: { nodes: [{ elementId: "f", position: { x: 40, y: 40 } }] } } } }, structuur: { plaatsing: { "formulierdiagram::d1": "map-gpk" } } },
    ops: [],
  });
  const calls: string[] = [];
  let concurrent = false;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const [, , , , id, sub] = url.pathname.split("/"); // /api/studio/projecten/:id/:sub
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}${url.search}`);
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer omt_schrijf");
    if (!id) return json(200, [...projecten.values()].map((p) => p.meta));
    const p = projecten.get(id);
    if (!p) return json(404, { error: "onbekend" });
    const laatste = () => p.ops.at(-1)?.volgnummer ?? (p.meta.tot_volgnummer as number);
    if (!sub) return json(200, { ...p.meta, inhoud: p.inhoud });
    if (sub === "ops" && method === "GET") {
      const vanaf = Number(url.searchParams.get("vanaf"));
      return json(200, { ops: p.ops.filter((o) => o.volgnummer > vanaf), laatste: laatste(), meer: false });
    }
    if (sub === "ops" && method === "POST") {
      const body = JSON.parse(String(init!.body)) as { ops: Operatie[]; verwachtLaatsteVolgnummer: number; namens?: string };
      if (concurrent) {
        // Someone else writes first, once: a label on another question.
        concurrent = false;
        p.ops.push({ volgnummer: laatste() + 1, store: "model:formulierdiagram", op: "updateElement", args: ["f", { naam: "GPK (gewijzigd)" }] });
      }
      if (body.verwachtLaatsteVolgnummer !== laatste()) return json(409, { reden: "volgnummer_verschoven", verwacht: body.verwachtLaatsteVolgnummer, laatsteVolgnummer: laatste() });
      assert.equal(body.namens, "mark");
      const van = laatste() + 1;
      body.ops.forEach((o, k) => p.ops.push({ ...o, volgnummer: van + k }));
      return json(201, { van, tot: laatste() });
    }
    if (sub === "afsplitsen") {
      const body = JSON.parse(String(init!.body)) as { naam: string; mapId?: string };
      const nieuw = `branch-${projecten.size}`;
      const meta = { id: nieuw, naam: body.naam, tot_volgnummer: 10, herkomst: { ouderProject: id, basisVolgnummer: laatste(), mapId: body.mapId, afgesplitstOp: "2026-11-10T09:00:00Z", gearchiveerd: false } };
      projecten.set(nieuw, { meta, inhoud: structuredClone(p.inhoud), ops: structuredClone(p.ops) });
      return json(201, meta);
    }
    return json(404, {});
  }) as typeof fetch;
  return {
    studio: new OmniumStudio({ baseUrl: "http://studio.test", token: "omt_schrijf", fetch: fetchFn }),
    projecten,
    calls,
    concurrentOnce: () => (concurrent = true),
  };
}

const versie = async (i: Inrichting) => (await i.locate(["ediensten", "gehandicaptenparkeerkaart-aanvragen", "versies", "0.1.0"]))!.record;

test("first save: a branch of the project with the form's map, the actions as one batch each with namens; the second save reuses it", async () => {
  const s = fakeStudio();
  const i = new Inrichting(new OmniumRegister({ baseUrl: "http://register.test", fetch: registerFetch }));
  const v = await versie(i);
  const r = await slaWerkplaatsOp(i, v, [
    { actie: "labelWijzigen", vraag: "kenteken", label: "Uw kenteken" },
    { actie: "verplichtZetten", vraag: "kenteken", verplicht: true },
  ], "mark", s.studio);
  assert.deepEqual(r, { ok: true, opgeslagen: 2, branch: "Werkplaats Gehandicaptenparkeerkaart aanvragen 0.1.0", nieuweBranch: true });
  const b = s.projecten.get("branch-1")!;
  assert.equal((b.meta.herkomst as { mapId: string }).mapId, "map-gpk");
  assert.equal(b.ops.length, 2, "one batch per action");
  assert.equal(s.projecten.get("inrichten")!.ops.length, 0, "the main project is untouched");
  // Read back as the edit page does: the branch's form.
  const stand = { elements: structuredClone(fd()), diagrams: {}, plaatsing: {} };
  speelNa(stand, b.ops);
  const rij = stand.elements.s1!.compartimenten![0]!.velden!.find((x) => x.data?.key === "kenteken")!;
  assert.deepEqual([rij.data!.label, rij.data!.verplicht], ["Uw kenteken", true]);
  const r2 = await slaWerkplaatsOp(i, v, [{ actie: "labelWijzigen", vraag: "soort", label: "Soort" }], "mark", s.studio);
  assert.equal(r2.ok && r2.nieuweBranch, false);
  assert.equal(s.projecten.size, 2, "no second branch");
});

test("a 409 (someone else wrote) reads again and retries once; an action that no longer fits stops with how many were saved", async () => {
  const s = fakeStudio();
  const i = new Inrichting(new OmniumRegister({ baseUrl: "http://register.test", fetch: registerFetch }));
  const v = await versie(i);
  await slaWerkplaatsOp(i, v, [{ actie: "labelWijzigen", vraag: "soort", label: "Soort" }], "mark", s.studio);
  s.concurrentOnce();
  const r = await slaWerkplaatsOp(i, v, [{ actie: "labelWijzigen", vraag: "kenteken", label: "K" }], "mark", s.studio);
  assert.equal(r.ok, true);
  assert.equal(s.calls.filter((c) => c.startsWith("POST") && c.endsWith("/ops")).length, 3, "the conflicting batch was sent again");
  const fout = await slaWerkplaatsOp(i, v, [
    { actie: "labelWijzigen", vraag: "soort", label: "S" },
    { actie: "vraagVerwijderen", vraag: "bestaatNiet" },
  ], "mark", s.studio);
  assert.equal(fout.ok, false);
  assert.match(!fout.ok ? fout.fout : "", /^1 van 2 wijzigingen opgeslagen; daarna: Vraag “bestaatNiet” staat niet/);
  const ongeldig = await slaWerkplaatsOp(i, v, [{ actie: "veldWissen" }], "mark", s.studio);
  assert.deepEqual(ongeldig, { ok: false, opgeslagen: 0, fout: "Wijziging 1 is niet geldig." });
});

test("the edit page reads the branch's form when there is one", async () => {
  const s = fakeStudio();
  const i = new Inrichting(new OmniumRegister({ baseUrl: "http://register.test", fetch: registerFetch }));
  const v = await versie(i);
  process.env.OMNIUM_REGISTER_URL = "http://studio.test";
  process.env.OMNIUM_SCHRIJF_TOKEN = "omt_schrijf";
  const real = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    String(input).includes("/api/studio/") ? (s.studio as unknown as { cfg: { fetch: typeof fetch } }).cfg.fetch(input, init) : real(input, init)) as typeof fetch;
  try {
    const { werkplaatsData } = await import("../src/werkplaats");
    const data = await werkplaatsData(i, v);
    assert.deepEqual(await leesWerkplaatsBranch(i, v, data), { kanOpslaan: true });
    await slaWerkplaatsOp(i, v, [{ actie: "labelWijzigen", vraag: "kenteken", label: "Uw kenteken" }], "mark", s.studio);
    const b = await leesWerkplaatsBranch(i, v, data);
    assert.equal(b.branch?.naam, "Werkplaats Gehandicaptenparkeerkaart aanvragen 0.1.0");
    assert.equal(b.branch?.form?.steps[0]!.questions.find((q) => q.key === "kenteken")?.label, "Uw kenteken");
  } finally {
    globalThis.fetch = real;
    delete process.env.OMNIUM_SCHRIJF_TOKEN;
  }
});

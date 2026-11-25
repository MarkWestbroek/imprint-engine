import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { OmniumRegister } from "../src/client";
import { Inrichting } from "../src/inrichting";
import { binnenWhitelist, leesWeigering, planKoppeling, vastgelegdeKoppelingen, type VastgelegdeKoppeling } from "../src/koppeling-register";
import { COMPONENT_TOEGESTAAN, planComponent, voorstelVoor, type Opname } from "../src/component-opname";
import { slaComponentOp, slaKoppelingOp } from "../src/koppeling-opslaan";

const dir = path.join(import.meta.dirname, "fixture", "full");
const lijst = (pad: string) => JSON.parse(readFileSync(path.join(dir, `${pad}.json`), "utf8"));

/** A fake register: /full/<pad> from the fixtures; POST /registratie/ recorded (or slow, or refused). */
function nepRegister(opts: { posts?: unknown[]; status?: number; antwoord?: string; traag?: boolean; naPost?: (pad: string, rows: unknown[]) => unknown[] } = {}) {
  let gepost = false;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/registratie/") {
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer omt_bouwer");
      opts.posts?.push(JSON.parse(String(init?.body)));
      gepost = true;
      if (opts.traag) throw new DOMException("timeout", "TimeoutError");
      return new Response(opts.antwoord ?? "{}", { status: opts.status ?? 201 });
    }
    const pad = url.pathname.split("/")[2]!;
    let rows = lijst(pad) as unknown[];
    if (gepost && opts.naPost) rows = opts.naPost(pad, rows);
    return new Response(JSON.stringify({ [pad]: rows, has_more: false }));
  }) as typeof fetch;
}
const inrichting = (f = nepRegister()) => new Inrichting(new OmniumRegister({ baseUrl: "http://register.test", fetch: f }));
const env = { OMNIUM_REGISTER_URL: "http://register.test", OMNIUM_KOPPELING_TOKEN: "omt_bouwer" };

test("reading: a Koppeling with its source, target and transformation; a withdrawn one is gone, also from the e-dienstversie", async () => {
  const k = await vastgelegdeKoppelingen(inrichting());
  assert.equal(k.length, 1, "koppeling 2 has an afvoer: not there, although edienstversie 2 still points at it");
  assert.deepEqual(
    { naam: k[0]!.naam, bron: k[0]!.bronnen[0]!.bronElementId, doel: k[0]!.doel?.component_id, tr: k[0]!.transformatie?.transformatie_id, ev: k[0]!.edienstversies },
    { naam: "Kaart wordt objecttype", bron: "Gpk_Kaart", doel: 3, tr: 1, ev: [{ edienstversie_id: 2, rel_id: 90 }] }
  );
});

const stand = async (): Promise<VastgelegdeKoppeling[]> => vastgelegdeKoppelingen(inrichting());

test("new line: one registration, the Koppeling with its elements nested and the relation on the e-dienstversie; a double is refused", async () => {
  const s = await stand();
  const p = planKoppeling({ soort: "nieuw", edienstversieId: 1, naam: "Aanvraag wordt zaak", bron: { bronSoort: "entiteit", bronElementId: "Aanvraag" }, componentId: 1 }, s, "2026-11-25");
  assert.ok(p.ok);
  const keys = p.registratie.wijzigingen.map((w) => Object.keys("opvoer" in w ? w.opvoer : w.afvoer)[0]);
  assert.deepEqual(keys, ["koppeling", "koppelingnaam", "koppeling_aanvang", "koppelingbron", "koppelingdoelcomponent", "edienstversiekoppeling"]);
  assert.ok(binnenWhitelist(p.registratie));
  const dubbel = planKoppeling({ soort: "nieuw", edienstversieId: 2, naam: "x", bron: { bronSoort: "entiteit", bronElementId: "Gpk_Kaart" }, componentId: 3 }, s, "2026-11-25");
  assert.equal(dubbel.ok, false);
});

test("erase: afvoer of the Koppeling and of its relation on every e-dienstversie, in one registration", async () => {
  const p = planKoppeling({ soort: "wis", koppelingId: 1 }, await stand(), "2026-11-25");
  assert.ok(p.ok);
  assert.deepEqual(p.registratie.wijzigingen, [{ afvoer: { koppeling: { id: 1 } } }, { afvoer: { edienstversiekoppeling: { edienstversie_id: 2, rel_id: 90 } } }]);
});

test("move: the source is replaced (afvoer + opvoer); the target gets a successor with aanvang, an ordinary registration", async () => {
  const s = await stand();
  const bron = planKoppeling({ soort: "verleg-bron", koppelingId: 1, bron: { bronSoort: "entiteit", bronElementId: "Ander" } }, s, "2026-11-26");
  assert.ok(bron.ok);
  assert.deepEqual(bron.registratie.wijzigingen[0], { afvoer: { koppelingbron: { koppeling_id: 1, rel_id: 2 } } });
  const doel = planKoppeling({ soort: "verleg-doel", koppelingId: 1, componentId: 1 }, s, "2026-11-26");
  assert.ok(doel.ok);
  assert.equal(doel.registratie.registratietype, "registratie");
  assert.deepEqual(doel.registratie.wijzigingen, [{ opvoer: { koppelingdoelcomponent: { koppeling_id: 1, component_id: 1, aanvang: "2026-11-26" } } }]);
  assert.equal(planKoppeling({ soort: "verleg-doel", koppelingId: 1, componentId: 3 }, s, "2026-11-26").ok, false, "already there");
});

test("whitelist: anything but Koppeling and its relation is refused", () => {
  assert.equal(binnenWhitelist({ opmerking: "", registratietype: "registratie", wijzigingen: [{ opvoer: { component: { id: 9 } } }] }), false);
});

test("saving: off without the bouwer token; with it one POST with the token and the action's registration", async () => {
  assert.equal((await slaKoppelingOp({ soort: "wis", koppelingId: 1 }, "mark", { env: { OMNIUM_REGISTER_URL: "http://register.test" } })).ok, false);
  const posts: unknown[] = [];
  process.env.OMNIUM_REGISTER_URL = "http://register.test";
  try {
    const r = await slaKoppelingOp({ soort: "wis", koppelingId: 1 }, "mark", { env, fetch: nepRegister({ posts }) });
    assert.deepEqual(r, { ok: true, melding: "Opgeslagen in het register." });
    assert.equal(posts.length, 1);
    const body = posts[0] as { registratie: { opmerking: string }; wijzigingen: unknown[] };
    assert.match(body.registratie.opmerking, /namens mark/);
    assert.equal(body.wijzigingen.length, 2);
  } finally {
    delete process.env.OMNIUM_REGISTER_URL;
  }
});

test("saving after a time-out: read again; landed = ok, not landed = say so, never a second POST", async () => {
  process.env.OMNIUM_REGISTER_URL = "http://register.test";
  try {
    const posts: unknown[] = [];
    const weg = (pad: string, rows: unknown[]) => (pad === "koppelingen" ? rows.map((r) => ({ ...(r as object), afvoer: "2026-11-25T10:00:00Z" })) : rows);
    const ok = await slaKoppelingOp({ soort: "wis", koppelingId: 1 }, "mark", { env, fetch: nepRegister({ posts, traag: true, naPost: weg }) });
    assert.equal(ok.ok, true);
    const niet = await slaKoppelingOp({ soort: "wis", koppelingId: 1 }, "mark", { env, fetch: nepRegister({ posts, traag: true }) });
    assert.equal(niet.ok, false);
    assert.equal(posts.length, 2, "one POST per attempt");
  } finally {
    delete process.env.OMNIUM_REGISTER_URL;
  }
});

// ── Step 3: a new Component (BACKEND 25-11-2026, registerschema 8) ──

const objecten: Opname = {
  naam: "objecten-api",
  weergavenaam: "Objecten API",
  laag: "1-2 gegevensbronnen",
  herkenning: { soort: "image", patroon: "(^|/)maykinmedia/objects-api$" },
  doel: true,
};

test("new Component: one registration, aanvang on the entity, name, layer and rule on the placeholder id; inside its own whitelist only", () => {
  const r = planComponent(objecten, "2026-11-25");
  assert.deepEqual(r.wijzigingen, [
    { opvoer: { component: { id: "$nieuw.component", aanvang: "2026-11-25" } } },
    { opvoer: { componentnaam: { component_id: "$nieuw.component", naam: "objecten-api", weergavenaam: "Objecten API" } } },
    { opvoer: { componentlaag: { component_id: "$nieuw.component", laag: "1-2 gegevensbronnen" } } },
    { opvoer: { componentherkenning: { component_id: "$nieuw.component", soort: "image", patroon: "(^|/)maykinmedia/objects-api$" } } },
  ]);
  assert.ok(binnenWhitelist(r, COMPONENT_TOEGESTAAN));
  assert.equal(binnenWhitelist(r), false, "the lines' whitelist does not let a Component through");
  assert.equal(binnenWhitelist({ ...r, wijzigingen: [{ opvoer: { koppeling: { id: "$nieuw.koppeling" } } }] }, COMPONENT_TOEGESTAAN), false, "and the other way round");
});

test("the register's refusal in words: writing filter (both forms), validation reasons, otherwise status", () => {
  const filter = JSON.stringify({
    type: "https://api.bitemporeel/problemen/schrijffilter",
    status: 403,
    code: "schrijffilter",
    detail: "account omnium-koppelaar mag deze typen niet schrijven: Persoon",
    invalidParams: [{ name: "Persoon", code: "type_niet_toegestaan", reason: "…" }, { name: "Persoon_Aanvang", code: "type_niet_toegestaan", reason: "…" }],
  });
  assert.match(leesWeigering(403, filter), /mag dit niet schrijven \(Persoon, Persoon_Aanvang\)/);
  assert.match(leesWeigering(403, JSON.stringify({ error: "Account omnium-koppelaar heeft een schrijffilter en mag alleen registreren via POST /registratie/.", reden: "schrijffilter" })), /mag alleen registreren/);
  const uniek = JSON.stringify({ status: 422, code: "validation_error", invalidParams: [{ name: "wijzigingen[2].componentnaam.naam", code: "uniek", reason: 'naam "objecten-api" is al in gebruik (Component 1; uniek binnen entiteit)' }] });
  assert.equal(leesWeigering(422, uniek), 'Het register weigerde (422): naam "objecten-api" is al in gebruik (Component 1; uniek binnen entiteit).');
  assert.equal(leesWeigering(500, "kapot"), "Het register weigerde (500): kapot.");
});

test("saving a Component: off without the token; checked against a fresh read (taken name refused before any POST); one POST with the token", async () => {
  assert.equal((await slaComponentOp(objecten, "mark", { env: { OMNIUM_REGISTER_URL: "http://register.test" } })).ok, false);
  process.env.OMNIUM_REGISTER_URL = "http://register.test";
  try {
    const posts: { registratie: { opmerking: string; bron: string }; wijzigingen: unknown[] }[] = [];
    const dubbel = await slaComponentOp({ ...objecten, naam: "openzaak" }, "mark", { env, fetch: nepRegister({ posts }) });
    assert.equal(dubbel.ok, false);
    assert.match(!dubbel.ok ? dubbel.fout : "", /al een component "openzaak"/);
    assert.equal((await slaComponentOp({ ...objecten, laag: "9 onzin" }, "mark", { env, fetch: nepRegister({ posts }) })).ok, false);
    assert.equal(posts.length, 0);

    const r = await slaComponentOp(objecten, "mark", { env, fetch: nepRegister({ posts }), vandaag: "2026-11-25" });
    assert.deepEqual(r, { ok: true, melding: "Objecten API staat in het register." });
    assert.equal(posts.length, 1);
    assert.equal(posts[0]!.registratie.bron, "imprint-omgevingswizard");
    assert.match(posts[0]!.registratie.opmerking, /objecten-api.*namens mark/);
    assert.equal(posts[0]!.wijzigingen.length, 4);

    const geweigerd = await slaComponentOp(objecten, "mark", {
      env,
      fetch: nepRegister({ status: 403, antwoord: JSON.stringify({ code: "schrijffilter", invalidParams: [{ name: "Component" }] }) }),
    });
    assert.match(!geweigerd.ok ? geweigerd.fout : "", /mag dit niet schrijven \(Component\)/);
  } finally {
    delete process.env.OMNIUM_REGISTER_URL;
  }
});

test("saving a Component after a time-out: read again and look for the name; never a second POST", async () => {
  process.env.OMNIUM_REGISTER_URL = "http://register.test";
  try {
    const posts: unknown[] = [];
    const erbij = (pad: string, rows: unknown[]) =>
      pad === "componenten"
        ? [...rows, { id: 99, opvoer: "2026-11-25T10:00:00Z", component_namen: [{ component_id: 99, rel_id: 1, opvoer: "2026-11-25T10:00:00Z", data: [{ component_id: 99, rel_id: 1, versie: 1, opvoer: "2026-11-25T10:00:00Z", naam: "objecten-api", weergavenaam: "Objecten API" }] }] }]
        : rows;
    const ok = await slaComponentOp(objecten, "mark", { env, fetch: nepRegister({ posts, traag: true, naPost: erbij }) });
    assert.equal(ok.ok, true);
    const niet = await slaComponentOp(objecten, "mark", { env, fetch: nepRegister({ posts, traag: true }) });
    assert.match(!niet.ok ? niet.fout : "", /staat er niet in/);
    assert.equal(posts.length, 2, "one POST per attempt, none resent");
  } finally {
    delete process.env.OMNIUM_REGISTER_URL;
  }
});

test("voorstelVoor + planComponent: the plugin's proposal goes straight into the registration", () => {
  const v = voorstelVoor({ namespace: "ns", naam: "zaken", bron: "deployment", image: "ghcr.io/oneground/zaken-api:1.0", herkend: null, bereikbaar: null, voorstel: { componentNaam: "zaken-api", soort: "image", patroon: "(^|/)oneground/zaken-api$" } });
  const r = planComponent({ ...v, laag: "3 verbinding" }, "2026-11-25");
  assert.deepEqual(r.wijzigingen[3], { opvoer: { componentherkenning: { component_id: "$nieuw.component", soort: "image", patroon: "(^|/)oneground/zaken-api$" } } });
});

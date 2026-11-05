import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { OmniumRegister, OmniumRegisterError, registerProblem } from "../src/client";
import { AmbiguousKey, Inrichting } from "../src/inrichting";
import { currentVersion, ge, geRows, humanize, relation, targetId, type FullRecord } from "../src/register";

const dir = path.join(import.meta.dirname, "fixture", "full");
const fixture = (pad: string) => JSON.parse(readFileSync(path.join(dir, `${pad}.json`), "utf8")) as FullRecord[];

/** A fake register: /full/<pad> paged by 2 (whatever size is asked), the list under its plural. */
function fakeRegister(opts: { token?: string; status?: number; body?: unknown; calls?: string[] } = {}) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    opts.calls?.push(`${url.pathname}${url.search}`);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (opts.status) return json(opts.status, opts.body);
    if (opts.token && headers.authorization !== `Bearer ${opts.token}`) return json(401, { error: "Authenticatie vereist." });
    const [, full, pad, id] = url.pathname.split("/");
    if (full !== "full" || !pad) return json(404, { message: "not found" });
    const rows = fixture(pad);
    if (id) {
      const r = rows.find((x) => x.id === Number(id));
      return r ? json(200, r) : json(404, { message: `${pad} not found` });
    }
    const page = Number(url.searchParams.get("page") ?? 1);
    const slice = rows.slice((page - 1) * 2, page * 2);
    const key = pad === "edienstversies" ? "e-dienst versies" : pad; // a plural with a space, as "lijst definities"
    return json(200, { [key]: slice, page, size: 2, has_more: page * 2 < rows.length, total_count: rows.length });
  }) as typeof fetch;
}

const register = (fetch = fakeRegister()) => new OmniumRegister({ baseUrl: "http://register.test", fetch });

test("current values: the live version with the latest opvoer; withdrawn hubs and versions do not count", () => {
  const [, v2] = fixture("edienstversies");
  assert.equal(ge(v2, "edienstversie_nummers")?.versienummer, "0.1.0");
  assert.equal(currentVersion({ data: [{ opvoer: "2026-01-01T00:00:00Z", afvoer: "2026-01-02T00:00:00Z" }] }), undefined);
  const a3 = fixture("artefacten")[2]!;
  assert.deepEqual(geRows(a3, "artefact_traceregels").map((r) => r.bronGE), ["Aanvraag.kenteken", "Aanvraag.geboortedatum"]);
});

test("relations: the target id, a self-relation by its doel_ column, the relation's own fields", () => {
  const a3 = fixture("artefacten")[2]!;
  assert.equal(relation(a3, "artefact_afhankelijkheden", "artefact_id")[0]?.id, 1);
  assert.equal(targetId({ artefact_id: 3, doel_artefact_id: 1, rel_id: 1 }, "artefact_id"), 1);
  const u1 = fixture("uitrollen")[0]!;
  const res = relation(u1, "uitrol_resultaten", "uitrol_id");
  assert.deepEqual(res.map((r) => [r.id, r.velden.actie]), [[2, "aangemaakt"], [3, "ongewijzigd"]]);
  assert.equal(res[0]!.velden.doelUrl, "https://openzaak.example/zaaktypen/1");
});

test("client: all pages, the one list in the envelope whatever its key, the token as Bearer", async () => {
  const calls: string[] = [];
  const reg = new OmniumRegister({ baseUrl: "http://register.test/", token: "omt_x", fetch: fakeRegister({ token: "omt_x", calls }) });
  const versies = await reg.list("edienstversies", { peiltijdstip: "2026-11-05T12:00:00Z" });
  assert.equal(versies.length, 3);
  assert.equal(calls.length, 2);
  assert.match(calls[0]!, /^\/full\/edienstversies\?peiltijdstip=2026-11-05T12%3A00%3A00Z&page=1&size=500$/);
  assert.equal((await reg.one("ediensten", 2))?.id, 2);
  assert.equal(await reg.one("ediensten", 99), null);
});

test("client: errors keep their status; a 401 is said, not shown as an empty list", async () => {
  const noToken = new OmniumRegister({ baseUrl: "http://register.test", fetch: fakeRegister({ token: "omt_x" }) });
  await assert.rejects(noToken.list("ediensten"), (err: unknown) => err instanceof OmniumRegisterError && err.status === 401 && err.message === "Authenticatie vereist.");
  assert.match(registerProblem(new OmniumRegisterError(401, "x", "/full/x")), /leestoken/);
  const notJson = register((async () => new Response("<html>502</html>", { status: 502 })) as typeof fetch);
  await assert.rejects(notJson.list("ediensten"), (err: unknown) => err instanceof OmniumRegisterError && err.status === 502);
  const twoLists = register(fakeRegister({ status: 200, body: { a: [], b: [] } }));
  await assert.rejects(twoLists.list("ediensten"), /one list/);
});

test("keys: every record has a stable path, and the path leads back to it", async () => {
  const i = new Inrichting(register());
  const hrefs: string[] = [];
  for (const pad of ["componenten", "ediensten", "edienstversies", "artefacten", "uitrollen"] as const) {
    for (const r of await i.list(pad)) {
      const href = await i.href(pad, r);
      assert.ok(href, `${pad} ${r.id} has a key`);
      hrefs.push(href);
      const back = await i.locate(href.slice("/inrichting/".length).split("/"));
      assert.equal(back?.pad, pad);
      assert.equal(back?.record.id, r.id);
    }
  }
  assert.ok(hrefs.includes("/inrichting/ediensten/Gehandicaptenparkeerkaart%20aanvragen/versies/0.1.0"));
  assert.ok(hrefs.includes("/inrichting/ediensten/Aanvraag%20(voorbeeld)/versies/0.1.0"));
  assert.ok(hrefs.includes("/inrichting/artefacten/zaaktype/openzaak/aanvraag"));
  assert.ok(hrefs.includes("/inrichting/ediensten/Gehandicaptenparkeerkaart%20aanvragen/versies/0.1.0/uitrollen/2026-11-05T10%3A00%3A00Z"));
});

test("locate: decoded or encoded segments, exact matches only, crumbs up the tree", async () => {
  const i = new Inrichting(register());
  const v = await i.locate(["ediensten", "Gehandicaptenparkeerkaart aanvragen", "versies", "0.1.0"]);
  assert.equal(v?.record.id, 2);
  assert.equal(v?.title, "Gehandicaptenparkeerkaart aanvragen 0.1.0");
  const u = await i.locate(["ediensten", "Gehandicaptenparkeerkaart%20aanvragen", "versies", "0.1.0", "uitrollen", "2026-11-05T10:00:00Z"]);
  assert.deepEqual(u?.crumbs.map((c) => c.label), ["Gehandicaptenparkeerkaart aanvragen", "versie 0.1.0"]);
  // ILIKE would find these; we do not.
  assert.equal(await i.locate(["ediensten", "Aanvraag"]), null);
  assert.equal(await i.locate(["ediensten", "Aanvraag (voorbeeld)", "versies", "0.1"]), null);
  assert.equal(await i.locate(["ediensten", "Aanvraag (voorbeeld)", "versies", "0.0.1"]), null); // withdrawn number
  assert.equal(await i.locate(["onbekend", "x"]), null);
});

test("locate: a key that is not unique is an error, never a random record", async () => {
  const twin = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const pad = url.pathname.split("/")[2]!;
    const rows = fixture(pad);
    return new Response(JSON.stringify({ [pad]: pad === "ediensten" ? [...rows, { ...rows[0]!, id: 9 }] : rows, has_more: false }));
  }) as typeof fetch;
  const i = new Inrichting(register(twin));
  await assert.rejects(i.locate(["ediensten", "Aanvraag (voorbeeld)"]), AmbiguousKey);
});

test("humanize: field names as labels", () => {
  assert.equal(humanize("doelVersieRange"), "Doel versie range");
  assert.equal(humanize("artefact_traceregels"), "Artefact traceregels");
});

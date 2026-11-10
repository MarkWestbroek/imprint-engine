import assert from "node:assert/strict";
import { test } from "node:test";
import type { FormulierActie } from "../src/formulier-acties";
import { speelNa } from "../src/studio-client";
import { actieNaarOps, fdNaarNeutraal, StudioFout, type Elementen, type Operatie, type Rij, type StudioElement } from "../src/studio-formulier";

/** A FormulierDefinitie shaped like TRANSFORMATIES' GPK one (profile formulierdiagram, 10-11-2026). */
const P = "Gehandicaptenparkeerkaartaanvraag.gpkaanvraag_kaarten";
const B = "Gehandicaptenparkeerkaartaanvraag.gpkaanvraag_beperkingen";
const veld = (key: string, pad: string, volgorde: number, extra: Record<string, unknown> = {}): Rij => ({
  naam: key,
  fieldType: "veld",
  data: { veld: pad, key, label: key, elementId: pad.startsWith(P) ? "GA_Kaart" : "GA_Beperking", volgorde: String(volgorde), ...extra },
});
const container = (id: string, elementType: string, naam: string, velden: Rij[], data: Record<string, unknown> = {}): StudioElement => ({
  id,
  naam,
  elementType,
  compartimenten: [{ compartmentType: "velden", velden }],
  data,
});
const bevat = (id: string, source: string, target: string, volgorde: number): StudioElement => ({ id, naam: "", elementType: "bevat", source, target, compartimenten: [], data: { volgorde: String(volgorde) } });

function gpk(): Elementen {
  const els: StudioElement[] = [
    container("f", "formulier", "Gehandicaptenparkeerkaart aanvragen", [], { code: "gpk" }),
    container("s1", "stap", "Soort kaart", [veld("soort", `${P}.soort`, 0, { verplicht: true }), veld("eerdereKaart", `${P}.eerdereKaart`, 2)], { key: "soort-kaart" }),
    container("c1", "conditioneel", "als soort == bestuurder", [veld("kenteken", `${P}.kenteken`, 0), veld("rijbewijsnummer", `${P}.rijbewijsnummer`, 1, { verplicht: true })], {
      conditieVeld: `${P}.soort`,
      conditieOp: "==",
      conditieWaarde: "bestuurder",
    }),
    container("c2", "conditioneel", "als eerdereKaart == true", [veld("eerderKaartnummer", `${P}.eerderKaartnummer`, 0)], {
      conditieVeld: `${P}.eerdereKaart`,
      conditieOp: "==",
      conditieWaarde: "true",
      conditieWaardeType: "boolean",
    }),
    container("s2", "stap", "Uw beperking", [veld("loopafstandMeter", `${B}.loopafstandMeter`, 0), veld("hulpmiddel", `${B}.hulpmiddel`, 1)], { key: "beperking" }),
    container("s3", "stap", "Pasfoto", [], { key: "pasfoto" }),
    container("l1", "lijst", "Pasfoto", [{ naam: "pasfoto", fieldType: "veld", data: { veld: "documentUrl", key: "pasfoto", vorm: "bestand", volgorde: "0" } }], { bron: "Aanvraag.aanvraagbijlagen", min: "1", max: "1" }),
    bevat("b1", "f", "s1", 0),
    bevat("b2", "s1", "c1", 1),
    bevat("b3", "s1", "c2", 3),
    bevat("b4", "f", "s2", 1),
    bevat("b5", "f", "s3", 2),
    bevat("b6", "s3", "l1", 0),
  ];
  return Object.fromEntries(els.map((e) => [e.id, e]));
}

/** Replay the ops as the Studio's store does (the client's own replay, which the werkplaats reads with). */
function speel(elements: Elementen, ops: Operatie[]): Elementen {
  const stand = { elements: structuredClone(elements), diagrams: { d: { nodes: [] } }, plaatsing: {} };
  speelNa(stand, ops);
  return stand.elements;
}

let n = 0;
const nieuwId = (soort: string) => `frm_wp_${soort}_${++n}`;
const doe = (els: Elementen, a: FormulierActie) => speel(els, actieNaarOps({ elements: els, diagramId: "d" }, a, "gpk", nieuwId));
const stappen = (els: Elementen) => fdNaarNeutraal(els, "gpk")!.form.steps.map((st) => `${st.slug}: ${st.questions.map((q) => q.key + (q.condition ? `[${q.condition.key}=${q.condition.eq}]` : "")).join(" ")}`);

test("reading: steps, rows in order across containers, conditions resolved to keys, the lijst row required", () => {
  const { form } = fdNaarNeutraal(gpk(), "gpk")!;
  assert.deepEqual(stappen(gpk()), [
    "soort-kaart: soort kenteken[soort=bestuurder] rijbewijsnummer[soort=bestuurder] eerdereKaart eerderKaartnummer[eerdereKaart=true]",
    "beperking: loopafstandMeter hulpmiddel",
    "pasfoto: pasfoto",
  ]);
  const pasfoto = form.steps[2]!.questions[0]!;
  assert.deepEqual([pasfoto.required, pasfoto.type], [true, "file"]);
  assert.equal(form.steps[0]!.questions[0]!.bron?.pad, `${P}.soort`);
});

test("label, required, rename a step: one patch of the one element; volgorde stays strings", () => {
  const ops = actieNaarOps({ elements: gpk() }, { actie: "labelWijzigen", vraag: "kenteken", label: "Uw kenteken" }, "gpk", nieuwId);
  assert.equal(ops.length, 1);
  const { zet, wis } = ops[0]!.args[0] as { zet: Elementen; wis: string[] };
  assert.deepEqual([Object.keys(zet), wis], [["c1"], []]);
  assert.equal(zet.c1!.compartimenten![0]!.velden![0]!.data!.label, "Uw kenteken");
  assert.equal(typeof zet.c1!.compartimenten![0]!.velden![1]!.data!.volgorde, "string");
  let els = doe(gpk(), { actie: "verplichtZetten", vraag: "hulpmiddel", verplicht: true });
  els = doe(els, { actie: "stapHernoemen", stap: "beperking", titel: "Beperking" });
  const f = fdNaarNeutraal(els, "gpk")!.form;
  assert.deepEqual([f.steps[1]!.title, f.steps[1]!.questions[1]!.required], ["Beperking", true]);
});

test("add a question after another: the field path from a question on the same element; the order renumbered over rows and connectors", () => {
  const els = doe(gpk(), { actie: "vraagToevoegen", stap: "soort-kaart", na: "soort", vraag: "geldigTot", label: "geldigTot", type: "date", bron: { elementId: "GA_Kaart", veld: "geldigTot" } });
  assert.match(stappen(els)[0]!, /^soort-kaart: soort geldigTot kenteken/);
  const rij = els.s1!.compartimenten![0]!.velden!.find((r) => r.data?.key === "geldigTot")!;
  assert.equal(rij.data!.veld, `${P}.geldigTot`);
  // An element with no question yet: no role name to build the path from, so refuse rather than guess.
  assert.throws(() => doe(gpk(), { actie: "vraagToevoegen", stap: "beperking", na: null, vraag: "x", label: "x", type: "text", bron: { elementId: "Onbekend_GE", veld: "x" } }), StudioFout);
});

test("move: out of a conditioneel into another step keeps its condition (a new conditioneel there, on the diagram); an emptied conditioneel goes", () => {
  const ops = actieNaarOps({ elements: gpk(), diagramId: "d", posities: { s2: { x: 300, y: 240 } } }, { actie: "vraagVerplaatsen", vraag: "eerderKaartnummer", stap: "beperking", na: "hulpmiddel" }, "gpk", nieuwId);
  const els = speel(gpk(), ops);
  assert.deepEqual(stappen(els).slice(0, 2), [
    "soort-kaart: soort kenteken[soort=bestuurder] rijbewijsnummer[soort=bestuurder] eerdereKaart",
    "beperking: loopafstandMeter hulpmiddel eerderKaartnummer[eerdereKaart=true]",
  ]);
  assert.ok(ops.some((o) => o.op === "deleteElement" && o.args[0] === "c2"), "the emptied conditioneel goes by deleteElement (cascade)");
  assert.equal(els.b3, undefined, "its connector went with it");
  const diagram = ops.find((o) => o.op === "addElementToDiagram")!;
  assert.deepEqual(diagram.args.slice(0, 1), ["d"]);
  assert.deepEqual(diagram.args[2], { x: 340, y: 440 });
  // Within a step, plainly.
  assert.match(stappen(doe(gpk(), { actie: "vraagVerplaatsen", vraag: "hulpmiddel", stap: "beperking", na: null }))[1]!, /^beperking: hulpmiddel loopafstandMeter/);
});

test("condition: set joins an existing conditioneel with the same path and value; a new one goes right after the question it depends on; removing returns it in place", () => {
  let els = doe(gpk(), { actie: "voorwaardeZetten", vraag: "eerdereKaart", voorwaarde: { vraag: "soort", gelijkAan: "bestuurder" } });
  assert.match(stappen(els)[0]!, /kenteken\[soort=bestuurder\] rijbewijsnummer\[soort=bestuurder\] eerdereKaart\[soort=bestuurder\]/);
  els = doe(gpk(), { actie: "voorwaardeZetten", vraag: "hulpmiddel", voorwaarde: { vraag: "loopafstandMeter", gelijkAan: "0" } });
  assert.equal(stappen(els)[1], "beperking: loopafstandMeter hulpmiddel[loopafstandMeter=0]");
  const c = Object.values(els).find((e) => e.elementType === "conditioneel" && e.data?.conditieVeld === `${B}.loopafstandMeter`)!;
  assert.equal(c.data!.conditieOp, "==");
  els = doe(gpk(), { actie: "voorwaardeZetten", vraag: "kenteken", voorwaarde: null });
  assert.match(stappen(els)[0]!, /^soort-kaart: soort kenteken rijbewijsnummer\[soort=bestuurder\] eerdereKaart/);
  // A vinkje's value is typed.
  els = doe(gpk(), { actie: "voorwaardeZetten", vraag: "soort", voorwaarde: { vraag: "eerdereKaart", gelijkAan: "true" } });
  assert.ok(Object.values(els).some((e) => e.data?.conditieWaardeType === "boolean" && e.compartimenten?.[0]?.velden?.some((r) => r.data?.key === "soort")));
});

test("remove a question and add a step; unknown keys refuse", () => {
  let els = doe(gpk(), { actie: "vraagVerwijderen", vraag: "eerderKaartnummer" });
  assert.equal(stappen(els)[0], "soort-kaart: soort kenteken[soort=bestuurder] rijbewijsnummer[soort=bestuurder] eerdereKaart");
  assert.equal(els.c2, undefined);
  els = doe(els, { actie: "stapToevoegen", stap: "extra", titel: "Extra", na: "beperking" });
  assert.deepEqual(fdNaarNeutraal(els, "gpk")!.form.steps.map((s) => s.slug), ["soort-kaart", "beperking", "extra", "pasfoto"]);
  assert.throws(() => doe(gpk(), { actie: "vraagVerwijderen", vraag: "onbekend" }), /staat niet/);
  assert.throws(() => doe(gpk(), { actie: "stapHernoemen", stap: "onbekend", titel: "x" }), /staat niet/);
});

test("replaying the Studio's ops: element ops and the diagram node of a new container; any other op on the form store is refused", async () => {
  const { OnbekendeOp } = await import("../src/studio-client");
  const stand = { elements: gpk(), diagrams: { d: { nodes: [] as { elementId: string }[] } }, plaatsing: {} as Record<string, string> };
  speelNa(stand, [
    { store: "model:formulierdiagram", op: "updateElement", args: ["s2", { naam: "Beperking", data: { beschrijving: "x" } }] },
    { store: "model:formulierdiagram", op: "deleteElement", args: ["c2"] },
    { store: "model:formulierdiagram", op: "addElementToDiagram", args: ["d", "s2", { x: 1, y: 2 }] },
    { store: "model:formulierdiagram", op: "updateNodePosition", args: ["d", "s2", { x: 5, y: 5 }] },
    { store: "structuur", op: "patchStructuur", args: [{ zetPlaatsing: { "formulierdiagram::d": "map-1" } }] },
    { store: "model:diagram05", op: "laadModel", args: [{}] }, // another profile: cannot touch the form
  ]);
  assert.deepEqual([stand.elements.s2!.naam, stand.elements.s2!.data!.key, stand.elements.s2!.data!.beschrijving], ["Beperking", "beperking", "x"]);
  assert.equal(stand.elements.b3, undefined, "deleteElement cascades to the connector");
  assert.deepEqual(stand.diagrams.d.nodes.map((n) => n.elementId), ["s2"]);
  assert.equal(stand.plaatsing["formulierdiagram::d"], "map-1");
  assert.throws(() => speelNa(stand, [{ store: "model:formulierdiagram", op: "laadModel", args: [{}] }]), OnbekendeOp);
});

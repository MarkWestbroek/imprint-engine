import assert from "node:assert/strict";
import { test } from "node:test";
import { ActieFout, beschrijf, FormulierActie, modelVelden, nieuweSleutel, pasToe } from "../src/formulier-acties";
import { fromNeutraal, type NeutralForm } from "../src/neutral-form";

const form = (): NeutralForm =>
  fromNeutraal({
    versie: "0.1",
    formulier: { key: "gpk", naam: "GPK" },
    stappen: [
      {
        key: "soort-kaart",
        titel: "Soort kaart",
        vragen: [
          { key: "soort", label: "Welke kaart?", type: "keuze", verplicht: true, keuzes: [{ waarde: "bestuurder", label: "Bestuurder" }], bron: { pad: "Gpk.Kaart.soort", elementId: "Gpk_Kaart" } },
          { key: "kenteken", label: "Kenteken", type: "tekst", verplicht: false, voorwaarde: { vraag: "soort", gelijkAan: "bestuurder" }, bron: { pad: "Gpk.Kaart.kenteken", elementId: "Gpk_Kaart" } },
        ],
      },
      { key: "pasfoto", titel: "Pasfoto", vragen: [] },
    ],
  })!;

const logischModel = {
  profielen: {
    diagram05: {
      elements: {
        Gpk_Kaart: {
          naam: "GpkKaart",
          data: {
            bron: {
              velden: [
                { naam: "soort", type: "string", enum: ["bestuurder", "passagier"], enumNaam: "GpkSoort", verplicht: true },
                { naam: "kenteken", type: "string", verplicht: false },
                { naam: "geldigTot", type: "string", format: "date", verplicht: false },
              ],
            },
          },
        },
        Gpk_KaartStatus: { naam: "GpkKaartStatus", data: { bron: { velden: [{ naam: "soort", type: "boolean", verplicht: false }] } } },
      },
    },
  },
};
const velden = modelVelden(logischModel);

test("model fields: the provisional form per field (enum → keuze, date → datum, boolean → vinkje), required as the model says", () => {
  const k = velden.get("Gpk_Kaart")!;
  assert.deepEqual(
    k.map((v) => [v.veld, v.type, v.soort, v.verplicht]),
    [
      ["soort", "radio", "keuze uit GpkSoort", true],
      ["kenteken", "text", "tekst", false],
      ["geldigTot", "date", "datum", false],
    ]
  );
  assert.deepEqual(k[0]!.choices[1], { value: "passagier", label: "Passagier" });
  assert.equal(velden.get("Gpk_KaartStatus")![0]!.type, "checkbox");
});

test("the key of a new question: the field name, else the GE name without the entity prefix plus the field, else a digit", () => {
  const f = form();
  assert.equal(nieuweSleutel(f, "geldigTot", "GpkKaart", "Gpk"), "geldigTot");
  assert.equal(nieuweSleutel(f, "soort", "GpkKaartStatus", "Gpk"), "kaartStatusSoort");
  const f2 = pasToe(f, { actie: "vraagToevoegen", stap: "pasfoto", na: null, vraag: "kaartStatusSoort", label: "x", type: "checkbox", bron: { elementId: "Gpk_KaartStatus", veld: "soort" } }, velden);
  assert.equal(nieuweSleutel(f2, "soort", "GpkKaartStatus", "Gpk"), "kaartStatusSoort2");
});

test("actions: add after a question, move, required, condition, label, steps — each a new form, the old one untouched", () => {
  const f = form();
  let g = pasToe(f, { actie: "vraagToevoegen", stap: "soort-kaart", na: "soort", vraag: "geldigTot", label: "GeldigTot", type: "date", bron: { elementId: "Gpk_Kaart", veld: "geldigTot", pad: "Gpk.Kaart.geldigTot" } }, velden);
  assert.deepEqual(g.steps[0]!.questions.map((q) => q.key), ["soort", "geldigTot", "kenteken"]);
  assert.equal(f.steps[0]!.questions.length, 2, "the old form is untouched");
  g = pasToe(g, { actie: "vraagVerplaatsen", vraag: "geldigTot", stap: "pasfoto", na: null }, velden);
  assert.deepEqual([g.steps[0]!.questions.length, g.steps[1]!.questions[0]!.key], [2, "geldigTot"]);
  g = pasToe(g, { actie: "verplichtZetten", vraag: "geldigTot", verplicht: true }, velden);
  g = pasToe(g, { actie: "voorwaardeZetten", vraag: "geldigTot", voorwaarde: { vraag: "soort", gelijkAan: "passagier" } }, velden);
  g = pasToe(g, { actie: "labelWijzigen", vraag: "geldigTot", label: "Tot wanneer?" }, velden);
  const q = g.steps[1]!.questions[0]!;
  assert.deepEqual([q.required, q.condition, q.label], [true, { key: "soort", eq: "passagier", show: true }, "Tot wanneer?"]);
  g = pasToe(g, { actie: "stapToevoegen", stap: "extra", titel: "Extra", na: "soort-kaart" }, velden);
  g = pasToe(g, { actie: "stapHernoemen", stap: "extra", titel: "Aanvullend" }, velden);
  assert.deepEqual(g.steps.map((st) => st.title), ["Soort kaart", "Aanvullend", "Pasfoto"]);
});

test("actions: a model-required field cannot be left out or made optional; removing a question drops conditions on it; unknown keys refuse", () => {
  const f = form();
  assert.throws(() => pasToe(f, { actie: "vraagVerwijderen", vraag: "soort" }, velden), ActieFout);
  assert.throws(() => pasToe(f, { actie: "verplichtZetten", vraag: "soort", verplicht: false }, velden), /verplicht in het model/);
  assert.throws(() => pasToe(f, { actie: "vraagVerwijderen", vraag: "onbekend" }, velden), /Onbekende vraag/);
  assert.throws(() => pasToe(f, { actie: "voorwaardeZetten", vraag: "kenteken", voorwaarde: { vraag: "kenteken", gelijkAan: "x" } }, velden), /zichzelf/);
  // Without the model (no velden), removing soort is allowed; kenteken then loses its condition.
  const g = pasToe(f, { actie: "vraagVerwijderen", vraag: "soort" });
  assert.equal(g.steps[0]!.questions[0]!.condition, undefined);
});

test("actions are a whitelist: anything else fails the schema; each has a sentence for the list of changes", () => {
  assert.equal(FormulierActie.safeParse({ actie: "veldWissen", vraag: "x" }).success, false);
  assert.equal(FormulierActie.safeParse({ actie: "labelWijzigen", vraag: "x", label: "" }).success, false);
  assert.equal(beschrijf({ actie: "vraagVerplaatsen", vraag: "kenteken", stap: "pasfoto", na: null }), "Vraag kenteken verplaatst naar stap pasfoto, als eerste");
});

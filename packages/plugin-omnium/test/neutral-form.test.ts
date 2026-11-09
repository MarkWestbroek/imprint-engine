import assert from "node:assert/strict";
import { test } from "node:test";
import { fromFormio, fromNeutraal, visible } from "../src/neutral-form";

test("neutral form from a plain Form.io form (a GZAC dossierformulier): panels are groups, columns fold away, read-only kept", () => {
  const form = fromFormio(
    {
      display: "form",
      components: [
        {
          type: "panel",
          key: "aanvraag",
          title: "Aanvraag",
          components: [
            {
              type: "columns",
              key: "kolommen",
              columns: [
                { components: [{ type: "textfield", key: "aanvraagnummer", label: "Aanvraagnummer", disabled: true }] },
                { components: [{ type: "checkbox", key: "eerdereKaart", label: "Eerdere kaart", disabled: true }] },
              ],
            },
          ],
        },
      ],
    },
    "Aanvraag beoordelen"
  )!;
  assert.equal(form.steps.length, 1);
  assert.deepEqual(
    form.steps[0]!.questions.map((q) => [q.key, q.type, q.depth, q.readOnly]),
    [
      ["aanvraag", "group", 0, false],
      ["aanvraagnummer", "text", 1, true],
      ["eerdereKaart", "checkbox", 1, true],
    ]
  );
  assert.equal(form.steps[0]!.questions[1]!.pointer, "/components/0/components/0/columns/0/components/0"); // where the traceregels point
});

test("neutral form: a condition shows or hides a question, also on a checkbox", () => {
  const q = { condition: { key: "soort", eq: "bestuurder", show: true } } as Parameters<typeof visible>[0];
  assert.equal(visible(q, {}), false);
  assert.equal(visible(q, { soort: "bestuurder" }), true);
  const hide = { condition: { key: "eerdereKaart", eq: "true", show: false } } as Parameters<typeof visible>[0];
  assert.equal(visible(hide, { eerdereKaart: "true" }), false);
  assert.equal(fromFormio({ niets: true }), undefined);
});

test("neutral form from the formulier-neutraal contract 0.1: types, keuze as rondjes or lijst, voorwaarde, pointers into its own payload", () => {
  const form = fromNeutraal({
    versie: "0.1",
    formulier: { key: "gpk", naam: "Gehandicaptenparkeerkaart aanvragen", inloggen: ["digid"] },
    stappen: [
      {
        key: "soort-kaart",
        titel: "Soort kaart",
        vragen: [
          { key: "soort", label: "Welke kaart?", type: "keuze", verplicht: true, keuzes: [{ waarde: "bestuurder", label: "Bestuurder" }], keuzeWeergave: "rondjes" },
          { key: "gemeente", label: "Gemeente", type: "keuze", verplicht: false, keuzes: [], keuzeWeergave: "lijst" },
          { key: "kenteken", label: "Kenteken", hulptekst: "Zoals op uw kentekenbewijs", type: "tekst", verplicht: false, voorwaarde: { vraag: "soort", gelijkAan: "bestuurder" }, tekst: { maxLengte: 8 } },
          { key: "x", label: "X", type: "anders", formio: "signature", verplicht: false },
        ],
      },
    ],
  })!;
  assert.deepEqual(form.login, ["digid"]);
  const [soort, gemeente, kenteken, x] = form.steps[0]!.questions;
  assert.deepEqual([soort!.type, soort!.required, soort!.choices[0]], ["radio", true, { value: "bestuurder", label: "Bestuurder" }]);
  assert.equal(gemeente!.type, "select");
  assert.deepEqual(kenteken!.condition, { key: "soort", eq: "bestuurder", show: true });
  assert.equal(kenteken!.maxLength, 8);
  assert.equal(kenteken!.text, "Zoals op uw kentekenbewijs");
  assert.equal(kenteken!.pointer, "/stappen/0/vragen/2");
  assert.deepEqual([x!.type, x!.engineType], ["other", "signature"]);
  assert.equal(fromNeutraal({ formulier: {} }), undefined);
});

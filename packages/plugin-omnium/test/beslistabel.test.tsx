import assert from "node:assert/strict";
import { test } from "node:test";
import { fromBron, fromXml, BeslistabelView } from "../src/beslistabel";

/** A decision table from both forms: the source (Omnium JSON) and the generated DMN XML give the same table. */

const bron = {
  formaat: "omnium-project",
  profielen: {
    dmnDrd05: {
      elements: {
        dmn_ontvankelijk: {
          id: "dmn_ontvankelijk",
          naam: "Ontvankelijk",
          elementType: "decision",
          data: {
            vraag: "Is de aanvraag compleet?",
            beslistabel: {
              naam: "Ontvankelijk",
              hitPolicy: "FIRST",
              inputs: [
                { id: "in_bsn", naam: "bsn", label: "BSN", type: "string", fieldRef: { veldpad: "envelop:bsn" } },
                { id: "in_foto", naam: "bijlagen", label: "Pasfoto", expressie: "bijlagen != null", type: "boolean" },
              ],
              outputs: [
                { id: "out_ok", naam: "ontvankelijk", label: "Ontvankelijk" },
                { id: "out_reden", naam: "reden", label: "Reden" },
              ],
              rules: [
                { id: "r1", toelichting: "Niet geïdentificeerd.", inputEntries: { in_bsn: 'null, ""', in_foto: "" }, outputEntries: { out_ok: "false", out_reden: '"Geen BSN"' } },
                { id: "r2", inputEntries: { in_bsn: "", in_foto: "true" }, outputEntries: { out_ok: "true", out_reden: '""' } },
              ],
            },
          },
        },
        iets_anders: { id: "iets_anders", data: { vraag: "geen tabel" } },
      },
    },
  },
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<dmn:definitions xmlns:dmn="https://www.omg.org/spec/DMN/20191111/MODEL/" id="D" name="Ontvankelijk">
  <dmn:decision id="ontvankelijk" name="Ontvankelijk">
    <dmn:decisionTable id="t" hitPolicy="FIRST">
      <dmn:input id="in_bsn" label="BSN"><dmn:inputExpression id="e1" typeRef="string"><dmn:text>bsn</dmn:text></dmn:inputExpression></dmn:input>
      <dmn:input id="in_foto" label="Pasfoto"><dmn:inputExpression id="e2" typeRef="boolean"><dmn:text>bijlagen != null</dmn:text></dmn:inputExpression></dmn:input>
      <dmn:output id="out_ok" label="Ontvankelijk" name="ontvankelijk" typeRef="boolean" />
      <dmn:output id="out_reden" label="Reden" name="reden" typeRef="string" />
      <dmn:rule id="r1">
        <dmn:description>Niet geïdentificeerd.</dmn:description>
        <dmn:inputEntry id="a"><dmn:text>null, &quot;&quot;</dmn:text></dmn:inputEntry>
        <dmn:inputEntry id="b"><dmn:text>-</dmn:text></dmn:inputEntry>
        <dmn:outputEntry id="c"><dmn:text>false</dmn:text></dmn:outputEntry>
        <dmn:outputEntry id="d"><dmn:text>&quot;Geen BSN&quot;</dmn:text></dmn:outputEntry>
      </dmn:rule>
      <dmn:rule id="r2">
        <dmn:inputEntry id="e"><dmn:text>-</dmn:text></dmn:inputEntry>
        <dmn:inputEntry id="f"><dmn:text>true</dmn:text></dmn:inputEntry>
        <dmn:outputEntry id="g"><dmn:text>true</dmn:text></dmn:outputEntry>
        <dmn:outputEntry id="h"><dmn:text>&quot;&quot;</dmn:text></dmn:outputEntry>
      </dmn:rule>
    </dmn:decisionTable>
  </dmn:decision>
</dmn:definitions>`;

test("a dmn-bron: the table on the decision element, with its question and where an input comes from", () => {
  const [t, ...rest] = fromBron(bron);
  assert.equal(rest.length, 0); // an element without beslistabel is not a table
  assert.equal(t!.vraag, "Is de aanvraag compleet?");
  assert.equal(t!.hitPolicy, "FIRST");
  assert.deepEqual(t!.inputs.map((c) => [c.label, c.expressie, c.veldpad]), [["BSN", "bsn", "envelop:bsn"], ["Pasfoto", "bijlagen != null", undefined]]);
  assert.deepEqual(t!.rules.map((r) => [r.in, r.out, r.toelichting]), [
    [['null, ""', ""], ["false", '"Geen BSN"'], "Niet geïdentificeerd."],
    [["", "true"], ["true", '""'], undefined],
  ]);
});

test("generated DMN XML: the same table (entities decoded, '-' for any value)", () => {
  const [x] = fromXml(xml);
  const [b] = fromBron(bron);
  assert.equal(x!.naam, "Ontvankelijk");
  assert.deepEqual(x!.inputs.map((c) => [c.label, c.expressie]), b!.inputs.map((c) => [c.label, c.expressie]));
  assert.deepEqual(x!.outputs.map((c) => c.label), b!.outputs.map((c) => c.label));
  const norm = (v: string) => (v === "-" ? "" : v);
  assert.deepEqual(x!.rules.map((r) => [r.in.map(norm), r.out, r.toelichting]), b!.rules.map((r) => [r.in, r.out, r.toelichting]));
  assert.deepEqual(fromXml("geen xml"), []);
});

test("the view: one column per input and output, a row per rule, the hit policy in words", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const out = renderToStaticMarkup(<BeslistabelView tabel={fromXml(xml)[0]!} />);
  assert.match(out, /Hit policy FIRST: de eerste regel die past, telt\./);
  assert.equal((out.match(/<tr /g) ?? []).length, 3); // head + 2 rules
  assert.match(out, /<code[^>]*>null, &quot;&quot;<\/code>/);
  assert.match(out, /<span class="text-muted">–<\/span>/);
});

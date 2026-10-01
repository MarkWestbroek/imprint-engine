import assert from "node:assert/strict";
import { test } from "node:test";
import { anchor, describe, quoteOf } from "../src/anchor";

const v1 = "Common Ground is een beweging. De interne notities zijn niet openbaar. Dat verandert.";

test("describe: the quote with its context and position", () => {
  const start = v1.indexOf("interne notities");
  const [quote, position] = describe(v1, start, start + "interne notities".length);
  assert.equal(quote.exact, "interne notities");
  assert.equal(quote.prefix, v1.slice(start - 32, start), "32 characters before");
  assert.equal(quote.suffix, v1.slice(start + 16, start + 48), "32 characters after");
  assert.deepEqual(position, { type: "TextPositionSelector", start, end: start + 16 });
  assert.equal(quoteOf([quote, position]), "interne notities");
});

test("anchor: unchanged passage, text changed before it (a paragraph was added)", () => {
  const start = v1.indexOf("interne notities");
  const selectors = describe(v1, start, start + 16);
  const v2 = "Nieuw: een alinea vooraf. " + v1;
  const hit = anchor(v2, selectors);
  assert.ok(hit);
  assert.equal(v2.slice(hit.start, hit.end), "interne notities");
  assert.notEqual(hit.start, start, "the position moved; the quote found it");
});

test("anchor: several occurrences — the context picks the right one, the position breaks a tie", () => {
  const text = "De kern. Nog eens: de kern. En tot slot de kern van de zaak.";
  const second = text.indexOf("de kern", 10);
  const selectors = describe(text, second, second + 7);
  assert.deepEqual(anchor(text, selectors), { start: second, end: second + 7 });
  // Only a position, context-less: nearest occurrence wins.
  const third = text.indexOf("de kern", second + 1);
  assert.deepEqual(anchor(text, [{ type: "TextQuoteSelector", exact: "de kern" }, { type: "TextPositionSelector", start: third + 1, end: third + 8 }]), { start: third, end: third + 7 });
});

test("anchor: a changed or removed passage is an orphan, never a guess", () => {
  const start = v1.indexOf("interne notities");
  const selectors = describe(v1, start, start + 16);
  assert.equal(anchor(v1.replace("interne notities", "interne stukken"), selectors), null);
  assert.equal(anchor("", selectors), null);
  assert.equal(anchor(v1, [{ type: "TextPositionSelector", start, end: start + 16 }]), null, "a position alone cannot be verified");
});

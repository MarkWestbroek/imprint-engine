import assert from "node:assert/strict";
import { test } from "node:test";

import { publicMessages } from "../src/messages";

test("the public texts are complete in every language", () => {
  const keys = Object.keys(publicMessages.en.search).sort();
  for (const [locale, texts] of Object.entries(publicMessages)) {
    assert.deepEqual(Object.keys(texts.search).sort(), keys, locale);
  }
  assert.deepEqual(Object.keys(publicMessages).sort(), ["en", "nl", "pl"]);
});

test("counts of results read right, also in Polish", () => {
  assert.deepEqual([0, 1, 2].map(publicMessages.nl.search.results), ["Geen resultaten", "1 resultaat", "2 resultaten"]);
  assert.deepEqual([1, 3, 5, 12, 22].map(publicMessages.pl.search.results), ["1 wynik", "3 wyniki", "5 wyników", "12 wyników", "22 wyniki"]);
});

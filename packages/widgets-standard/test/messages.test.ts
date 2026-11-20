import assert from "node:assert/strict";
import { test } from "node:test";

import { messages } from "../src/messages";

/** Every language has every text (the type says so; this also catches an empty one). */
test("the widget texts are complete in every language", () => {
  const keys = Object.keys(messages.en).sort();
  for (const [locale, texts] of Object.entries(messages)) {
    assert.deepEqual(Object.keys(texts).sort(), keys, locale);
    for (const [key, value] of Object.entries(texts)) {
      const text = typeof value === "function" ? (value as (...a: string[]) => string)("x", "y") : value;
      assert.ok(String(text).trim().length > 0, `${locale}.${key} is empty`);
    }
  }
  assert.deepEqual(Object.keys(messages).sort(), ["en", "nl", "pl"]);
});

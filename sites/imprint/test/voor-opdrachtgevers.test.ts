import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { standardWidgets } from "@imprint/widgets-standard/schemas";

/**
 * /voor-opdrachtgevers.md tells other people's AI assistants what Imprint can
 * do. A standard widget that is not in it would never be offered: add it
 * there (with one line on what it is) when you add a widget.
 */
const doc = readFileSync(path.resolve(import.meta.dirname, "../public/voor-opdrachtgevers.md"), "utf8");

test("every standard widget is in the document for opdrachtgevers", () => {
  const missing = Object.values(standardWidgets)
    .map((w) => w.label.replace(/\s*\(.*\)$/, ""))
    .filter((label) => !doc.includes(`**${label}`));
  assert.deepEqual(missing, []);
});

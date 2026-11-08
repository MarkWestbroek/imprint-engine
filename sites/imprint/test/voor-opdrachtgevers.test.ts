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
const LANGS = ["", ".en", ".pl"]; // nl, en, pl: keep them in step

for (const lang of LANGS) {
  const file = `voor-opdrachtgevers${lang}.md`;
  const doc = readFileSync(path.resolve(import.meta.dirname, "../public", file), "utf8");
  test(`every standard widget is in ${file}`, () => {
    const missing = Object.values(standardWidgets)
      .map((w) => w.label.replace(/\s*\(.*\)$/, ""))
      .filter((label) => !doc.includes(`**${label}`));
    assert.deepEqual(missing, []);
  });
  test(`${file} has the same outline as the Dutch one (sections, table rows, template headings)`, () => {
    const nl = readFileSync(path.resolve(import.meta.dirname, "../public/voor-opdrachtgevers.md"), "utf8");
    const shape = (s: string) => [s.match(/^## /gm)?.length, s.match(/^\| /gm)?.length, s.match(/^- \*\*/gm)?.length];
    assert.deepEqual(shape(doc), shape(nl));
  });
}

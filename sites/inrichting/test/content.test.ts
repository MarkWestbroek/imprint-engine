import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PageLayoutSchema } from "@imprint/content-core";
import { widgetRegistry } from "../src/widgets/registry";
import { widgetComponents } from "../src/widgets/components";

/** The seed content fits this site's catalogue, and every widget in it has a viewer. */

const page = (slug: string) => JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "content", "pages", `${slug}.json`), "utf8"));

test("home: a valid layout with the register lists", () => {
  const layout = widgetRegistry.parseLayout(PageLayoutSchema.parse(page("home").layout));
  const types = layout.rows!.flatMap((r) => r.cells.flatMap((c) => c.widgets.map((w) => w.type)));
  assert.deepEqual(types, ["text", "omnium-lijst", "omnium-lijst"]);
});

test("every widget in the catalogue has a viewer", () => {
  for (const name of widgetRegistry.names()) assert.ok(widgetComponents[name], `viewer for ${name}`);
});

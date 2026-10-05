import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell } from "../src/admin-server/stats-files";

test("csvCell: plain stays plain; separators quoted; a formula start is defused", () => {
  assert.equal(csvCell("haven"), "haven");
  assert.equal(csvCell(3), "3");
  assert.equal(csvCell('a;b "c"'), '"a;b ""c"""');
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell("+31"), `"'+31"`);
  assert.equal(csvCell("@sum"), `"'@sum"`);
});

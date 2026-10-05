import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, fileStamp } from "../src/admin-server/stats-files";

test("csvCell: plain stays plain; separators quoted; a formula start is defused", () => {
  assert.equal(csvCell("haven"), "haven");
  assert.equal(csvCell(3), "3");
  assert.equal(csvCell('a;b "c"'), '"a;b ""c"""');
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell("+31"), `"'+31"`);
  assert.equal(csvCell("@sum"), `"'@sum"`);
});

test("fileStamp: Dutch time, sortable, no colon", () => {
  assert.equal(fileStamp(new Date("2026-10-05T14:09:30Z")), "2026-10-05 16u09");
  assert.equal(fileStamp(new Date("2026-12-31T23:30:00Z")), "2027-01-01 00u30");
});

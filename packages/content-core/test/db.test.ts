import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dialectOf } from "../src/db";

/** Backend selection by URL scheme (architecture.md §0: the composition root picks one). */
describe("dialectOf", () => {
  it("maps URL schemes to a dialect", () => {
    assert.equal(dialectOf("mysql://u:p@localhost:3306/db"), "mysql");
    assert.equal(dialectOf("mariadb://u:p@localhost/db"), "mysql");
    assert.equal(dialectOf("postgres://u:p@localhost:5433/db"), "postgres");
    assert.equal(dialectOf("postgresql://u:p@localhost/db"), "postgres");
    assert.equal(dialectOf("POSTGRES://x"), "postgres");
  });

  it("refuses anything else with a helpful message", () => {
    assert.throws(() => dialectOf("sqlite://file.db"), /unsupported scheme "sqlite"/);
    assert.throws(() => dialectOf("nonsense"), /unsupported scheme/);
  });
});

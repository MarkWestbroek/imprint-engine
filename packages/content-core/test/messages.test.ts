import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { catalogLocales, formatDate, messagesFor, type Catalog } from "../src/messages";

describe("fixed texts per language", () => {
  const catalog = { en: { next: "Next" }, nl: { next: "Volgende" } } satisfies Catalog<{ next: string }>;

  it("picks the language, and English when the catalogue lacks it or none is given", () => {
    assert.equal(messagesFor(catalog, "nl").next, "Volgende");
    assert.equal(messagesFor(catalog, "pl").next, "Next");
    assert.equal(messagesFor(catalog).next, "Next");
    assert.deepEqual(catalogLocales(catalog), ["en", "nl"]);
  });
});

describe("formatDate", () => {
  it("writes a plain day in the language, not shifted by a time zone", () => {
    assert.equal(formatDate("nl", "2026-10-03"), "3 oktober 2026");
    assert.equal(formatDate("en", "2026-10-03"), "October 3, 2026");
    assert.equal(formatDate("pl", "2026-10-03"), "3 października 2026");
    assert.equal(formatDate("nl", "2026-01-01", "date", "America/New_York"), "1 januari 2026");
  });

  it("shows a moment in the given time zone", () => {
    assert.equal(formatDate("nl", "2026-12-31T23:30:00Z"), "1 januari 2027", "Amsterdam is past midnight");
    assert.equal(formatDate("nl", new Date("2026-12-31T23:30:00Z"), "date", "UTC"), "31 december 2026");
    assert.match(formatDate("nl", "2026-06-01T10:00:00Z", "datetime"), /1 jun.* 2026.*12:00/);
    assert.equal(formatDate("nl", "2026-06-01", "short"), "1-6-2026");
  });

  it("hands an unreadable value back", () => {
    assert.equal(formatDate("nl", "nonsense"), "nonsense");
  });
});

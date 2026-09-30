import assert from "node:assert/strict";
import { test } from "node:test";
import { termHref, termSlug, termSummary } from "../src/href";
import { TermSchema } from "../src/schemas";

test("termSlug: lower case, diacritics off, hyphens", () => {
  assert.equal(termSlug("Financiën & Beheer"), "financien-beheer");
  assert.equal(termSlug("CRUD API"), "crud-api");
  assert.equal(termSlug("—"), "term");
});

test("termHref: the plugin's URL space", () => {
  assert.equal(termHref("abac"), "/terms/abac");
});

test("termSummary: the summary, else the text without Markdown, cut at a word", () => {
  assert.equal(termSummary({ summary: "Kort.", body: "Lang verhaal" }), "Kort.");
  assert.equal(
    termSummary({ summary: "", body: "**ABAC** staat voor [Attribute-Based](/term/abac) Access Control." }),
    "ABAC staat voor Attribute-Based Access Control."
  );
  assert.equal(termSummary({ summary: "", body: "een twee drie vier" }, 9), "een twee…");
});

test("TermSchema: defaults for summary, body and tags", () => {
  const term = TermSchema.parse({ slug: "api", title: "API" });
  assert.deepEqual([term.summary, term.body, term.tags, term.access], ["", "", [], "public"]);
});

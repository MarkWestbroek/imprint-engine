import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate, postHref, postSlug, postSummary } from "../src/href";
import { PostSchema } from "../src/schemas";

test("postSlug and postHref", () => {
  assert.equal(postSlug("Fieldlab Enschede: wat we leerden!"), "fieldlab-enschede-wat-we-leerden");
  assert.equal(postHref("x"), "/blog/x");
});

test("postSummary: summary first, else the text without Markdown, cut at a word", () => {
  assert.equal(postSummary({ summary: "Kort.", body: "lang" }), "Kort.");
  assert.equal(postSummary({ summary: "", body: "**Vet** en [link](/x) hier." }), "Vet en link hier.");
  assert.equal(postSummary({ summary: "", body: "een twee drie vier" }, 9), "een twee…");
});

test("formatDate: a Dutch long date, unaffected by time zones", () => {
  assert.equal(formatDate("2026-10-03"), "3 oktober 2026");
  assert.equal(formatDate("nonsense"), "nonsense");
});

test("PostSchema: a date is required, the rest has defaults", () => {
  const post = PostSchema.parse({ slug: "a", title: "A", publishedAt: "2026-10-01" });
  assert.deepEqual([post.access, post.author, post.tags, post.group, post.summary], ["public", "", [], "", ""]);
  assert.equal(PostSchema.safeParse({ slug: "a", title: "A", publishedAt: "1 okt" }).success, false);
});

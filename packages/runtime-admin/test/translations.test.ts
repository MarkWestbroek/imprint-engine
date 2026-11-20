import assert from "node:assert/strict";
import { test } from "node:test";

import type { ContentRecord } from "@imprint/content-core";
import { isOutdated, translationStart } from "../src/admin-server/translation-state";

const row = (lang: string, txFrom: string, data: Record<string, unknown> = {}): ContentRecord =>
  ({ id: 1, type: "page", slug: "over", lang, data, validFrom: new Date(txFrom), validTo: null, txFrom: new Date(txFrom), txTo: null, createdBy: null }) as ContentRecord;

test("a translation is outdated when the base language was changed after it", () => {
  const nl = row("nl", "2026-11-20T10:00:00Z");
  assert.equal(isOutdated(row("en", "2026-11-19T10:00:00Z"), nl), true);
  assert.equal(isOutdated(row("en", "2026-11-21T10:00:00Z"), nl), false, "saved after the source: up to date");
  assert.equal(isOutdated(nl, nl), false, "the source is never outdated against itself");
  assert.equal(isOutdated(null, nl), false);
  assert.equal(isOutdated(row("en", "2026-11-19T10:00:00Z"), null), false, "no source to be behind on");
});

test("a new translation starts as a copy in the new language, as a draft where the type has drafts", () => {
  const source = row("nl", "2026-11-20T10:00:00Z", { slug: "over", lang: "nl", title: "Over ons", draft: false });
  assert.deepEqual(translationStart(source, "en"), { slug: "over", lang: "en", title: "Over ons", draft: true });
  assert.equal((source.data as { lang: string }).lang, "nl", "the source is not touched");
  const menu = row("nl", "2026-11-20T10:00:00Z", { name: "main", items: [] });
  assert.deepEqual(translationStart(menu, "en"), { name: "main", items: [] }, "a type without lang or draft is copied as it is");
});

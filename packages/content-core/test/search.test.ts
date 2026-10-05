import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { ContentTypeDefinition } from "../src/content-types";
import type { ContentStore } from "../src/store";
import { parseQuery, plain, search, searchKinds, searchLooksAutomated } from "../src/search";

const store = {} as ContentStore; // the fake sources below ignore it

const defs: ContentTypeDefinition[] = [
  {
    name: "group",
    schema: z.object({}),
    label: "Groups",
    search: {
      kinds: { group: { label: "community", prefixes: ["community", "groep", "group"] } },
      docs: async () => [
        { kind: "group", href: "/groups/archi", title: "Architectuur voor Dienstverlening", summary: "", text: "architectuur klantreis" },
        { kind: "group", href: "/groups/atlas", title: "Atlas", summary: "", text: "geo-viewer architectuur" },
      ],
    },
  },
  {
    name: "post",
    schema: z.object({}),
    label: "Posts",
    search: {
      kinds: { blog: { label: "blog", prefixes: ["blog"] }, news: { label: "nieuws", prefixes: ["nieuws", "news"] } },
      docs: async () => [
        { kind: "blog", href: "/blog/a", title: "Over TOGAF", summary: "", text: "architectuurmethode" },
        { kind: "news", href: "/blog/b", title: "Architectuurdag", summary: "", text: "verslag" },
      ],
    },
  },
];

describe("search: prefixes, matching, ranking", () => {
  it("knows the kinds and their prefixes; parses a prefix in Dutch or English", () => {
    const kinds = searchKinds(defs);
    assert.deepEqual(Object.keys(kinds), ["group", "blog", "news"]);
    assert.deepEqual(parseQuery("community: archi", kinds), { kind: "group", terms: ["archi"] });
    assert.deepEqual(parseQuery("Groep:Arch", kinds), { kind: "group", terms: ["arch"] });
    assert.deepEqual(parseQuery("onbekend: x", kinds), { kind: null, terms: ["onbekend:", "x"] });
    assert.deepEqual(parseQuery("archi", kinds), { kind: null, terms: ["archi"] });
  });

  it("a prefix narrows to one kind; without one everything is searched, title hits first", async () => {
    const narrowed = await search(defs, store, "community: archi");
    assert.deepEqual(narrowed.hits.map((h) => h.title), ["Architectuur voor Dienstverlening", "Atlas"], "title hit before text hit");
    assert.deepEqual([narrowed.kind, narrowed.counts], ["group", { group: 2 }]);
    const all = await search(defs, store, "architectuur");
    assert.deepEqual(all.hits.map((h) => [h.label, h.title]), [["community", "Architectuur voor Dienstverlening"], ["nieuws", "Architectuurdag"], ["community", "Atlas"], ["blog", "Over TOGAF"]]);
    assert.deepEqual(all.counts, { group: 2, news: 1, blog: 1 });
  });

  it("every term must occur; diacritics and case do not matter; an empty query gives nothing", async () => {
    assert.equal((await search(defs, store, "atlas architectuur")).hits.length, 1);
    assert.equal((await search(defs, store, "atlas togaf")).hits.length, 0);
    assert.equal((await search(defs, store, "ARCHITECTUÚR")).hits.length, 4);
    assert.equal((await search(defs, store, "  ")).hits.length, 0);
  });

  it("plain: strips Markdown and cuts at a word", () => {
    assert.equal(plain("**Vet** en [link](/x) hier.  Meer."), "Vet en link hier. Meer.");
    assert.equal(plain("een twee drie vier", 9), "een twee…");
  });
});

describe("searchLooksAutomated", () => it("scanner markers and probes yes, real queries no", () => {
  for (const q of ["XzZnWQWF", "sPbkyDhN", "FQdNRxVA", "TlqgUPWm", "../../../../etc/passwd", "/WEB-INF/web.xml", "windows/system.ini", "<script>alert(1)</script>", "1 union select 2", "${jndi:x}", "x".repeat(130)]) {
    assert.equal(searchLooksAutomated(q), true, q);
  }
  for (const q of ["haven", "Fieldlab", "fieldlab", "VNG", "VTH", "OpenZaak", "Open Zaak", "IMG100.000+", "OpenWoo.app", "community: archi", "digitale identiteit", "Haven", "CGTS", "redhat"]) {
    assert.equal(searchLooksAutomated(q), false, q);
  }
}));

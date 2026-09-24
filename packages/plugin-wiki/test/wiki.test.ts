import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wikiContentTypes } from "../src/content-types";
import { scopedSlug, slugify, wikiPageHref } from "../src/href";
import { legacyVisibilityToAccess, WikiFolderSchema, WikiPageSchema, WikiSchema } from "../src/schemas";

describe("wiki plugin", () => {
  it("maps the pre-Fase-3 visibility onto access, and leaves access alone when present", () => {
    assert.deepEqual(legacyVisibilityToAccess({ visibility: "members", title: "t" }), { title: "t", access: "restricted" });
    assert.deepEqual(legacyVisibilityToAccess({ visibility: "public" }), { access: "public" });
    assert.deepEqual(legacyVisibilityToAccess({ visibility: "members", access: "public" }), { access: "public" });
    assert.equal(WikiSchema.parse({ slug: "help", title: "Help", visibility: "members" }).access, "restricted");
    assert.equal(WikiSchema.parse({ slug: "help", title: "Help" }).access, "public");
  });

  it("builds a page's URL from its folder chain, resolving on the page slug", () => {
    const folders = [
      WikiFolderSchema.parse({ slug: "help-basics", wiki: "help", title: "Basics" }),
      WikiFolderSchema.parse({ slug: "help-basics-setup", wiki: "help", parent: "help-basics", title: "Setup" }),
    ];
    const page = WikiPageSchema.parse({ slug: "help-install", wiki: "help", folder: "help-basics-setup", title: "Install" });
    assert.equal(wikiPageHref(page, folders), "/help/help-basics/help-basics-setup/help-install");
  });

  it("slugifies titles and scopes slugs per wiki, numbering collisions", () => {
    assert.equal(slugify("Héllo, Wörld!"), "hello-world");
    assert.equal(scopedSlug("help", "Install", new Set()), "help-install");
    assert.equal(scopedSlug("help", "Install", new Set(["help-install", "help-install-2"])), "help-install-3");
  });

  it("brings its three content types with their relation rules", () => {
    assert.deepEqual(wikiContentTypes.map((d) => d.name), ["wiki", "wiki-folder", "wiki-page"]);
    assert.equal(wikiContentTypes.flatMap((d) => d.relations ?? []).length, 4);
  });
});

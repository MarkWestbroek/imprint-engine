import assert from "node:assert/strict";
import { test } from "node:test";
import { groupHref, groupPagePrefix, groupSlug, groupsHref } from "../src/href";
import { GroupSchema } from "../src/schemas";

test("groupSlug: lower case, diacritics off, hyphens", () => {
  assert.equal(groupSlug("Gemeentelijk Gegevenswoordenboek"), "gemeentelijk-gegevenswoordenboek");
  assert.equal(groupSlug("Alkmaar in transitie!"), "alkmaar-in-transitie");
  assert.equal(groupSlug("—"), "group");
});

test("hrefs: the plugin's URL space", () => {
  assert.equal(groupsHref(), "/groups");
  assert.equal(groupHref("atlas"), "/groups/atlas");
  assert.equal(groupPagePrefix("atlas"), "groups/atlas/");
});

test("GroupSchema: defaults", () => {
  const g = GroupSchema.parse({ slug: "atlas", title: "Atlas" });
  assert.deepEqual(
    [g.summary, g.introduction, g.body, g.tags, g.closed, g.membershipOnRequest, g.wiki, g.access],
    ["", "", "", [], false, false, "", "public"]
  );
  assert.equal(g.memberCount, undefined);
});

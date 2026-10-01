import type { ContentStore, WritableContentStore } from "@imprint/content-core";

/** A post of the group (plugin-blog's `post`), as far as the group page needs it; the type is known by name only. */
export type GroupPost = { slug: string; title: string; publishedAt: string; author: string; kind: string };

/**
 * The group's posts as `reader` may see them, newest first: the anonymous
 * store for the prerendered page, a member's own store (with their groups)
 * for the timeline they fetch in the browser.
 */
export async function groupPosts(reader: ContentStore, slug: string, limit = 15): Promise<GroupPost[]> {
  const listing = reader as Partial<WritableContentStore>;
  if (typeof listing.listItems !== "function") return [];
  try {
    return (await listing.listItems("post"))
      .map((r) => r.data as Partial<GroupPost> & { group?: string })
      .filter((p): p is GroupPost & { group: string } => p.group === slug && typeof p.slug === "string" && typeof p.title === "string")
      .map((p) => ({ slug: p.slug, title: p.title, publishedAt: p.publishedAt ?? "", author: p.author ?? "", kind: p.kind ?? "blog" }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit);
  } catch {
    return []; // no such type on this site
  }
}

import type { ContentStore, WritableContentStore } from "@imprint/content-core";
import { PostSchema, type Post } from "./schemas";

/** A store that can list by type: the writable one, or a guarded one made from it (as the instance's `store` is). */
type Listing = Pick<WritableContentStore, "listItems" | "getItem">;
const canList = (store: ContentStore): store is ContentStore & Listing =>
  typeof (store as Partial<Listing>).listItems === "function";

/** Current posts, newest first; `group` narrows to one group's, `tag` to one tag. */
export async function listPosts(store: ContentStore, opts: { group?: string; tag?: string } = {}): Promise<Post[]> {
  if (!canList(store)) return [];
  const records = await store.listItems("post");
  return records
    .map((r) => PostSchema.safeParse(r.data))
    .filter((r) => r.success)
    .map((r) => r.data)
    .filter((p) => (opts.group === undefined || p.group === opts.group) && (!opts.tag || p.tags.includes(opts.tag)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title, "nl"));
}

export async function getPost(store: ContentStore, slug: string): Promise<Post | null> {
  if (!canList(store)) return null;
  const record = await store.getItem("post", slug);
  const parsed = record ? PostSchema.safeParse(record.data) : null;
  return parsed?.success ? parsed.data : null;
}

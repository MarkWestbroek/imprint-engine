import Link from "next/link";
import { z } from "zod";
import type { WidgetContext } from "@imprint/runtime-admin";
import { blogHref } from "./href";
import { PostList } from "./post-list";
import { listPosts } from "./posts";

/**
 * The latest posts, as a block on a page: the site's, one group's or one
 * tag's. Reads through the visitor's store, so a member-only post never
 * reaches a prerendered page.
 */
export const PostsConfig = z.object({
  title: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(5),
  /** Only posts of this group; empty = every post. */
  group: z.string().default(""),
  tag: z.string().default(""),
  showSummary: z.boolean().default(true),
  /** A link to the full overview under the list. */
  showMore: z.boolean().default(true),
});
export type PostsConfig = z.infer<typeof PostsConfig>;

export async function PostsWidget({ config, ctx }: { config: PostsConfig; ctx: WidgetContext }) {
  const posts = await listPosts(ctx.store, { group: config.group || undefined, tag: config.tag || undefined });
  return (
    <section>
      {config.title && <h2 className="mb-2 text-2xl font-semibold tracking-tight">{config.title}</h2>}
      <PostList posts={posts.slice(0, config.limit)} showSummary={config.showSummary} />
      {config.showMore && posts.length > config.limit && (
        <p className="mt-3 text-sm">
          <Link href={blogHref()} className="font-semibold text-accent hover:underline">
            Alle berichten ({posts.length}) →
          </Link>
        </p>
      )}
    </section>
  );
}

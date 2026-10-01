import { definePlugin, type ImprintPlugin, type WidgetViewers } from "@imprint/runtime-admin";
import { blogContentTypes } from "./content-types";
import { blogPublicRoute } from "./public";
import { PostsConfig, PostsWidget } from "./widget";

/**
 * @imprint/plugin-blog — blog posts as a plugin (design/communities.md §2):
 * the content type `post` (dated, with a writer, tags and optionally a
 * group; of kind blog, news or update), the `posts` widget (latest posts
 * of the site, a group or a tag), the overviews `/blog` and `/news` and a
 * page per post under `/blog/<slug>`. A site
 * switches it on with `plugins: [blogPlugin()]` and composes the widget into
 * its catalogue (`blogWidgets` / `blogViewers`).
 *
 * Node scripts import the React-free entries: `./content-types`, `./schemas`, `./href`.
 */

export const blogWidgets = [
  {
    name: "posts",
    label: "Posts",
    version: "1.0.0",
    help: "The latest blog posts: of the whole site, one group or one tag; with a link to the full overview.",
    configSchema: PostsConfig,
  },
] as const;

export const blogViewers: WidgetViewers = { posts: PostsWidget as WidgetViewers[string] };

export function blogPlugin(): ImprintPlugin {
  return definePlugin({
    name: "blog",
    version: "0.11.0",
    contentTypes: blogContentTypes,
    widgets: [...blogWidgets],
    menu: [{ group: "content", section: "Blog", items: [{ href: "/admin/post", label: "Posts" }] }],
    publicRoute: blogPublicRoute,
  });
}

export { blogContentTypes } from "./content-types";
export { BLOG_PREFIX, NEWS_PREFIX, blogHref, formatDate, newsHref, postHref, postSlug, postSummary } from "./href";
export { PostSchema, type Post } from "./schemas";
export { PostsConfig, type PostsConfig as PostsWidgetConfig } from "./widget";
export { getPost, listPosts } from "./posts";
export { PostList } from "./post-list";

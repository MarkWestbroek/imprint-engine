import Link from "next/link";
import { ANONYMOUS, contentResource, permit, userSubject } from "@imprint/content-core";
import { Markdown, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import { BLOG_PREFIX, NEWS_PREFIX, blogHref, formatDate, newsHref, postSummary } from "./href";
import { PostList } from "./post-list";
import { getPost, listPosts } from "./posts";
import type { Post } from "./schemas";

function PostView({ post }: { post: Post }) {
  return (
    <article className="max-w-3xl">
      {post.kind === "update" ? (
        <Link href={`/groups/${post.group}`} className="text-sm text-muted hover:underline">
          ← Community
        </Link>
      ) : post.kind === "news" ? (
        <Link href={newsHref()} className="text-sm text-muted hover:underline">
          ← Nieuws
        </Link>
      ) : (
        <Link href={blogHref()} className="text-sm text-muted hover:underline">
          ← Alle berichten
        </Link>
      )}
      <p className="mt-4 text-xs text-muted">
        {post.kind === "update" ? "Update · " : post.kind === "news" ? "Nieuws · " : ""}
        {formatDate(post.publishedAt)}
        {post.author && ` · ${post.author}`}
        {post.group && post.kind !== "update" && (
          <>
            {" · "}
            <Link href={`/groups/${post.group}`} className="hover:underline">
              community
            </Link>
          </>
        )}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element -- remote or library image, sized by CSS
        <img src={post.image} alt="" className="mt-6 max-h-96 w-full rounded-md object-cover" />
      )}
      <div className="markdown mt-6" data-annotation-field="body">
        <Markdown>{post.body || post.summary}</Markdown>
      </div>
      {post.source && (
        <p className="mt-6 text-sm">
          <a href={post.source} className="text-accent underline" target="_blank" rel="noopener noreferrer">
            Bron
          </a>
        </p>
      )}
      {post.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
          {post.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-line px-3 py-0.5 text-sm text-muted">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * `/blog` and `/news`: the overviews, newest first; `/blog/<slug>`: one post
 * (of any kind: news and updates share the address space). Public
 * posts render in the prerendered catch-all; a non-public one goes to
 * /members, where the PDP decides for the subject at hand.
 */
export async function blogPublicRoute({ imprint, slug, members, session, subject: given }: PublicRouteContext): Promise<PublicRouteResult | null> {
  if (slug[0] === NEWS_PREFIX && slug.length === 1) {
    const subject0 = given ?? (session ? userSubject(session.name, session.role) : ANONYMOUS);
    const posts = await listPosts(members ? imprint.storeFor(subject0) : imprint.store, { kind: "news" });
    return {
      render: (
        <section>
          <h1 className="mb-6 text-3xl font-semibold tracking-tight">Nieuws</h1>
          <PostList posts={posts} />
        </section>
      ),
      metadata: { title: "Nieuws" },
    };
  }
  if (slug[0] !== BLOG_PREFIX || slug.length > 2) return null;
  const subject = given ?? (session ? userSubject(session.name, session.role) : ANONYMOUS);
  const store = members ? imprint.storeFor(subject) : imprint.store;
  if (slug.length === 1) {
    const posts = await listPosts(store);
    return {
      render: (
        <section>
          <h1 className="mb-6 text-3xl font-semibold tracking-tight">Blog</h1>
          <PostList posts={posts} />
        </section>
      ),
      metadata: { title: "Blog" },
    };
  }
  const raw = imprint.writableStore ? await getPost(imprint.writableStore, slug[1]!) : null;
  if (!raw) return null;
  if (raw.access !== "public") {
    if (!members) return { redirect: `/members/${slug.join("/")}` };
    if (!(await permit(imprint.pdp, subject, "read", contentResource("post", raw.slug, raw)))) return null;
  }
  return { render: <PostView post={raw} />, metadata: { title: raw.title, description: postSummary(raw, 160) }, item: { type: "post", slug: raw.slug } };
}

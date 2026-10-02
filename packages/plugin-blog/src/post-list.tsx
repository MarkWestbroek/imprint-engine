import Link from "next/link";
import { formatDate, postHref, postSummary } from "./href";
import type { Post } from "./schemas";
import { mediaSrc } from "@imprint/runtime-admin/media-ref";

/** The posts as a list: date, title, summary, writer. Server-rendered; nothing to click but the links. */
export function PostList({ posts, showSummary = true }: { posts: Post[]; showSummary?: boolean }) {
  if (posts.length === 0) return <p className="text-muted">Nog geen berichten.</p>;
  return (
    <ul className="divide-y divide-line">
      {posts.map((p) => (
        <li key={p.slug} className="flex gap-4 py-4">
          {p.image && (
            // eslint-disable-next-line @next/next/no-img-element -- remote or library image, sized by CSS
            <img src={mediaSrc(p.image)} alt="" className="hidden h-20 w-28 shrink-0 rounded object-cover sm:block" loading="lazy" />
          )}
          <div className="min-w-0">
            <p className="text-xs text-muted">
              {formatDate(p.publishedAt)}
              {p.author && ` · ${p.author}`}
            </p>
            <Link href={postHref(p.slug)} className="mt-0.5 block text-lg font-semibold text-accent hover:underline">
              {p.title}
            </Link>
            {showSummary && postSummary(p) && <p className="mt-1 text-[15px] leading-relaxed">{postSummary(p)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

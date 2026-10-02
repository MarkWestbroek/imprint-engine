"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { ActionResult, JoinStatus } from "./actions";
import { PostForm } from "./post-form";

import type { GroupPost as GroupPostItem } from "./timeline";

const KIND: Record<string, string> = { update: "update", news: "nieuws", blog: "blog" };

/**
 * The group's timeline (design/communities.md §4.3, G3a): the posts as the
 * page was rendered, and — for an active member, asked in the browser — a
 * form to write an update or a blog, and "verwijderen" on their own posts
 * (managers: on any post of the group). Writing goes through the plugin's
 * actions; the page is re-fetched afterwards.
 */
export function GroupPosts({ slug, posts: initial, closed, call }: { slug: string; posts: GroupPostItem[]; closed: boolean; call?: PluginCall }) {
  const router = useRouter();
  const [state, setState] = useState<JoinStatus | null>(null);
  // The page is prerendered with the public posts; a signed-in visitor fetches the timeline as they may see it.
  const [posts, setPosts] = useState<GroupPostItem[]>(initial);
  const [writing, setWriting] = useState(false);
  /** The slug of the post being edited; null = writing a new one. */
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!call) return;
    const status = (await call("groups", "status", slug)) as JoinStatus | null;
    setState(status);
    if (status?.signedIn) setPosts((await call("groups", "posts", slug)) as GroupPostItem[]);
  }, [call, slug]);
  useEffect(() => {
    refresh().catch(() => setState(null));
    const onChange = () => refresh().catch(() => setState(null));
    window.addEventListener("imprint:membership", onChange);
    return () => window.removeEventListener("imprint:membership", onChange);
  }, [refresh]);

  const member = state?.membership?.status === "active";
  const own = (p: GroupPostItem) => !!state?.name && p.author === state.name;
  const mayRemove = (p: GroupPostItem) => !!state && (state.canManage || own(p));

  const startEdit = (postSlug: string) => {
    setError(null);
    setEditing(postSlug);
    setWriting(true);
  };

  const cancel = () => {
    setWriting(false);
    setEditing(null);
  };

  const remove = async (postSlug: string) => {
    if (!call || !confirm("Dit bericht verwijderen?")) return;
    const result = (await call("groups", "removePost", slug, postSlug)) as ActionResult;
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    await refresh();
    router.refresh();
  };

  const button = "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60";

  return (
    <section className="mt-10 max-w-3xl">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold">Berichten</h2>
        {member && !writing && (
          <button type="button" className={button} onClick={() => { setEditing(null); setWriting(true); }}>
            Schrijf een bericht
          </button>
        )}
      </div>
      {writing && call && (
        <PostForm
          group={slug}
          call={call}
          closed={closed}
          editing={editing}
          onCancel={cancel}
          onDone={async () => {
            cancel();
            await refresh();
            router.refresh();
          }}
        />
      )}
      {!writing && error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {posts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nog geen berichten.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {posts.map((p) => (
            <li key={p.slug} className="flex items-baseline justify-between gap-3 py-2">
              <span>
                <Link href={`/blog/${p.slug}`} className="font-semibold text-accent hover:underline">
                  {p.title}
                </Link>
                <span className="ml-2 text-sm text-muted">
                  {KIND[p.kind] ? `${KIND[p.kind]} · ` : ""}
                  {p.publishedAt}
                  {p.author && ` · ${p.author}`}
                </span>
              </span>
              <span className="flex shrink-0 gap-3">
                {own(p) && (
                  <button type="button" className="text-xs text-muted underline-offset-2 hover:underline" onClick={() => startEdit(p.slug)}>
                    bewerken
                  </button>
                )}
                {mayRemove(p) && (
                  <button type="button" className="text-xs text-muted underline-offset-2 hover:underline" onClick={() => remove(p.slug)}>
                    verwijderen
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

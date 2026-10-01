"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { ActionResult, JoinStatus, PostInput } from "./actions";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<PostInput["kind"]>("update");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [membersOnly, setMembersOnly] = useState(closed);

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
  const mayRemove = (p: GroupPostItem) => !!state && (state.canManage || (!!state.name && p.author === state.name));

  const submit = async () => {
    if (!call) return;
    setBusy(true);
    setError(null);
    const result = (await call("groups", "writePost", slug, { kind, title, body, membersOnly } satisfies PostInput)) as ActionResult;
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    setTitle("");
    setBody("");
    setWriting(false);
    await refresh();
    router.refresh();
  };

  const remove = async (postSlug: string) => {
    if (!call || !confirm("Dit bericht verwijderen?")) return;
    const result = (await call("groups", "removePost", slug, postSlug)) as ActionResult;
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    await refresh();
    router.refresh();
  };

  const input = "w-full rounded-md border border-line bg-background px-3 py-2";
  const button = "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60";

  return (
    <section className="mt-10 max-w-3xl">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold">Berichten</h2>
        {member && !writing && (
          <button type="button" className={button} onClick={() => setWriting(true)}>
            Schrijf een bericht
          </button>
        )}
      </div>
      {writing && (
        <form
          className="mt-4 space-y-3 rounded-md border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-wrap gap-4">
            <label className="text-sm">
              Soort{" "}
              <select value={kind} onChange={(e) => setKind(e.target.value as PostInput["kind"])} className="ml-1 rounded-md border border-line bg-background px-2 py-1">
                <option value="update">update (kort bericht)</option>
                <option value="blog">blog</option>
              </select>
            </label>
            <label className="text-sm">
              Zichtbaar voor{" "}
              <select value={membersOnly ? "group" : "public"} onChange={(e) => setMembersOnly(e.target.value === "group")} className="ml-1 rounded-md border border-line bg-background px-2 py-1">
                <option value="group">leden van deze community</option>
                <option value="public">iedereen</option>
              </select>
            </label>
          </div>
          <input className={input} placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={160} />
          <textarea className={`${input} min-h-32`} placeholder="Je bericht (Markdown mag)" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={20000} />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className={button} disabled={busy}>
              {busy ? "Bezig…" : "Plaatsen"}
            </button>
            <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => setWriting(false)}>
              Annuleren
            </button>
          </div>
        </form>
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
              {mayRemove(p) && (
                <button type="button" className="shrink-0 text-xs text-muted underline-offset-2 hover:underline" onClick={() => remove(p.slug)}>
                  verwijderen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

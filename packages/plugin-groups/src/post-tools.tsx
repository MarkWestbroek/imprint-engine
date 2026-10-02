"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { ActionResult, PostRights } from "./actions";
import { groupHref } from "./href";
import { PostForm } from "./post-form";

/**
 * On a post's own page (design/communities.md §4.3, G3a+): "bewerken" and
 * "verwijderen" for whoever the policy allows — the writer, and for removing
 * also the group's managers. Asked in the browser, so the page itself stays
 * prerendered; nothing shows for anyone else. The site mounts it above the
 * post (the blog plugin knows nothing of groups).
 */
export function PostTools({ slug, call }: { slug: string; call?: PluginCall }) {
  const router = useRouter();
  const [rights, setRights] = useState<PostRights | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!call) return;
    let live = true;
    (call("groups", "mine", slug) as Promise<PostRights | null>).then((r) => live && setRights(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [call, slug]);

  if (!call || !rights || (!rights.canEdit && !rights.canRemove)) return null;
  const quiet = "underline-offset-2 hover:underline";

  const remove = async () => {
    if (!confirm("Dit bericht verwijderen?")) return;
    const result = (await call("groups", "removePost", rights.group, slug)) as ActionResult;
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    router.push(groupHref(rights.group));
    router.refresh();
  };

  return (
    <div className="mb-6 max-w-3xl">
      {!editing && (
        <p className="flex flex-wrap gap-4 rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
          <span>{rights.own ? "Dit is jouw bericht." : "Je beheert dit bericht."}</span>
          {rights.canEdit && (
            <button type="button" className={quiet} onClick={() => setEditing(true)}>
              bewerken
            </button>
          )}
          {rights.canRemove && (
            <button type="button" className={quiet} onClick={remove}>
              verwijderen
            </button>
          )}
        </p>
      )}
      {editing && (
        <PostForm
          group={rights.group}
          call={call}
          editing={slug}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

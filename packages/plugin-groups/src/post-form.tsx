"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import { mediaSrc } from "@imprint/runtime-admin/media-ref";
import type { ActionResult, PostInput } from "./actions";

/**
 * The form a member writes or changes a post with (design/communities.md
 * §4.3, G3a+): kind, who sees it, a title, an image and the text. Shared by
 * the group's timeline and the post's own page. The text is edited with the
 * engine's Markdown editor ("Visueel" and "Markdown"), loaded when the form
 * opens so the public pages stay light; its image button and the image field
 * upload through the plugin's `uploadImage` action — the member's own
 * picture, into the library, as the policy allows.
 */

const Editor = dynamic(() => import("@imprint/runtime-admin/admin").then((m) => m.MarkdownEditor), {
  ssr: false,
  loading: () => <p className="rounded-md border border-line bg-background px-3 py-8 text-sm text-muted">De editor laadt…</p>,
});

const pickFile = () =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });

type Props = {
  group: string;
  call: PluginCall;
  /** A closed group: new posts are for members unless the writer says otherwise. */
  closed?: boolean;
  /** The slug of the post being changed; absent = a new post. */
  editing?: string | null;
  onDone: (slug?: string) => void;
  onCancel: () => void;
};

export function PostForm({ group, call, closed = false, editing = null, onDone, onCancel }: Props) {
  const [kind, setKind] = useState<PostInput["kind"]>("update");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [membersOnly, setMembersOnly] = useState(closed);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!editing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let live = true;
    (async () => {
      const current = (await call("groups", "post", group, editing)) as (PostInput & { slug: string }) | null;
      if (!live) return;
      if (!current) return setError("Dit bericht is niet te laden.");
      setKind(current.kind);
      setTitle(current.title);
      setBody(current.body);
      setImage(current.image ?? "");
      setMembersOnly(current.membersOnly);
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [call, group, editing]);

  /** Ask for a picture and put it in the library; the reference, or null. */
  const upload = async (): Promise<string | null> => {
    const file = await pickFile();
    if (!file) return null;
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const result = (await call("groups", "uploadImage", group, form)) as ActionResult & { slug?: string };
    if (!result.ok || !result.slug) {
      setError(result.error ?? "Het beeld kon niet worden toegevoegd.");
      return null;
    }
    return result.slug;
  };

  const submit = async () => {
    if (!body.trim()) return setError("Schrijf een bericht.");
    setBusy(true);
    setError(null);
    const input = { kind, title, body, membersOnly, image } satisfies PostInput;
    const result = (editing ? await call("groups", "editPost", group, editing, input) : await call("groups", "writePost", group, input)) as ActionResult & { slug?: string };
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    onDone(result.slug ?? editing ?? undefined);
  };

  const field = "w-full rounded-md border border-line bg-background px-3 py-2";
  const button = "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60";
  const quiet = "text-sm text-muted underline-offset-2 hover:underline";

  return (
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
      <input className={field} placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={160} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a library image, shown small */}
            <img src={mediaSrc(image)} alt="" className="h-16 w-24 rounded object-cover" />
            <button type="button" className={quiet} onClick={() => setImage("")}>
              beeld weghalen
            </button>
          </>
        ) : (
          <button
            type="button"
            className={quiet}
            onClick={async () => {
              const slug = await upload();
              if (slug) setImage(`asset:${slug}`);
            }}
          >
            + beeld bovenaan het bericht
          </button>
        )}
      </div>
      {ready && (
        <Editor
          value={body}
          onChange={setBody}
          rows={10}
          pickImage={async () => {
            const slug = await upload();
            return slug ? { slug } : null;
          }}
        />
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className={button} disabled={busy || !ready}>
          {busy ? "Bezig…" : editing ? "Opslaan" : "Plaatsen"}
        </button>
        <button type="button" className={quiet} onClick={onCancel}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { ActionResult, Target, ThreadItem, ThreadStatus } from "./actions";

/**
 * The thread below an item (design/annotaties.md, step 1): the annotations
 * on it with their replies, a form for whoever the policy allows, edit and
 * remove on your own, hide for moderators, "bewerkt" with earlier versions,
 * and the flag that the item changed after an annotation was made. Fetched
 * in the browser, so the item's page stays prerendered.
 */
export function AnnotationThread({ target, call, loginHref, title = "Reacties" }: { target: Target; call?: PluginCall; loginHref: string; title?: string }) {
  const [status, setStatus] = useState<ThreadStatus | null | undefined>(undefined);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!call) return;
    const [s, l] = await Promise.all([call("annotations", "status", target), call("annotations", "list", target)]);
    setStatus(s as ThreadStatus | null);
    setItems((l as ThreadItem[] | null) ?? []);
  }, [call, target]);

  useEffect(() => {
    refresh().catch(() => setStatus(null));
  }, [refresh]);

  if (!call || status === undefined || status === null || status.setting === "off") return null;

  const run = async (action: string, ...args: unknown[]): Promise<boolean> => {
    setError(null);
    const result = (await call("annotations", action, ...args)) as ActionResult;
    if (!result.ok) setError(result.error ?? "Dat lukte niet.");
    await refresh();
    return result.ok;
  };

  const count = (list: ThreadItem[]): number => list.reduce((n, i) => n + 1 + count(i.replies), 0);

  return (
    <section className="mt-12 max-w-3xl border-t border-line pt-6" aria-label={title}>
      <h2 className="text-xl font-semibold">
        {title} <span className="font-normal text-muted">({count(items)})</span>
      </h2>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {items.length === 0 && <p className="mt-2 text-sm text-muted">Nog geen reacties.</p>}
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <Item key={item.slug} item={item} status={status} run={run} call={call} depth={0} />
        ))}
      </ul>
      {status.canAnnotate ? (
        <Composer label="Reageer" onSubmit={(text) => run("add", target, text)} />
      ) : !status.signedIn ? (
        <p className="mt-6 text-sm text-muted">
          <Link href={loginHref} className="underline">
            Log in
          </Link>{" "}
          om te reageren.
        </p>
      ) : null}
    </section>
  );
}

function Composer({ label, initial = "", onSubmit, onCancel }: { label: string; initial?: string; onSubmit: (text: string) => Promise<boolean>; onCancel?: () => void }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await onSubmit(text)) setText("");
        setBusy(false);
        onCancel?.();
      }}
    >
      <textarea
        className="min-h-20 w-full rounded-md border border-line bg-background px-3 py-2"
        placeholder="Je reactie (Markdown mag)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        maxLength={20000}
      />
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60">
          {busy ? "Bezig…" : label}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-muted underline-offset-2 hover:underline">
            Annuleren
          </button>
        )}
      </div>
    </form>
  );
}

function Item({ item, status, run, call, depth }: { item: ThreadItem; status: ThreadStatus; run: (a: string, ...args: unknown[]) => Promise<boolean>; call: PluginCall; depth: number }) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [versions, setVersions] = useState<{ at: string; text: string }[] | null>(null);
  const own = !!status.name && item.author === status.name;
  const quiet = "text-xs text-muted underline-offset-2 hover:underline";
  const when = new Date(item.created).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });
  return (
    <li className={`rounded-md border border-line p-4 ${item.hidden ? "opacity-60" : ""} ${depth > 0 ? "bg-surface" : "bg-background"}`}>
      <p className="text-xs text-muted">
        <span className="font-semibold text-foreground">{item.author}</span> · {when}
        {item.motivation === "questioning" && " · vraag"}
        {item.edited && (
          <>
            {" · "}
            <button type="button" className={quiet} onClick={async () => setVersions(versions ? null : ((await call("annotations", "history", item.slug)) as { at: string; text: string }[] | null) ?? [])}>
              bewerkt
            </button>
          </>
        )}
        {item.hidden && " · verborgen door een beheerder"}
        {item.changedSince && <span className="ml-2 rounded-full bg-surface px-2 py-0.5">de tekst is sindsdien gewijzigd</span>}
      </p>
      {editing ? (
        <Composer label="Opslaan" initial={item.text} onSubmit={(t) => run("edit", item.slug, t)} onCancel={() => setEditing(false)} />
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{item.text}</div>
      )}
      {versions && versions.length > 1 && (
        <ul className="mt-2 space-y-1 border-l-2 border-line pl-3 text-sm text-muted">
          {versions.slice(1).map((v) => (
            <li key={v.at}>
              <span className="text-xs">{new Date(v.at).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" })}:</span> {v.text}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        {status.canAnnotate && depth < 4 && !replying && (
          <button type="button" className={quiet} onClick={() => setReplying(true)}>
            beantwoorden
          </button>
        )}
        {own && !editing && (
          <button type="button" className={quiet} onClick={() => setEditing(true)}>
            bewerken
          </button>
        )}
        {own && (
          <button type="button" className={quiet} onClick={() => confirm("Deze reactie verwijderen?") && run("remove", item.slug)}>
            verwijderen
          </button>
        )}
        {status.canModerate && !own && (
          <button type="button" className={quiet} onClick={() => run("hide", item.slug, !item.hidden)}>
            {item.hidden ? "weer tonen" : "verbergen"}
          </button>
        )}
      </div>
      {replying && <Composer label="Beantwoord" onSubmit={(t) => run("add", { type: "annotation", slug: item.slug }, t)} onCancel={() => setReplying(false)} />}
      {item.replies.length > 0 && (
        <ul className="mt-3 space-y-3 pl-4">
          {item.replies.map((r) => (
            <Item key={r.slug} item={r} status={status} run={run} call={call} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import { eventHref, formatWhen } from "./href";
import type { ActionResult, EventInput, EventRights, GroupAgenda } from "./member-actions";

/**
 * Members plan events (design/communities.md §4.5, G3a+): the form, the
 * button on a group's page, and the maker's tools on the event's own page.
 * All asked in the browser, so the pages stay prerendered; who may do what
 * is the server's answer (the PDP), never decided here.
 */

const EMPTY: EventInput = { title: "", start: "", end: "", location: "", online: false, rsvp: true, body: "", membersOnly: false };
const field = "w-full rounded-md border border-line bg-background px-3 py-2";
const button = "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-60";
const quiet = "text-sm text-muted underline-offset-2 hover:underline";

function EventForm({ call, group, editing, closed, onDone, onCancel }: { call: PluginCall; group: string; editing?: string; closed?: boolean; onDone: (slug?: string) => void; onCancel: () => void }) {
  const [input, setInput] = useState<EventInput>({ ...EMPTY, membersOnly: !!closed });
  const [ready, setReady] = useState(!editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setInput((i) => ({ ...i, [key]: value }));

  useEffect(() => {
    if (!editing) return;
    let live = true;
    (call("events", "eventInput", editing) as Promise<EventInput | null>).then((current) => {
      if (!live) return;
      if (!current) return setError("Dit evenement is niet te laden.");
      setInput(current);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [call, editing]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = (editing ? await call("events", "editEvent", editing, input) : await call("events", "writeEvent", group, input)) as ActionResult;
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    onDone(result.slug);
  };

  return (
    <form
      className="mt-4 space-y-3 rounded-md border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input className={field} placeholder="Titel" value={input.title} onChange={(e) => set("title", e.target.value)} required minLength={2} maxLength={160} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label>
          Begin
          <input type="datetime-local" className={`${field} mt-1`} value={input.start} onChange={(e) => set("start", e.target.value)} required />
        </label>
        <label>
          Einde <span className="text-muted">(mag leeg)</span>
          <input type="datetime-local" className={`${field} mt-1`} value={input.end} min={input.start || undefined} onChange={(e) => set("end", e.target.value)} />
        </label>
      </div>
      <input className={field} placeholder="Plaats (bv. Utrecht, of Teams)" value={input.location} onChange={(e) => set("location", e.target.value)} maxLength={200} />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label>
          <input type="checkbox" checked={input.online} onChange={(e) => set("online", e.target.checked)} /> online bij te wonen
        </label>
        <label>
          <input type="checkbox" checked={input.rsvp} onChange={(e) => set("rsvp", e.target.checked)} /> aanmelden mogelijk
        </label>
        <label>
          Zichtbaar voor{" "}
          <select value={input.membersOnly ? "group" : "public"} onChange={(e) => set("membersOnly", e.target.value === "group")} className="ml-1 rounded-md border border-line bg-background px-2 py-1">
            <option value="public">iedereen</option>
            <option value="group">leden van deze community</option>
          </select>
        </label>
      </div>
      <textarea className={`${field} min-h-28`} placeholder="Waar gaat het over? (Markdown mag)" value={input.body} onChange={(e) => set("body", e.target.value)} maxLength={20000} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className={button} disabled={busy || !ready}>
          {busy ? "Bezig…" : editing ? "Opslaan" : "Plannen"}
        </button>
        <button type="button" className={quiet} onClick={onCancel}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

/** On a group's page, in its agenda: "Evenement plannen" for members, and the events only members see. */
export function GroupAgendaTools({ group, call }: { group: string; call?: PluginCall }) {
  const router = useRouter();
  const [agenda, setAgenda] = useState<GroupAgenda | null>(null);
  const [writing, setWriting] = useState(false);

  const refresh = useCallback(async () => {
    if (call) setAgenda((await call("events", "agenda", group)) as GroupAgenda | null);
  }, [call, group]);
  useEffect(() => {
    refresh().catch(() => setAgenda(null));
    const onChange = () => refresh().catch(() => setAgenda(null));
    window.addEventListener("imprint:membership", onChange);
    return () => window.removeEventListener("imprint:membership", onChange);
  }, [refresh]);

  if (!call || !agenda) return null;
  return (
    <div>
      {agenda.membersOnly.length > 0 && (
        <ul className="divide-y divide-line">
          {agenda.membersOnly.map((e) => (
            <li key={e.slug} className="py-2">
              <Link href={eventHref(e.slug)} className="font-semibold text-accent hover:underline">
                {e.title}
              </Link>
              <span className="ml-2 text-sm text-muted">
                {formatWhen(e.start)}
                {e.location && ` · ${e.location}`} · alleen voor leden
              </span>
            </li>
          ))}
        </ul>
      )}
      {agenda.mayCreate && !writing && (
        <button type="button" className={`${quiet} mt-2`} onClick={() => setWriting(true)}>
          + Evenement plannen
        </button>
      )}
      {writing && (
        <EventForm
          call={call}
          group={group}
          closed={agenda.closed}
          onCancel={() => setWriting(false)}
          onDone={async () => {
            setWriting(false);
            await refresh();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** On an event's own page: "bewerken" and "verwijderen" for its maker (removing also for the group's managers). */
export function EventTools({ slug, call }: { slug: string; call?: PluginCall }) {
  const router = useRouter();
  const [rights, setRights] = useState<EventRights | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!call) return;
    let live = true;
    (call("events", "rights", slug) as Promise<EventRights | null>).then((r) => live && setRights(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [call, slug]);

  if (!call || !rights || (!rights.canEdit && !rights.canRemove)) return null;

  const remove = async () => {
    if (!confirm("Dit evenement verwijderen?")) return;
    const result = (await call("events", "removeEvent", slug)) as ActionResult;
    if (!result.ok) return setError(result.error ?? "Dat lukte niet.");
    router.push(`/groups/${rights.group}`);
    router.refresh();
  };

  return (
    <div className="mb-6 max-w-3xl">
      {!editing && (
        <p className="flex flex-wrap gap-4 rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
          <span>{rights.own ? "Dit is jouw evenement." : "Je beheert dit evenement."}</span>
          {rights.canEdit && (
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
              bewerken
            </button>
          )}
          {rights.canRemove && (
            <button type="button" className="underline-offset-2 hover:underline" onClick={remove}>
              verwijderen
            </button>
          )}
        </p>
      )}
      {editing && (
        <EventForm
          call={call}
          group={rights.group}
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

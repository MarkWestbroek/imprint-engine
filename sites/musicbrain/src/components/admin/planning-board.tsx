"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Planning, PlanningItem } from "@imprint/content-core";
import { groupIntoColumns, computeMove } from "@/lib/planning";
import {
  deleteCardAction,
  moveCardAction,
  saveCardAction,
  type CardInput,
} from "@/app/admin/planning/actions";

type ComponentRef = { slug: string; name: string };

/**
 * The interactive planning board (admin only). Cards are draggable between
 * phase columns; clicking one opens an edit panel. Every move/edit is a
 * bitemporal put on the underlying planning-item, so the board's history is
 * the history of the work.
 */

type Draft = CardInput & { lang?: string };

const input =
  "w-full rounded-md border border-line bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none";
const label = "block text-xs font-medium uppercase tracking-wide text-muted";

export function PlanningBoard({
  planning,
  items: initialItems,
  users,
  components,
  currentUser,
}: {
  planning: Planning;
  items: PlanningItem[];
  users: string[];
  components: ComponentRef[];
  currentUser: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const columns = groupIntoColumns(planning, items);

  function drop(toPhase: string, toIndex: number) {
    const moved = dragging;
    setDragging(null);
    setOverCol(null);
    if (!moved) return;
    // Optimistic local update, then persist authoritatively on the server.
    const patches = computeMove(planning, items, moved, toPhase, toIndex);
    if (patches.length === 0) return;
    const byPatch = new Map(patches.map((p) => [p.slug, p]));
    setItems((prev) =>
      prev.map((it) => {
        const p = byPatch.get(it.slug);
        return p ? { ...it, status: p.status, order: p.order } : it;
      })
    );
    startTransition(async () => {
      await moveCardAction(planning.slug, moved, toPhase, toIndex);
      router.refresh();
    });
  }

  function openNew(phase: string) {
    setDraft({
      planning: planning.slug,
      title: "",
      status: phase,
      owner: currentUser,
      body: "",
      component: "",
      componentVersion: "",
    });
  }

  function openEdit(item: PlanningItem) {
    setDraft({
      slug: item.slug,
      planning: planning.slug,
      title: item.title,
      status: item.status,
      owner: item.owner,
      body: item.body,
      component: item.component ?? "",
      componentVersion: item.componentVersion ?? "",
      lang: item.lang,
    });
  }

  function save() {
    if (!draft) return;
    const wasNew = !draft.slug;
    startTransition(async () => {
      const res = await saveCardAction({
        ...draft,
        component: draft.component || undefined,
        componentVersion: draft.componentVersion || undefined,
      });
      if (!res.ok || !res.item) {
        alert(res.error ?? "Save failed");
        return;
      }
      const saved = res.item;
      // Optimistic: reflect the save immediately (router.refresh alone won't
      // re-seed this component's useState from the new server props).
      setItems((prev) =>
        wasNew ? [...prev, saved] : prev.map((it) => (it.slug === saved.slug ? saved : it))
      );
      setDraft(null);
      router.refresh();
    });
  }

  function remove() {
    if (!draft?.slug) return;
    if (!confirm("Delete this card? (History is kept — restorable via admin.)")) return;
    const slug = draft.slug;
    startTransition(async () => {
      await deleteCardAction(planning.slug, slug, draft.lang ?? "en");
      setItems((prev) => prev.filter((it) => it.slug !== slug));
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-4">
      <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              drop(col.key, col.cards.length);
            }}
            className={`w-64 shrink-0 rounded-lg border p-2 transition-colors ${
              overCol === col.key ? "border-accent bg-accent/5" : "border-line bg-surface/60"
            }`}
          >
            <h3 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold">
              {col.label}
              <span className="text-xs font-normal text-muted">{col.cards.length}</span>
            </h3>
            <div className="space-y-2">
              {col.cards.map((card, i) => (
                <button
                  key={card.slug}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    setDragging(card.slug);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", card.slug);
                  }}
                  onDragEnd={() => setDragging(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(col.key, i);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => openEdit(card)}
                  className={`w-full cursor-grab rounded-md border border-line bg-background p-2 text-left text-sm hover:border-accent ${
                    dragging === card.slug ? "opacity-40" : ""
                  }`}
                >
                  <div className="font-medium leading-snug">{card.title || "(untitled)"}</div>
                  {card.body && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted">{card.body}</div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {card.component && (
                      <span className="rounded-full border border-line px-1.5 py-0.5 text-accent">
                        {card.component}
                        {card.componentVersion ? ` ${card.componentVersion}` : ""}
                      </span>
                    )}
                    {card.owner && <span className="ml-auto">@{card.owner}</span>}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => openNew(col.key)}
                className="w-full rounded-md border border-dashed border-line py-1 text-xs text-muted hover:border-accent hover:text-accent"
              >
                ＋ card
              </button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <aside className="w-72 shrink-0 space-y-3 rounded-lg border border-line bg-surface p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{draft.slug ? "Edit card" : "New card"}</h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <label className="block">
            <span className={label}>title</span>
            <input
              className={`mt-1 ${input}`}
              value={draft.title}
              autoFocus
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>phase</span>
              <select
                className={`mt-1 ${input}`}
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                {planning.phases.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>owner</span>
              <select
                className={`mt-1 ${input}`}
                value={draft.owner}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <label className="block">
              <span className={label}>component</span>
              <select
                className={`mt-1 ${input}`}
                value={draft.component ?? ""}
                onChange={(e) => {
                  const slug = e.target.value;
                  const comp = components.find((c) => c.slug === slug);
                  // Prefill an empty body with a link to the picked component —
                  // never overwrite text the editor already typed.
                  const body =
                    draft.body.trim() === "" && comp
                      ? `Werken aan [${comp.name}](/components/${comp.slug}).`
                      : draft.body;
                  setDraft({ ...draft, component: slug, body });
                }}
              >
                <option value="">—</option>
                {components.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>version</span>
              <input
                className={`mt-1 ${input}`}
                placeholder="v2.1"
                value={draft.componentVersion ?? ""}
                onChange={(e) => setDraft({ ...draft, componentVersion: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className={label}>body (markdown)</span>
            <textarea
              className={`mt-1 ${input} font-mono`}
              rows={5}
              placeholder="Rich text; link content like [ADC8](/components/adc8)"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending || !draft.title.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
            >
              Save
            </button>
            {draft.slug && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-red-400 hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

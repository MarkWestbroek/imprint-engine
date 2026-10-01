"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { Target, ThreadItem, ThreadStatus } from "./actions";
import { anchor, describe } from "./anchor";
import { indexText, paint, pointAt, rangeFor, selectionIn, unpaint, type TextIndex } from "./dom-text";
import { Composer, Item, type Run } from "./thread";

/**
 * Annotations in the margin (design/annotaties.md, step 2). The item's
 * viewer marks its body with `data-annotation-field`; this component indexes
 * that text, anchors every segment annotation in it (anchor.ts), paints the
 * passages with the CSS Custom Highlight API (no DOM surgery in React's
 * tree) and puts a balloon beside each passage — or, when there is no room
 * at the side, lists them under the thread with their quote. Selecting text
 * in the body offers "Annoteren". What cannot be found in the current
 * version is an orphan: shown under "Bij een eerdere versie" with its quote,
 * never guessed at.
 */

type Anchored = { item: ThreadItem; range: Range; top: number };
const WIDE = "(min-width: 1100px)";
const BALLOON = 300;

export function Margin({ target, items, status, run, call }: { target: Target; items: ThreadItem[]; status: ThreadStatus; run: Run; call: PluginCall }) {
  const host = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState<TextIndex | null>(null);
  const [article, setArticle] = useState<HTMLElement | null>(null);
  const [wide, setWide] = useState(false);
  const [anchored, setAnchored] = useState<Anchored[]>([]);
  const [orphans, setOrphans] = useState<ThreadItem[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [pending, setPending] = useState<{ start: number; end: number; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{ start: number; end: number; top: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [tops, setTops] = useState<Record<string, number>>({});
  const balloons = useRef<Record<string, HTMLDivElement | null>>({});

  // The body to annotate and the article that positions the margin.
  useEffect(() => {
    const art = host.current?.closest("article") as HTMLElement | null;
    const field = art?.querySelector("[data-annotation-field]");
    if (!art || !field) return;
    art.style.position = "relative";
    setArticle(art);
    setIndex(indexText(field));
    const mq = window.matchMedia(WIDE);
    const onMq = () => setWide(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(art);
    return () => {
      mq.removeEventListener("change", onMq);
      ro.disconnect();
      unpaint("imprint-annotation");
      unpaint("imprint-annotation-active");
      unpaint("imprint-annotation-draft");
    };
  }, []);

  // Anchor every segment annotation in the current text; paint the passages.
  useEffect(() => {
    if (!index || !article) return;
    const base = article.getBoundingClientRect().top;
    const found: Anchored[] = [];
    const lost: ThreadItem[] = [];
    for (const item of items) {
      const hit = anchor(index.text, item.selector);
      const range = hit && rangeFor(index, hit.start, hit.end);
      if (range) found.push({ item, range, top: range.getBoundingClientRect().top - base });
      else lost.push(item);
    }
    found.sort((a, b) => a.top - b.top);
    setAnchored(found);
    setOrphans(lost);
    paint("imprint-annotation", found.map((a) => a.range));
  }, [index, article, items, tick]);

  useEffect(() => {
    const active = anchored.find((a) => a.item.slug === focus);
    paint("imprint-annotation-active", active ? [active.range] : []);
  }, [anchored, focus]);

  useEffect(() => {
    if (!index || !draft) return unpaint("imprint-annotation-draft");
    const range = rangeFor(index, draft.start, draft.end);
    paint("imprint-annotation-draft", range ? [range] : []);
  }, [index, draft]);

  // Stack the balloons: each at its passage, pushed down when the one above is in the way.
  useLayoutEffect(() => {
    if (!wide) return;
    const next: Record<string, number> = {};
    let floor = 0;
    const entries: { key: string; top: number }[] = anchored.map((a) => ({ key: a.item.slug, top: a.top }));
    if (draft) entries.push({ key: "draft", top: draft.top });
    entries.sort((a, b) => a.top - b.top);
    for (const e of entries) {
      const top = Math.max(e.top, floor);
      next[e.key] = top;
      floor = top + (balloons.current[e.key]?.offsetHeight ?? 80) + 8;
    }
    setTops((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
  }, [anchored, draft, wide, items]);

  // A selection in the body offers "Annoteren"; a click on a passage focuses its balloon.
  useEffect(() => {
    if (!index || !article || !status.canAnnotate) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSelect = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = selectionIn(index);
        if (!sel) return setPending(null);
        const r = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
        const a = article.getBoundingClientRect();
        setPending({ ...sel, x: r.right - a.left, y: r.bottom - a.top });
      }, 150);
    };
    document.addEventListener("selectionchange", onSelect);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelect);
    };
  }, [index, article, status.canAnnotate]);

  useEffect(() => {
    if (!index) return;
    const onClick = (e: MouseEvent) => {
      const p = pointAt(e.clientX, e.clientY);
      if (!p) return;
      const hit = anchored.find((a) => a.range.isPointInRange(p.node, p.offset));
      if (!hit) return;
      setFocus(hit.item.slug);
      if (!wide) balloons.current[hit.item.slug]?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    const root = index.root as HTMLElement;
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [index, anchored, wide]);

  const startDraft = useCallback(() => {
    if (!pending || !index || !article) return;
    const range = rangeFor(index, pending.start, pending.end);
    const top = range ? range.getBoundingClientRect().top - article.getBoundingClientRect().top : pending.y;
    setDraft({ start: pending.start, end: pending.end, top });
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }, [pending, index, article]);

  const submitDraft = async (text: string) => {
    if (!draft || !index) return false;
    const field = (index.root as HTMLElement).dataset.annotationField || "body";
    const ok = await run("add", target, text, { field, selector: describe(index.text, draft.start, draft.end) });
    if (ok) setDraft(null);
    return ok;
  };

  // The host must be in the DOM before the body can be found through it.
  if (!index || !article) return <div ref={host} className="contents" />;
  const fieldRect = index.root.getBoundingClientRect();
  const artRect = article.getBoundingClientRect();
  const left = fieldRect.right - artRect.left + 24;
  const room = wide && artRect.width - left >= 220;
  const width = Math.min(BALLOON, artRect.width - left);

  const balloon = (key: string, top: number | undefined, children: React.ReactNode, extra = "") => (
    <div
      key={key}
      ref={(el) => {
        balloons.current[key] = el;
      }}
      className={`rounded-md border border-line bg-background p-3 text-sm shadow-sm transition-[top] ${extra}`}
      style={room ? { position: "absolute", left, width, top: tops[key] ?? top ?? 0 } : undefined}
      onClick={() => key !== "draft" && setFocus(key)}
    >
      {children}
    </div>
  );

  const quote = (text: string) => (
    <p className="mb-1 truncate border-l-2 border-accent pl-2 text-xs italic text-muted" title={text}>
      {text}
    </p>
  );

  const list = (entries: Anchored[]) =>
    entries.map((a) =>
      balloon(
        a.item.slug,
        a.top,
        <>
          {quote(a.item.quote)}
          <ul className="space-y-2">
            <Item item={a.item} status={status} run={run} call={call} depth={0} compact />
          </ul>
        </>,
        focus === a.item.slug ? "ring-2 ring-accent" : ""
      )
    );

  return (
    <div ref={host} className="contents">
      {pending && status.canAnnotate && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startDraft}
          className="absolute z-10 rounded-md bg-accent px-3 py-1 text-xs font-semibold text-background shadow hover:bg-accent-strong"
          style={{ left: Math.max(0, pending.x - 80), top: pending.y + 6 }}
        >
          Annoteren
        </button>
      )}
      {draft &&
        balloon(
          "draft",
          draft.top,
          <>
            {quote(index.text.slice(draft.start, draft.end))}
            <Composer label="Plaats" autoFocus onSubmit={submitDraft} onCancel={() => setDraft(null)} />
          </>,
          "ring-2 ring-accent"
        )}
      {room ? (
        <div aria-label="Kanttekeningen">{list(anchored)}</div>
      ) : anchored.length > 0 ? (
        <div className="mt-4" aria-label="Kanttekeningen">
          <h3 className="text-sm font-semibold text-muted">Kanttekeningen bij de tekst</h3>
          <div className="mt-2 space-y-3">{list(anchored)}</div>
        </div>
      ) : null}
      {orphans.length > 0 && (
        <div className="mt-4" aria-label="Bij een eerdere versie">
          <h3 className="text-sm font-semibold text-muted">Bij een eerdere versie van de tekst</h3>
          <p className="text-xs text-muted">Deze passages staan niet meer zo in de tekst.</p>
          <div className="mt-2 space-y-3">
            {orphans.map((item) =>
              balloon(
                item.slug,
                undefined,
                <>
                  {quote(item.quote)}
                  <ul className="space-y-2">
                    <Item item={item} status={status} run={run} call={call} depth={0} compact />
                  </ul>
                </>,
                "opacity-80"
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

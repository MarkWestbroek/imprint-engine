"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export type PlayerSlide = { id: string; html: string };

/**
 * The slides on their 1920×1080 canvas, scaled to the width they get, one at
 * a time: previous/next, ← → (and space) when focused, the slide in the URL
 * hash (#<id>), and fullscreen for presenting. Every slide is in the HTML from
 * the server (the others hidden), so the deck reads without JavaScript too.
 */
const BASE_CSS = `
.deck-slide > section { position: relative; width: 1920px; height: 1080px; overflow: hidden; box-sizing: border-box; }
.deck-slide * { box-sizing: border-box; margin: 0; }
.deck-slide ul { list-style: disc; padding-left: 1.2em; }
.deck-slide ol { list-style: decimal; padding-left: 1.2em; }
.deck-slide li + li { margin-top: 0.3em; }
.deck-slide table { border-collapse: collapse; width: 100%; }
.deck-slide th, .deck-slide td { padding: 0.5em 0.75em; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.deck-slide th { font-weight: 600; }
.deck-slide hr { border: 0; }
.deck-slide img { display: block; }
.deck-slide a { color: inherit; text-decoration: underline; }
`;

export function DeckPlayer({ title, slides, fonts }: { title: string; slides: PlayerSlide[]; fonts: string[] }) {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(0);
  const [full, setFull] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);

  // Scale the 1920px canvas to the frame's width (and, in fullscreen, its height).
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / 1920, full ? el.clientHeight / 1080 : Infinity));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);

  // The slide in the hash: a link to #studio opens there; going on updates it.
  useEffect(() => {
    const fromHash = () => {
      const i = slides.findIndex((s) => `#${s.id}` === window.location.hash);
      if (i >= 0) setIndex(i);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [slides]);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(slides.length - 1, i));
      setIndex(next);
      window.history.replaceState(null, "", `#${slides[next]!.id}`);
    },
    [slides]
  );

  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === root.current;
      setFull(on);
      if (on) root.current?.focus();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") go(index + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(index - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slides.length - 1);
    else return;
    e.preventDefault();
  };

  const btn = "rounded-full border border-line bg-background px-3 py-1 text-sm hover:border-accent disabled:opacity-40";
  return (
    <figure
      ref={root}
      className={`deck-player m-0 overflow-hidden rounded-xl border border-line bg-surface${full ? " is-full flex h-screen w-screen flex-col rounded-none border-0" : ""}`}
      tabIndex={0}
      onKeyDown={onKey}
      aria-roledescription="presentatie"
      aria-label={title}
    >
      {fonts.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="default" />
      ))}
      <style>{BASE_CSS}</style>
      <div ref={frame} className={full ? "relative min-h-0 flex-1" : "relative"} style={full ? undefined : { aspectRatio: "16 / 9" }}>
        {slides.map((s, i) => (
          <div
            key={s.id}
            className="deck-slide absolute left-1/2 top-1/2"
            aria-hidden={i !== index}
            style={{
              width: 1920,
              height: 1080,
              transform: `translate(-50%, -50%) scale(${scale || 0.0001})`,
              visibility: i === index && scale ? "visible" : "hidden",
            }}
            dangerouslySetInnerHTML={{ __html: s.html }}
          />
        ))}
      </div>
      <figcaption className="flex items-center gap-3 border-t border-line px-4 py-2 text-sm">
        <button type="button" className={btn} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Vorige slide">
          ←
        </button>
        <span className="tabular-nums text-muted">
          {index + 1} / {slides.length}
        </span>
        <button type="button" className={btn} onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Volgende slide">
          →
        </button>
        <span className="ml-auto truncate text-muted">{title}</span>
        <button
          type="button"
          className={btn}
          onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void root.current?.requestFullscreen?.())}
          aria-label={full ? "Volledig scherm verlaten" : "Volledig scherm (presenteren)"}
          title="Volledig scherm: ← → of spatie, Esc sluit"
        >
          {full ? "✕" : "⛶"}
        </button>
      </figcaption>
    </figure>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BoardConfig } from "./registry";

/**
 * Client island for the `board` widget (the viewer in components.tsx is a
 * thin server shell). Two modes:
 *  - "hover":    hotspots on the render reveal detail on mouseover/focus.
 *  - "expanded": detail lives in boxes flanking a smaller render, each joined
 *                to its component by a measured leader line (responsive).
 */

type Point = BoardConfig["points"][number];

/** Compact markdown (tight pin→net tables) shown inside a box/tooltip. */
function Detail({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;
  return (
    <div className="markdown text-muted text-[11px] leading-tight [&_img]:my-1 [&_img]:max-w-full [&_table]:border-collapse [&_td]:py-0 [&_td]:pr-2 [&_th]:py-0 [&_th]:pr-2 [&_th]:text-left">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------- hover mode

function Tooltip({
  point,
  side,
  vside,
}: {
  point: Point;
  side: "left" | "right";
  vside: "top" | "bottom";
}) {
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-20 w-64 max-w-[70vw] rounded-lg border border-line bg-surface p-3 text-left text-sm shadow-lg ${
        side === "right" ? "left-0" : "right-0"
      } ${vside === "top" ? "bottom-[130%]" : "top-[130%]"}`}
    >
      {point.label && (
        <div className="mb-1 font-semibold text-foreground">{point.label}</div>
      )}
      <Detail markdown={point.markdown} />
    </div>
  );
}

function HoverBoard({ image, alt, points }: Omit<BoardConfig, "mode" | "title">) {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();
  return (
    <figure className="relative inline-block max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- public/external render */}
      <img src={image} alt={alt} className="block h-auto max-w-full rounded-lg" />
      {points.map((p, i) => {
        const side = p.x < 0.5 ? "right" : "left";
        const vside = p.y < 0.5 ? "bottom" : "top";
        return (
          <button
            key={`${baseId}-${i}`}
            type="button"
            aria-label={p.label ?? `Detail ${i + 1}`}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            onMouseEnter={() => setOpen(i)}
            onMouseLeave={() => setOpen((cur) => (cur === i ? null : cur))}
            onFocus={() => setOpen(i)}
            onBlur={() => setOpen((cur) => (cur === i ? null : cur))}
          >
            <span
              className={`block h-3.5 w-3.5 rounded-full border-2 border-white ring-2 transition ${
                open === i
                  ? "bg-accent ring-accent"
                  : "bg-accent/70 ring-accent/40 group-hover:bg-accent"
              }`}
            />
            {open === i && <Tooltip point={p} side={side} vside={vside} />}
          </button>
        );
      })}
    </figure>
  );
}

// ------------------------------------------------------------- expanded mode

type Line = { x1: number; y1: number; x2: number; y2: number };

function ExpandedBoard({ image, alt, points }: Omit<BoardConfig, "mode" | "title">) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const boxes = useRef<Array<HTMLDivElement | null>>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0); // bump to recompute after image load

  // Keep the original index so left/right columns and leader lines line up.
  const indexed = points.map((p, i) => ({ p, i }));
  const left = indexed.filter(({ p }) => p.x < 0.5).sort((a, b) => a.p.y - b.p.y);
  const right = indexed.filter(({ p }) => p.x >= 0.5).sort((a, b) => a.p.y - b.p.y);

  useEffect(() => {
    const compute = () => {
      const w = wrap.current;
      const im = img.current;
      if (!w || !im) return;
      const wb = w.getBoundingClientRect();
      const ib = im.getBoundingClientRect();
      setSize({ w: wb.width, h: wb.height });
      const next: Line[] = [];
      points.forEach((p, i) => {
        const box = boxes.current[i];
        if (!box) return;
        const bb = box.getBoundingClientRect();
        const onLeft = p.x < 0.5;
        next[i] = {
          x1: (onLeft ? bb.right : bb.left) - wb.left,
          y1: bb.top + bb.height / 2 - wb.top,
          x2: ib.left + p.x * ib.width - wb.left,
          y2: ib.top + p.y * ib.height - wb.top,
        };
      });
      setLines(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrap.current) ro.observe(wrap.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [points, tick]);

  const column = (items: typeof indexed, side: "left" | "right") => (
    <div className="flex w-52 shrink-0 flex-col justify-center gap-2">
      {items.map(({ p, i }) => (
        <div
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          className={`rounded-md border border-line bg-surface/60 p-2 ${
            side === "left" ? "text-right" : "text-left"
          }`}
        >
          {p.label && (
            <div className="text-xs font-semibold text-foreground">{p.label}</div>
          )}
          <div className={side === "left" ? "flex justify-end" : ""}>
            <Detail markdown={p.markdown} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div ref={wrap} className="relative flex items-stretch justify-center gap-3">
      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        preserveAspectRatio="none"
      >
        {lines.filter(Boolean).map((l, i) => (
          <g key={i} stroke="var(--color-accent, #e8a33d)" fill="var(--color-accent, #e8a33d)">
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={1.2} />
            <circle cx={l.x2} cy={l.y2} r={3} />
          </g>
        ))}
      </svg>

      {left.length > 0 && column(left, "left")}
      <div className="flex max-w-[60%] items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- public/external render */}
        <img
          ref={img}
          src={image}
          alt={alt}
          className="block h-auto max-w-full rounded-lg"
          onLoad={() => setTick((t) => t + 1)}
        />
      </div>
      {right.length > 0 && column(right, "right")}
    </div>
  );
}

// ------------------------------------------------------------------ dispatch

export function BoardCanvas({ image, alt, points, mode }: Omit<BoardConfig, "title">) {
  return mode === "expanded" ? (
    <ExpandedBoard image={image} alt={alt} points={points} />
  ) : (
    <HoverBoard image={image} alt={alt} points={points} />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The patchbay: one source module with an output jack per activity, and a
 * patch cable from each jack to the module it leads to. The cables are drawn
 * from the measured jack positions, so the rack can reflow; they sway a
 * little, and the one you point at swings harder and lights up.
 *
 * Wide: cables hang between source and module. Narrow: the cable would cross
 * the text, so each end only gets a short stub in the cable's colour.
 */

export type PatchModule = {
  titel: string;
  tekst?: string;
  url?: string;
  adres?: string;
  jack: string;
  kleur: "oranje" | "blauw" | "geel" | "roze";
};

export type PatchbayProps = {
  kop?: string;
  intro?: string;
  naam: string;
  regel?: string;
  modules: PatchModule[];
};

type Point = { x: number; y: number };
type Cable = { from: Point; to: Point };

/** Below this rack width the cables become stubs (matches the CSS breakpoint). */
const WIDE = 900;
/** Module columns beside the source when wide. */
const COLUMNS = 4;

function cablePath(c: Cable, i: number, wide: boolean, dx: number, dy: number): string {
  const { from: s, to: t } = c;
  if (!wide) {
    return `M${s.x} ${s.y} q${6 + dx} 14 0 26 M${t.x} ${t.y} q${-6 + dx} 12 0 22`;
  }
  if (t.y < s.y - 80) {
    // A module in a row above: up inside the source, then along the gap under that row.
    return `M${s.x} ${s.y} C${s.x + dx} ${t.y - 40 + dy} ${s.x + (t.x - s.x) * 0.35 + dx} ${t.y + 75 + dy} ${t.x} ${t.y}`;
  }
  // Same height or lower: hang under the rack.
  const low = Math.max(s.y, t.y) + 96 + (i % COLUMNS) * 9;
  return `M${s.x} ${s.y} C${s.x + dx} ${low + dy} ${t.x + dx} ${low + dy} ${t.x} ${t.y}`;
}

export function Patchbay({ kop, intro, naam, regel, modules }: PatchbayProps) {
  const rack = useRef<HTMLDivElement>(null);
  const outs = useRef<(HTMLElement | null)[]>([]);
  const ins = useRef<(HTMLElement | null)[]>([]);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const shadows = useRef<(SVGPathElement | null)[]>([]);
  const plugs = useRef<(SVGCircleElement | null)[]>([]);
  const energy = useRef<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);

  useEffect(() => {
    const el = rack.current;
    if (!el) return;
    let cables: Cable[] = [];
    let wide = true;
    let frame = 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const centre = (node: HTMLElement | null, box: DOMRect): Point => {
      if (!node) return { x: 0, y: 0 };
      const r = node.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    };

    const draw = (time: number) => {
      cables.forEach((c, i) => {
        const e = energy.current[i] ?? 0;
        const amp = still ? 0 : 3 + e * 16;
        const dx = Math.sin(time / 900 + i * 1.7) * amp;
        const dy = Math.cos(time / 1300 + i * 2.3) * amp * 0.6;
        const d = cablePath(c, i, wide, dx, dy);
        paths.current[i]?.setAttribute("d", d);
        shadows.current[i]?.setAttribute("d", d);
        // The pointed-at cable keeps swinging; the rest settle.
        energy.current[i] = activeRef.current === i ? 1 : e * 0.97;
      });
    };

    const measure = () => {
      const box = el.getBoundingClientRect();
      wide = box.width >= WIDE;
      cables = modules.map((_, i) => ({ from: centre(outs.current[i], box), to: centre(ins.current[i], box) }));
      cables.forEach((c, i) => {
        plugs.current[i * 2]?.setAttribute("cx", String(c.from.x));
        plugs.current[i * 2]?.setAttribute("cy", String(c.from.y));
        plugs.current[i * 2 + 1]?.setAttribute("cx", String(c.to.x));
        plugs.current[i * 2 + 1]?.setAttribute("cy", String(c.to.y));
      });
      draw(performance.now());
    };

    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Web fonts move the jacks once they arrive.
    void document.fonts?.ready.then(measure);
    if (!still) frame = requestAnimationFrame(loop);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [modules]);

  const rows = Math.max(1, Math.ceil(modules.length / COLUMNS));
  // The name as in the logo: the first word large, the rest small underneath.
  const [first, ...rest] = naam.trim().split(/\s+/);
  /** Pointing at a module or its output jack: for the styling (state) and for the animation loop (ref). */
  const pointAt = (i: number | null) => {
    activeRef.current = i;
    setActive(i);
  };
  const point = (i: number) => ({
    onMouseEnter: () => pointAt(i),
    onMouseLeave: () => pointAt(null),
    onFocus: () => pointAt(i),
    onBlur: () => pointAt(null),
  });

  return (
    <section className="pb">
      {kop ? <h1 className="pb-kop">{kop}</h1> : null}
      {intro ? <p className="pb-intro">{intro}</p> : null}
      <div className="pb-frame">
        <div ref={rack} className={`pb-rack${active !== null ? " has-active" : ""}`}>
          <div className="pb-source" style={{ gridRow: `1 / span ${rows}` }}>
            <span className="pb-tag">MW-1 · bron</span>
            <span className="pb-name" aria-label={naam}>
              <span aria-hidden="true">{first}</span>
              {rest.length ? <span aria-hidden="true">{rest.join(" ")}</span> : null}
            </span>
            {regel ? <span className="pb-tag">{regel}</span> : null}
            <span className="pb-led pb-led-on" aria-hidden="true" />
            <div className="pb-outs" aria-hidden="true">
              {modules.map((m, i) => (
                <span key={i} className={`pb-out pb-${m.kleur}${active === i ? " is-active" : ""}`} {...point(i)}>
                  <i
                    className="pb-jack"
                    ref={(n) => {
                      outs.current[i] = n;
                    }}
                  />
                  {m.jack}
                </span>
              ))}
            </div>
          </div>

          {modules.map((m, i) => {
            const className = `pb-mod pb-${m.kleur}${active === i ? " is-active" : ""}`;
            const inner = (
              <>
                <span className="pb-led" aria-hidden="true" />
                <span className="pb-title">{m.titel}</span>
                {m.tekst ? <span className="pb-text">{m.tekst}</span> : null}
                {m.adres ? <span className="pb-adres">{m.adres}</span> : null}
                <i
                  className="pb-jack"
                  aria-hidden="true"
                  ref={(n) => {
                    ins.current[i] = n;
                  }}
                />
              </>
            );
            // A module that leads to another site opens in a new tab: the rack stays where it is.
            const extern = m.url ? /^https?:\/\//.test(m.url) : false;
            return m.url ? (
              <a key={i} className={className} href={m.url} {...(extern ? { target: "_blank", rel: "noopener" } : {})} {...point(i)}>
                {inner}
                {extern ? <span className="sr-only"> (opent in een nieuw tabblad)</span> : null}
              </a>
            ) : (
              <div key={i} className={className} {...point(i)}>
                {inner}
              </div>
            );
          })}

          <svg className="pb-cables" aria-hidden="true">
            {modules.map((m, i) => (
              <g key={i} className={`pb-cable pb-${m.kleur}${active === i ? " is-active" : ""}`} style={{ animationDelay: `${200 + i * 110}ms` }}>
                <path
                  className="pb-cable-shadow"
                  pathLength={1}
                  ref={(n) => {
                    shadows.current[i] = n;
                  }}
                />
                <path
                  className="pb-cable-line"
                  pathLength={1}
                  ref={(n) => {
                    paths.current[i] = n;
                  }}
                />
                <circle
                  className="pb-plug"
                  r={8}
                  ref={(n) => {
                    plugs.current[i * 2] = n;
                  }}
                />
                <circle
                  className="pb-plug"
                  r={8}
                  ref={(n) => {
                    plugs.current[i * 2 + 1] = n;
                  }}
                />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

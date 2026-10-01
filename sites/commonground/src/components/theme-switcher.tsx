"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";

const subscribeNoop = () => () => {};

export type ThemeChoice = {
  name: string;
  label: string;
  /** The tile's swatch: page, accent and second accent. */
  colors: { background: string; accent: string; accent2: string };
};

/**
 * The theme picker in the header: a palette button that opens a small panel
 * of tiles (no native dropdown, no room taken in the menu bar). Sets
 * `data-theme` on <html> and remembers the choice. Renders only after
 * hydration (the mounted idiom), so the prerendered HTML never disagrees
 * with the applied choice.
 */
export function ThemeSwitcher({ themes }: { themes: ThemeChoice[] }) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  if (!mounted || themes.length < 2) return null;

  const apply = (name: string) => {
    document.documentElement.setAttribute("data-theme", name);
    setCurrent(name);
    try {
      localStorage.setItem("imprint-theme", name);
    } catch {
      /* private mode etc.: switching still works for this page */
    }
    setOpen(false);
  };

  return (
    <div className="cg-theme" ref={panel}>
      <button
        type="button"
        className="cg-icon-button"
        aria-label="Thema kiezen"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Thema"
        onClick={() => {
          // Read the applied theme when the panel opens (ThemeInit set it before hydration).
          setCurrent(document.documentElement.getAttribute("data-theme") ?? themes[0]?.name ?? null);
          setOpen((v) => !v);
        }}
      >
        <Palette size={22} aria-hidden />
      </button>
      {open && (
        <div className="cg-theme-pop" role="dialog" aria-label="Thema">
          <p className="cg-theme-title">Thema</p>
          <div className="cg-theme-tiles">
            {themes.map((t) => (
              <button
                key={t.name}
                type="button"
                className={`cg-theme-tile${current === t.name ? " is-current" : ""}`}
                onClick={() => apply(t.name)}
                aria-pressed={current === t.name}
              >
                <span className="cg-swatch" style={{ background: t.colors.background }} aria-hidden>
                  <span style={{ background: t.colors.accent }} />
                  <span style={{ background: t.colors.accent2 }} />
                </span>
                <span className="cg-theme-label">
                  {t.label}
                  {current === t.name && <Check size={14} aria-hidden />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

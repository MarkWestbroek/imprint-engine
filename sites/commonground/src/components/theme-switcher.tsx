"use client";

import { useSyncExternalStore } from "react";
import { Palette } from "lucide-react";

const subscribeNoop = () => () => {};

/**
 * The theme picker in the header: sets `data-theme` on <html> and remembers
 * it. Renders only after hydration (the mounted idiom, as on MusicBrain), so
 * the prerendered HTML never disagrees with the applied choice.
 */
export function ThemeSwitcher({ themes }: { themes: { name: string; label: string }[] }) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  if (!mounted || themes.length < 2) return null;

  const current = document.documentElement.getAttribute("data-theme") ?? themes[0]!.name;
  const apply = (name: string) => {
    document.documentElement.setAttribute("data-theme", name);
    try {
      localStorage.setItem("imprint-theme", name);
    } catch {
      /* private mode etc.: switching still works for this page */
    }
  };

  return (
    <label className="cg-theme" title="Thema">
      <Palette size={18} aria-hidden />
      <select aria-label="Thema" defaultValue={current} onChange={(e) => apply(e.target.value)}>
        {themes.map((t) => (
          <option key={t.name} value={t.name}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}

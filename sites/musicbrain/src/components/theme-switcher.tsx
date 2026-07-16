"use client";

import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * User-facing theme switcher (the IDE-style toy Mark wanted): sets
 * `data-theme` on <html> and persists it. Renders only after hydration
 * (useSyncExternalStore mounted-idiom — no effects, no setState) so the
 * SSR output never disagrees with the applied choice.
 */
export function ThemeSwitcher({
  themes,
}: {
  themes: { name: string; label: string }[];
}) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  if (!mounted || themes.length < 2) return null;

  const current =
    document.documentElement.getAttribute("data-theme") ?? themes[0].name;

  const apply = (name: string) => {
    document.documentElement.setAttribute("data-theme", name);
    try {
      localStorage.setItem("imprint-theme", name);
    } catch {
      /* private mode etc. — switching still works for this page */
    }
  };

  return (
    <select
      aria-label="Theme"
      defaultValue={current}
      onChange={(e) => apply(e.target.value)}
      className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-muted hover:text-foreground"
    >
      {themes.map((t) => (
        <option key={t.name} value={t.name}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

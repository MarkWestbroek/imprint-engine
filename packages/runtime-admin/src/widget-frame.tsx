import type { ReactNode } from "react";

/**
 * The common frame of a widget: a surface card with an optional eyebrow
 * title. Shared by standard and domain viewers, so it lives in the engine
 * next to Markdown. Uses the design tokens `line` and `surface` and the
 * `eyebrow` class, which every site's theme provides (architecture.md §3).
 */
export function WidgetFrame({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      {title && <h2 className="eyebrow mb-3">{title}</h2>}
      {children}
    </section>
  );
}

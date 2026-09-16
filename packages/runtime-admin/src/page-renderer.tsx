import type { ReactNode } from "react";
import type { Page, PageLayout, WidgetInstance } from "@imprint/content-core";
import { layoutRows } from "./layout";
import { Markdown } from "./markdown";

/**
 * Renders a composed page (UML: Page ◆ PageLayout ◇ Widget*): rows of
 * cells, widgets stacked inside each cell. Cell widths are fraction units
 * (span 1|2 = one-third + two-thirds); below lg everything stacks.
 *
 * Engine code (architecture.md §0): it knows no concrete widget. A site hands
 * in its viewers — widget type name → component — composed from its own
 * catalogue, and usually binds them once in a thin wrapper.
 */

/** What a widget viewer receives. */
export type WidgetViewProps = {
  /** Already validated against the widget's config schema by the store. */
  config: unknown;
  /** The content item a default-view page is about (for template/list widgets). */
  subject?: unknown;
};

/** A widget viewer; usually an async server component. */
export type WidgetViewer = (props: WidgetViewProps) => ReactNode | Promise<ReactNode>;

/** Widget type name → viewer: the rendering half of a site's widget catalogue. */
export type WidgetViewers = Record<string, WidgetViewer>;

export function Widget({
  widget,
  subject,
  viewers,
}: {
  widget: WidgetInstance;
  subject?: unknown;
  viewers: WidgetViewers;
}) {
  const Component = viewers[widget.type];
  if (!Component) {
    // Store validation should have caught this; fail loudly, not silently.
    throw new Error(`No component for widget type "${widget.type}"`);
  }
  return <Component config={widget.config} subject={subject} />;
}

export function PageRenderer({
  page,
  subject,
  viewers,
}: {
  page: Page & { layout: PageLayout };
  /** The content item this page is about (default views bind widgets to it). */
  subject?: unknown;
  viewers: WidgetViewers;
}) {
  const rows = layoutRows(page.layout);
  return (
    <div>
      {/* Empty title = the layout owns its own header (e.g. a subjectheader widget). */}
      {page.title && <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>}
      {page.body && (
        <div className="mt-4 max-w-3xl">
          <Markdown>{page.body}</Markdown>
        </div>
      )}
      <div className="mt-8 space-y-6">
        {rows.map((row, r) => (
          <div
            key={r}
            className="grid items-start gap-6 lg:[grid-template-columns:var(--cols)]"
            style={{
              ["--cols" as string]: row.cells.map((c) => `${c.span}fr`).join(" "),
            }}
          >
            {row.cells.map((cell, c) => (
              <div key={c} className="min-w-0 space-y-6">
                {cell.widgets.map((widget, w) => (
                  <Widget key={w} widget={widget} subject={subject} viewers={viewers} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

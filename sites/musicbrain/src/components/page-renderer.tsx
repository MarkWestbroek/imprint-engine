import type { Page, PageLayout, WidgetInstance } from "@imprint/content-core";
import { Markdown } from "@/components/markdown";
import { widgetComponents } from "@/widgets/components";
import { layoutRows } from "@/widgets/templates";

/**
 * Renders a composed page (UML: Page ◆ PageLayout ◇ Widget*): rows of
 * cells, widgets stacked inside each cell. Cell widths are fraction units
 * (span 1|2 = one-third + two-thirds); below lg everything stacks.
 */

export function Widget({ widget }: { widget: WidgetInstance }) {
  const Component = widgetComponents[widget.type];
  if (!Component) {
    // Store validation should have caught this; fail loudly, not silently.
    throw new Error(`No component for widget type "${widget.type}"`);
  }
  return <Component config={widget.config} />;
}

export function PageRenderer({ page }: { page: Page & { layout: PageLayout } }) {
  const rows = layoutRows(page.layout);
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
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
                  <Widget key={w} widget={widget} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

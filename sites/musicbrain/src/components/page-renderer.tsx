import type { Page, PageLayout, WidgetPlacement } from "@imprint/content-core";
import { Markdown } from "@/components/markdown";
import { widgetComponents } from "@/widgets/components";
import { TEMPLATES } from "@/widgets/templates";

/**
 * Renders a composed page (UML: Page ◆ PageLayout ◇ Widget*). A template
 * names the region arrangement; widgets are grouped per region and rendered
 * in content order. New arrangements are one entry in templates.ts.
 */

function Region({ widgets }: { widgets: WidgetPlacement[] }) {
  return (
    <div className="space-y-6">
      {widgets.map((w, i) => {
        const Widget = widgetComponents[w.type];
        if (!Widget) {
          // Store validation should have caught this; fail loudly, not silently.
          throw new Error(`No component for widget type "${w.type}"`);
        }
        return <Widget key={i} config={w.config} />;
      })}
    </div>
  );
}

export function PageRenderer({ page }: { page: Page & { layout: PageLayout } }) {
  const template = TEMPLATES[page.layout.template];
  if (!template) {
    throw new Error(
      `Unknown layout template "${page.layout.template}" (known: ${Object.keys(TEMPLATES).join(", ")})`
    );
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
      {page.body && (
        <div className="mt-4 max-w-3xl">
          <Markdown>{page.body}</Markdown>
        </div>
      )}
      <div className={`mt-8 grid items-start gap-6 ${template.grid}`}>
        {template.regions.map((region) => (
          <Region
            key={region}
            widgets={page.layout.widgets.filter((w) => w.region === region)}
          />
        ))}
      </div>
    </div>
  );
}

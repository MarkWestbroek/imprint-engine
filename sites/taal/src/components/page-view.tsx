import { Markdown, PageRenderer } from "@imprint/runtime-admin";
import type { Page } from "@imprint/content-core";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * One page from the store: its widget layout through the engine renderer, or
 * its title and Markdown body. No page title above a page that opens with its
 * own hero, nor on the home page.
 */
export async function PageView({ page }: { page: Page }) {
  if (page.layout) {
    const first = page.layout.rows?.[0]?.cells[0]?.widgets[0];
    const untitled = page.slug === "home" || first?.type === "hero";
    return (
      <PageRenderer
        page={{ ...page, title: untitled ? "" : page.title, layout: page.layout }}
        viewers={widgetComponents}
        ctx={await widgetContext()}
      />
    );
  }
  return (
    <>
      <h1>{page.title}</h1>
      <div className="markdown">
        <Markdown>{page.body}</Markdown>
      </div>
    </>
  );
}

/** Slugs that are building blocks, not pages of their own: `_view/*`. */
export const isInternal = (slug: string) => slug.startsWith("_");

import { Markdown, PageRenderer, readOpts } from "@imprint/runtime-admin";
import type { Page } from "@imprint/content-core";
import { store } from "@/lib/content";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * One page from the store: its widget layout through the engine renderer, or
 * — for a page without a layout, such as the imported Pleio pages — its
 * title and Markdown body.
 */
export async function PageView({ page, bare = false }: { page: Page; bare?: boolean }) {
  if (page.layout) {
    // As on commonground.nl: no page title on the home page and the footer, nor
    // above a page that opens with its own hero (Pleio's "lead").
    const first = page.layout.rows?.[0]?.cells[0]?.widgets[0];
    const untitled = bare || page.slug === "home" || first?.type === "hero";
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
      {!bare && <h1>{page.title}</h1>}
      <div className="markdown">
        <Markdown>{page.body}</Markdown>
      </div>
    </>
  );
}

/** Slugs that are building blocks, not pages of their own: `_footer`, `_view/*`. */
export const isInternal = (slug: string) => slug.startsWith("_");

/** The footer's content: the page `_footer`, edited in the studio like any page. */
export async function FooterContent() {
  const page = await store.getPage("_footer", await readOpts());
  return page ? <PageView page={page} bare /> : null;
}

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
  const lang = pageLang(page.slug);
  if (lang) return <div lang={lang}>{await pageContent(page)}</div>;
  return pageContent(page);
}

/**
 * The language of a translated page, from its slug: `woonwagen/pl` is the
 * Polish version of `woonwagen`. The site itself is Dutch (`<html lang>`), so
 * such a page marks its own content; screen readers and search engines read
 * the nearest `lang`.
 */
const PAGE_LANGS = ["pl", "en", "de"];
export function pageLang(slug: string): string | undefined {
  const last = slug.split("/").pop() ?? "";
  return slug.includes("/") && PAGE_LANGS.includes(last) ? last : undefined;
}

async function pageContent(page: Page) {
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

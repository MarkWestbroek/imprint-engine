import { Markdown, PageRenderer } from "@imprint/runtime-admin";
import type { Page } from "@imprint/content-core";
import { imprint } from "@/lib/content";
import { pageReadOptions, pathPrefix, SITE } from "@/lib/locale";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * One page from the store, in a language: its widget layout through the engine
 * renderer, or its title and Markdown body. No page title above a page that
 * opens with its own hero or opening, nor on the home page. The widgets get
 * the language for their fixed texts, the /en prefix for the links they make,
 * and read options that only find what is translated.
 */
export async function PageView({ page, locale }: { page: Page; locale: string }) {
  if (page.layout) {
    const first = page.layout.rows?.[0]?.cells[0]?.widgets[0];
    const untitled = page.slug === "home" || first?.type === "hero" || first?.type === "doorbraak";
    const ctx = {
      ...(await widgetContext()),
      locale: locale === SITE.defaultLocale ? imprint.uiLocale : locale,
      pathPrefix: pathPrefix(locale),
      readOptions: await pageReadOptions(locale),
    };
    return <PageRenderer page={{ ...page, title: untitled ? "" : page.title, layout: page.layout }} viewers={widgetComponents} ctx={ctx} />;
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

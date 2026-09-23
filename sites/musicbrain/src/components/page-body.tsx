import type { AuthzenSubject, Page } from "@imprint/content-core";
import { Markdown } from "@imprint/runtime-admin";
import { PageRenderer } from "@/components/page-renderer";

/**
 * One content page, however it was written: composed pages (a layout) go
 * through the widget engine, markdown pages render as an article. Shared by
 * the static catch-all route and the dynamic members route, so a page looks
 * the same whether it is public or restricted.
 */
export function PageBody({ page, reader }: { page: Page; reader?: AuthzenSubject }) {
  if (page.layout) {
    return <PageRenderer page={{ ...page, layout: page.layout }} reader={reader} />;
  }
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
      {page.publishedAt && <p className="mt-2 text-sm text-muted">{page.publishedAt}</p>}
      <div className="mt-6">
        <Markdown>{page.body}</Markdown>
      </div>
    </article>
  );
}

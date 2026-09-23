import type { ReactNode } from "react";
import { isContentType, type ContentType } from "@imprint/content-core";
import { layoutRows } from "./layout";
import { PageRenderer, type WidgetContext, type WidgetViewers } from "./page-renderer";

/**
 * Default views per content type are just pages at slug "_view/<type>",
 * composed in the studio. A per-type route renders that page's layout with the
 * item as subject; if no such page exists it renders the hand-coded fallback.
 * So default views are studio-editable, with a built-in default underneath.
 */

const VIEW_PREFIX = "_view/";

/** "_view/component" → "component" (a content type the model knows), else undefined. */
export function viewTargetType(slug: string | undefined): ContentType | undefined {
  if (!slug?.startsWith(VIEW_PREFIX)) return undefined;
  const type = slug.slice(VIEW_PREFIX.length);
  return isContentType(type) ? type : undefined;
}

export function viewSlugFor(type: ContentType): string {
  return `${VIEW_PREFIX}${type}`;
}

export async function DefaultView({
  type,
  subject,
  title,
  fallback,
  viewers,
  ctx,
}: {
  type: ContentType;
  subject: unknown;
  title: string;
  fallback: ReactNode;
  viewers: WidgetViewers;
  ctx: WidgetContext;
}) {
  // With the request's read options: in an as-of preview, the view of that moment.
  const view = await ctx.store.getPage(viewSlugFor(type), { ...ctx.readOptions, includeDrafts: true });
  if (view?.layout) {
    const layout = view.layout;
    // A view with its own subjectheader owns the h1 — don't render the title twice.
    const ownsHeader = layoutRows(layout).some((row) =>
      row.cells.some((cell) => cell.widgets.some((w) => w.type === "subjectheader"))
    );
    return (
      <PageRenderer
        page={{ ...view, title: ownsHeader ? "" : title, body: "", layout }}
        subject={subject}
        viewers={viewers}
        ctx={ctx}
      />
    );
  }
  return <>{fallback}</>;
}

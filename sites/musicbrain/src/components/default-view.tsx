import type { ContentType } from "@imprint/content-core";
import { store } from "@/lib/content";
import { PageRenderer } from "@/components/page-renderer";
import { layoutRows } from "@/widgets/templates";

/**
 * Default views per content type are just pages at slug "_view/<type>",
 * composed in the studio. A per-type route renders that page's layout with the
 * item as subject; if no such page exists it renders the hand-coded fallback.
 * So default views are studio-editable, with a built-in default underneath.
 */

const VIEW_PREFIX = "_view/";
const CONTENT_TYPES = new Set<ContentType>([
  "site",
  "product",
  "component",
  "board-spec",
  "release",
  "page",
  "menu",
]);

/** "_view/component" → "component" (a valid content type), else undefined. */
export function viewTargetType(slug: string | undefined): ContentType | undefined {
  if (!slug?.startsWith(VIEW_PREFIX)) return undefined;
  const type = slug.slice(VIEW_PREFIX.length);
  return CONTENT_TYPES.has(type as ContentType) ? (type as ContentType) : undefined;
}

export function viewSlugFor(type: ContentType): string {
  return `${VIEW_PREFIX}${type}`;
}

export async function DefaultView({
  type,
  subject,
  title,
  fallback,
}: {
  type: ContentType;
  subject: unknown;
  title: string;
  fallback: React.ReactNode;
}) {
  const view = await store.getPage(viewSlugFor(type), { includeDrafts: true });
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
      />
    );
  }
  return <>{fallback}</>;
}

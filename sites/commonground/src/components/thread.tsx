import { AnnotationThread } from "@imprint/plugin-annotations";
import { pluginAction } from "@/app/admin/actions";

/**
 * The annotation thread under an item (design/annotaties.md): a client
 * island that asks the plugin what this visitor may see and do, so the page
 * itself stays prerendered. Renders nothing when the item is not annotatable.
 */
export function Thread({ type, slug, path }: { type: string; slug: string; path: string }) {
  return <AnnotationThread target={{ type, slug }} call={pluginAction} loginHref={`/account/login?next=${encodeURIComponent(path)}`} />;
}

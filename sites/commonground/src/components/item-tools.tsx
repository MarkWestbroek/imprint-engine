import { EventTools } from "@imprint/plugin-events";
import { PostTools } from "@imprint/plugin-groups";
import { pluginAction } from "@/app/admin/actions";

/**
 * What the site hangs above an item a plugin rendered, by its type: on a
 * post, the writer's "bewerken" and "verwijderen" (plugin-groups; the blog
 * plugin itself knows nothing of groups), on an event its maker's. Client islands, so the page stays
 * prerendered.
 */
export function ItemTools({ type, slug }: { type: string; slug: string }) {
  if (type === "post") return <PostTools slug={slug} call={pluginAction} />;
  if (type === "event") return <EventTools slug={slug} call={pluginAction} />;
  return null;
}

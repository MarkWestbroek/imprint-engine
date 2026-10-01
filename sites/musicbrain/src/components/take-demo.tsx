import type { AssetRecord } from "@imprint/content-core";
import type { WidgetContext } from "@imprint/runtime-admin";
import { imprint } from "@/lib/content";
import { widgetComponents } from "@/widgets/components";

/**
 * A patch's demo on /patches/<slug> (plugin-patches): the site's own take
 * widget — audio plus the piano roll of the .mid in the same group — fed
 * with the take's audio asset. The widget reads through the visitor's view,
 * as on a page.
 */
export async function TakeDemo({ audio }: { audio: AssetRecord }) {
  const Take = widgetComponents.take;
  if (!Take) return null;
  const ctx: WidgetContext = { store: imprint.store, writableStore: imprint.writableStore, readOptions: {} };
  return <Take config={{ src: `asset:${audio.slug}`, title: audio.title || undefined, height: 160, controllers: true }} ctx={ctx} />;
}

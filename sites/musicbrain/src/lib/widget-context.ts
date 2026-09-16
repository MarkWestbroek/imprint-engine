import type { WidgetContext } from "@imprint/runtime-admin";
import { store, writableStore } from "@/lib/content";
import { readOpts } from "@/lib/preview";

/**
 * The WidgetContext for the current request (architecture.md §3): this site's
 * stores plus the read options of the as-of preview. Built here, once, and
 * handed to the engine renderer; viewers themselves never import the store
 * or request APIs (enforced by lint).
 */
export async function widgetContext(): Promise<WidgetContext> {
  return { store, writableStore, readOptions: await readOpts() };
}

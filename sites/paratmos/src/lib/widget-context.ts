import { readOpts } from "@imprint/runtime-admin";
import type { WidgetContext } from "@imprint/runtime-admin";
import { imprint } from "@/lib/content";

/**
 * The WidgetContext for this site (architecture.md §3): the visitor's stores
 * plus the read options of the as-of preview (the admin's Time travel).
 */
export async function widgetContext(): Promise<WidgetContext> {
  return { store: imprint.store, writableStore: imprint.writableStore, readOptions: await readOpts() };
}

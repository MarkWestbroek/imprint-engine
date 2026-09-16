import type { WidgetContext } from "@imprint/runtime-admin";
import { imprint } from "@/lib/content";

/**
 * The WidgetContext for this site (architecture.md §3). No as-of preview here
 * yet (that arrives with the shared admin), so every visitor reads with the
 * same, empty read options.
 */
export function widgetContext(): WidgetContext {
  return { store: imprint.store, writableStore: imprint.writableStore, readOptions: {} };
}

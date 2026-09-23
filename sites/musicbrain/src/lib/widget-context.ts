import { ANONYMOUS, guardReads, type AuthzenSubject } from "@imprint/content-core";
import type { WidgetContext } from "@imprint/runtime-admin";
import { imprint, store, writableStore } from "@/lib/content";
import { getSession } from "@/lib/auth";
import { subjectOf } from "@/lib/authorize";
import { readOpts } from "@/lib/preview";

/**
 * The WidgetContext for the current request (architecture.md §3): this site's
 * stores plus the read options of the as-of preview. Built here, once, and
 * handed to the engine renderer; viewers themselves never import the store
 * or request APIs (enforced by lint).
 *
 * Both stores are the guarded view for whoever is reading (design/fase-3
 * §4.3): a static render has no reader and gets the visitor's view, so a
 * restricted item never lands in prerendered HTML through a list widget. The
 * as-of preview (dynamic, editors only) and the members route pass the
 * signed-in reader.
 */
export async function widgetContext(reader?: AuthzenSubject): Promise<WidgetContext> {
  const readOptions = await readOpts();
  const who = reader ?? (readOptions.includeDrafts ? subjectOf(await getSession()) : ANONYMOUS);
  return {
    store: who === ANONYMOUS ? store : imprint.storeFor(who),
    writableStore: writableStore && guardReads(writableStore, who, imprint.pdp),
    readOptions,
  };
}

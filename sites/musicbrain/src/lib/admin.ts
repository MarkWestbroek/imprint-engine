import { createAdminContext } from "@imprint/runtime-admin";
import { editingSession, getSession } from "@/lib/auth";
import { imprint } from "@/lib/content";
import { widgetCatalog } from "@/widgets/registry";

/**
 * The admin context of this site (design/fase-3 §10): the instance, the
 * session (read from the request, so it lives here), the widget catalogue
 * for the studio, and the admin screens this site adds. The shared admin
 * gets everything from here; nothing under /admin reaches into other site
 * modules for it.
 */
export const admin = createAdminContext({
  imprint,
  auth: { getSession, editingSession },
  widgetCatalog,
});

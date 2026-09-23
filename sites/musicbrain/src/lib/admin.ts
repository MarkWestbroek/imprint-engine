import { createAdminContext } from "@imprint/runtime-admin/admin-server";
import { auth } from "@/lib/auth";
import { imprint } from "@/lib/content";
import { widgetCatalog } from "@/widgets/registry";

/**
 * The admin context of this site (design/fase-3 §10): the instance, the
 * session, the widget catalogue for the studio, and the admin screens this
 * site adds to the menu. The shared admin gets everything from here; nothing
 * under /admin reaches into other site modules for it.
 */
export const admin = createAdminContext({
  imprint,
  auth,
  widgetCatalog,
  // This site's own screens; the content types themselves come from the catalogue.
  contributions: [
    { group: "content", section: "Planning", items: [{ href: "/admin/planning", label: "Planning" }] },
    { group: "content", section: "Wiki", items: [{ href: "/admin/wiki", label: "Wikis" }] },
    { group: "design", items: [{ href: "/admin/views", label: "Default views" }] },
    { group: "config", items: [{ href: "/admin/model", label: "Content model" }, { href: "/admin/relations", label: "Relations" }] },
  ],
});

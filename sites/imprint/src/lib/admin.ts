import { createAdminContext, createSessionAuth } from "@imprint/runtime-admin/admin-server";
import { imprint } from "@/lib/content";
import { widgetCatalog } from "@/widgets/registry";
import { widgetComponents } from "@/widgets/components";
import { StudioChrome } from "@/components/studio-chrome";

/**
 * The admin context of the Imprint site (design/fase-3 §10, step 7): the
 * shared admin (@imprint/runtime-admin) with this instance. No screens of
 * its own yet, so no contributions beyond the content model overview and the
 * relation rules; the content types come from the catalogue in
 * imprint.config.ts.
 */
export const auth = createSessionAuth(imprint);

export const admin = createAdminContext({
  imprint,
  auth,
  widgetCatalog,
  // The page studio with this site's eight viewers and its header/footer around the canvas.
  studio: { viewers: widgetComponents, chrome: StudioChrome },
  contributions: [
    { group: "config", items: [{ href: "/admin/model", label: "Content model" }, { href: "/admin/relations", label: "Relations" }] },
  ],
});

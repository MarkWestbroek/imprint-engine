import type { ContentType, RoleType } from "@imprint/content-core";
import type { ImprintInstance } from "@imprint/extension-api";
import { contentFormSchema, widgetFormSchemas, type JsonSchema, type WidgetCatalogEntry, type WidgetFormSchema } from "./forms";

/**
 * The admin context (design/fase-3 §10, step 4): everything the shared admin
 * needs from the site, in one object, so no admin screen or action reaches
 * into site modules. The instance brings the stores, users, PDP, catalogue,
 * assets, session settings and secrets; the site adds what is bound to its
 * framework (the session, read from the request) and what only it knows
 * (its widget catalogue, its extra admin screens).
 *
 * Step 4 defines it and hands it to the screens that already exist in the
 * site; step 5 moves those screens and their actions into this package,
 * where this is all they get.
 */

/** What the admin knows about who is signed in. */
export type AdminSession = { name: string; role: RoleType };

/** Session access, supplied by the site because it reads the request (cookies). */
export interface AdminAuth {
  getSession(): Promise<AdminSession | null>;
  /** The session when it may edit content, null otherwise. */
  editingSession(): Promise<AdminSession | null>;
}

/** An admin menu group a site or plugin contributes (design/fase-3 §10). */
export interface AdminContribution {
  id: string;
  label: string;
  /** Only for admins (e.g. user management). */
  adminOnly?: boolean;
  sections: { label?: string; items: { href: string; label: string }[] }[];
}

export interface AdminContext {
  imprint: ImprintInstance;
  auth: AdminAuth;
  /** The form definition per content type, and the widget forms for the studio. */
  forms: {
    content(type: ContentType): JsonSchema;
    widgets(): WidgetFormSchema[];
  };
  contributions: AdminContribution[];
}

export function createAdminContext(opts: {
  imprint: ImprintInstance;
  auth: AdminAuth;
  widgetCatalog: readonly WidgetCatalogEntry[];
  contributions?: AdminContribution[];
}): AdminContext {
  let widgets: WidgetFormSchema[] | undefined;
  return {
    imprint: opts.imprint,
    auth: opts.auth,
    forms: {
      content: contentFormSchema,
      // The catalogue is fixed for the life of the process (it is code): compute once.
      widgets: () => (widgets ??= widgetFormSchemas(opts.widgetCatalog)),
    },
    contributions: opts.contributions ?? [],
  };
}

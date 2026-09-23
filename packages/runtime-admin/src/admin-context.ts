import type { ContentType, RoleType } from "@imprint/content-core";
import type { ImprintInstance } from "@imprint/extension-api";
import { contentFormSchema, widgetFormSchemas, type JsonSchema, type WidgetCatalogEntry, type WidgetFormSchema } from "./forms";

/**
 * The admin context (design/fase-3 §10, steps 4 and 5): everything the shared
 * admin needs from the site, in one object, so no admin screen or action
 * reaches into site modules. The instance brings the stores, users, PDP,
 * catalogue, assets, session settings and secrets; the site adds what is
 * bound to its framework (the session, read from the request) and what only
 * it knows (its widget catalogue, its extra admin screens).
 *
 * The screens and actions in `admin-server/` take this as their first
 * argument; the site's thin route files and its `"use server"` module pass
 * it in. Explicit on purpose: a "use server" file may only export plain
 * async functions, so the context cannot be closed over — and a process-wide
 * singleton would be invisible in the code.
 */

/** What the admin knows about who is signed in. */
export type AdminSession = { name: string; role: RoleType };

/** Session access, supplied by the site because it reads and sets the request's cookies. */
export interface AdminAuth {
  getSession(): Promise<AdminSession | null>;
  /** The session when it may edit content, null otherwise. */
  editingSession(): Promise<AdminSession | null>;
  /** Check credentials and start a session; null when they don't hold. */
  signIn(name: string, password: string): Promise<AdminSession | null>;
  signOut(): Promise<void>;
}

/**
 * Menu items a site or plugin adds to the admin (design/fase-3 §10). `group`
 * names one of the standard groups (`overview`, `content`, `design`,
 * `config`, `manage`) or a new one, which then needs a `label`. Items of the
 * content types themselves come from the catalogue (`CONTENT_TYPES[type].menu`).
 */
export interface AdminContribution {
  group: string;
  /** Label of the group, when `group` is not a standard one. */
  label?: string;
  /** Sub-heading within the group (the content group has "Site", "Catalogus", …). */
  section?: string;
  adminOnly?: boolean;
  items: { href: string; label: string }[];
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

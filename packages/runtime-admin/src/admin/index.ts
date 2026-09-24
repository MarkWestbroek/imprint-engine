/**
 * @imprint/runtime-admin/admin — the generic client components of the admin
 * (design/fase-3 §11.1, step 4). Framework-agnostic in the sense that matters:
 * they import no site module and no server action; actions come in as props.
 * Styling is Tailwind classes on the site's design tokens (globals.css has
 * an `@source` for this package).
 */
export { AdminShell, type MenuGroup, type MenuItem } from "./admin-shell";
export { confirmDialog, DialogHost, promptDialog } from "./dialog";
export { ItemEditor } from "./item-editor";
export { LoginForm } from "./login-form";
export { MarkdownEditor } from "./markdown-editor";
export { MenuEditor, type MenuItemV } from "./menu-editor";
export { RelationsEditor } from "./relations-editor";
export { JsonField, SchemaForm } from "./schema-form";
export { ThemeEditor } from "./theme-editor";
export { NewUserForm, OwnPasswordForm, UserTable } from "./user-manager";
export { DefaultWidgetEditor, type WidgetEditor, type WidgetEditorProps } from "./widget-editor";
export type { ActionResult, FormAction, StudioActions, StudioResult, UserAction, UserActionResult, UserActions } from "./types";

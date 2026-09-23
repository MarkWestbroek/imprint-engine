/**
 * @imprint/runtime-admin/admin-server — the server side of the shared admin
 * (design/fase-3 §11.1, step 5): screens (server components) and action
 * implementations, all taking the site's `AdminContext`. A site's route files
 * render the screens; its `"use server"` module wraps the actions. Separate
 * entry from `./admin` (client components), so a client bundle never pulls
 * in `next/cache`.
 */
export { AdminGate } from "./gate";
export { DashboardScreen } from "./dashboard";
export { ListScreen } from "./list";
export { ItemEditScreen, emptyData } from "./item-edit";
export { HistoryScreen } from "./history";
export { adminMenu } from "./menu";
export { createSessionAuth, type SessionAuth } from "./session";
export { previewEnter, previewExit } from "./preview-routes";
export { UsersScreen } from "./users-screen";
export { RelationsScreen } from "./relations";
export { ViewsScreen } from "./views";
export { ModelScreen } from "./model";
export { changeOwnPassword, createUser, deleteUser, resetPassword, setRole } from "./users";
export {
  deleteItem,
  parseType,
  restoreVersion,
  saveItem,
  saveRelations,
  signIn,
  signOut,
  slugFor,
  type AdminActions,
} from "./actions";
export {
  createAdminContext,
  type AdminAuth,
  type AdminContext,
  type AdminContribution,
  type AdminSession,
} from "../admin-context";

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
export {
  deleteItem,
  parseType,
  restoreVersion,
  saveItem,
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

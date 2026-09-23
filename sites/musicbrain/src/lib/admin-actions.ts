import type { AdminActions } from "@imprint/runtime-admin/admin-server";
import {
  deleteItemAction,
  loginAction,
  logoutAction,
  restoreVersionAction,
  saveItemAction,
} from "@/app/admin/actions";

/**
 * This site's "use server" wrappers, handed to the shared screens. A module
 * of its own: the actions import the context, so the context must not import
 * the actions.
 */
export const adminActions: AdminActions = {
  login: loginAction,
  logout: logoutAction,
  saveItem: saveItemAction,
  deleteItem: deleteItemAction,
  restoreVersion: restoreVersionAction,
};

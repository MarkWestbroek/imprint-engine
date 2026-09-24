import type { AdminActions } from "@imprint/runtime-admin/admin-server";
import {
  deleteItemAction,
  loginAction,
  logoutAction,
  restoreVersionAction,
  saveItemAction,
  saveRelationsAction,
} from "@/app/admin/actions";
import {
  changeOwnPasswordAction,
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  setRoleAction,
} from "@/app/admin/users/actions";
import { draftOpAction, resetDraftAction, savePageDraftAction } from "@/app/admin/studio-actions";

/** This site's "use server" wrappers, handed to the shared screens (a module of its own: no import cycle). */
export const adminActions: AdminActions = {
  login: loginAction,
  logout: logoutAction,
  saveItem: saveItemAction,
  deleteItem: deleteItemAction,
  restoreVersion: restoreVersionAction,
  saveRelations: saveRelationsAction,
  users: {
    createUser: createUserAction,
    setRole: setRoleAction,
    resetPassword: resetPasswordAction,
    deleteUser: deleteUserAction,
  },
  changeOwnPassword: changeOwnPasswordAction,
  studio: { draftOp: draftOpAction, resetDraft: resetDraftAction, savePageDraft: savePageDraftAction },
};

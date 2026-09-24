import type { DraftOp } from "../studio/layout-ops";

/**
 * What the generic admin components expect from a server action. The site
 * (later: the shared admin) owns the actions; the components only render and
 * submit, so they take the action as a prop instead of importing it.
 */
export type ActionResult = { ok: boolean; error?: string };

export type UserActionResult = { ok: boolean; error?: string; message?: string };

/** A `useActionState`-shaped server action. */
export type FormAction<R = ActionResult> = (prev: R | null, formData: FormData) => Promise<R>;

export type UserAction = FormAction<UserActionResult>;

export type UserActions = {
  createUser: UserAction;
  setRole: UserAction;
  resetPassword: UserAction;
  deleteUser: UserAction;
};

export type StudioResult = { ok: boolean; error?: string };

/** The studio's server actions as the client parts call them (a site's "use server" wrappers). */
export type StudioActions = {
  draftOp(slug: string | undefined, lang: string, op: DraftOp): Promise<StudioResult>;
  resetDraft(slug: string | undefined, lang: string): Promise<void>;
  savePageDraft(
    slug: string | undefined,
    lang: string,
    validity: { validFrom?: string; validTo?: string }
  ): Promise<StudioResult & { slug?: string }>;
};

import type { PageDraft } from "./layout-ops";

/**
 * Server-side working copies for the page studio: while editing, every
 * change lands in a draft here; the canvas re-renders from it on
 * router.refresh(). Only "Save" turns the draft into a real version in the
 * content store. Keyed by user + page, kept in process memory — fine for a
 * single Node process (Plesk/Passenger, next start); an unsaved draft does
 * not survive a server restart.
 */

const globalForDrafts = globalThis as unknown as {
  __imprintDrafts?: Map<string, PageDraft>;
};
const drafts = (globalForDrafts.__imprintDrafts ??= new Map<string, PageDraft>());

export function draftKey(user: string, slug: string | undefined, lang: string): string {
  return `${user}:${slug ?? "__new"}:${lang}`;
}

export function getDraft(key: string): PageDraft | undefined {
  return drafts.get(key);
}

export function setDraft(key: string, draft: PageDraft): void {
  drafts.set(key, draft);
}

export function clearDraft(key: string): void {
  drafts.delete(key);
}

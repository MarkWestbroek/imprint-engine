import type { PageDraft } from "../studio/layout-ops";

/**
 * Server-side working copies for the page studio: while editing, every
 * change lands in a draft here; the canvas re-renders from it on
 * router.refresh(). Only "Save" turns the draft into a real version in the
 * content store. Kept in process memory — fine for one Node process per
 * site; an unsaved draft does not survive a restart (backlog: drafts in a
 * table). Keyed per instance as well as per user and page, so two sites in
 * one process (rule 5 of the architecture contract) never see each other's
 * drafts.
 */

const globalForDrafts = globalThis as unknown as {
  __imprintDrafts?: Map<string, PageDraft>;
};
const drafts = (globalForDrafts.__imprintDrafts ??= new Map<string, PageDraft>());

export function draftKey(instance: string, user: string, slug: string | undefined, lang: string): string {
  return `${instance}:${user}:${slug ?? "__new"}:${lang}`;
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

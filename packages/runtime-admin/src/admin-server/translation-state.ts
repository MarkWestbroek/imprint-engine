import type { ContentRecord } from "@imprint/content-core";

/** The pure half of translations in the admin (translations.tsx): no React, no store. */

/**
 * A translation is outdated when the version in the base language was changed
 * after it: the bitemporal model knows both moments (`txFrom`).
 */
export function isOutdated(translation: ContentRecord | null, source: ContentRecord | null): boolean {
  return !!translation && !!source && translation.lang !== source.lang && source.txFrom.getTime() > translation.txFrom.getTime();
}

/** The data a new translation starts with: a copy of the source in the new language, as a draft where the type has drafts. */
export function translationStart(source: ContentRecord, lang: string): Record<string, unknown> {
  const data = { ...(source.data as Record<string, unknown>) };
  if ("lang" in data) data.lang = lang;
  if ("draft" in data) data.draft = true;
  return data;
}

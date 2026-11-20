import Link from "next/link";
import { LANGUAGE_TYPES, type ContentRecord, type ContentType } from "@imprint/content-core";
import type { AdminContext } from "../admin-context";
import { isOutdated } from "./translation-state";

export { isOutdated, translationStart } from "./translation-state";

/**
 * Translations in the admin (design/meertaligheid.md layer 4). A translation
 * is the same item (type + slug) under another language, with its own
 * history. Nothing here writes: "making a translation" is opening the item in
 * a language it does not have yet, which starts the form from the version in
 * the base language; the ordinary Save creates it.
 */

/** Whether items of this type have translations on this site: a type with a language, on a site with more than one. */
export function isTranslatable(admin: AdminContext, type: ContentType): boolean {
  return admin.imprint.locales.length > 1 && LANGUAGE_TYPES.includes(type);
}

export type TranslationState = {
  /** The site's languages, each with the current version of the item in it (or none). */
  versions: { locale: string; item: ContentRecord | null }[];
  /** The version a new translation starts from: the base language's, else the first there is. */
  source: ContentRecord | null;
};

/** The versions of one item per language of the site. */
export async function translationState(admin: AdminContext, type: ContentType, slug: string): Promise<TranslationState> {
  const store = admin.imprint.writableStore!;
  const versions = await Promise.all(
    admin.imprint.locales.map(async (locale) => ({ locale, item: await store.getItem(type, slug, locale) }))
  );
  const source = versions.find((v) => v.locale === admin.imprint.defaultLocale)?.item ?? versions.find((v) => v.item)?.item ?? null;
  return { versions, source };
}

const when = (date: Date) => date.toISOString().slice(0, 16).replace("T", " ");

/**
 * The language tabs above an item's form and in the studio: one per language
 * of the site. A language without a version yet is offered as "+ en"; the
 * notices below say what opening it means and when a translation is behind.
 */
export function LanguageTabs({
  type,
  slug,
  current,
  state,
}: {
  type: string;
  slug: string;
  current: string;
  state: TranslationState;
}) {
  const here = state.versions.find((v) => v.locale === current)?.item ?? null;
  return (
    <div className="mb-4">
      <nav aria-label="Languages" className="flex flex-wrap items-center gap-2 text-sm">
        {state.versions.map(({ locale, item }) =>
          locale === current ? (
            <span key={locale} aria-current="page" className="rounded-md bg-accent px-3 py-1 font-semibold text-background">
              {locale}
              {!item && " (new)"}
            </span>
          ) : (
            <Link
              key={locale}
              href={`/admin/${type}/edit/${slug}?lang=${locale}`}
              className="rounded-md border border-line px-3 py-1 text-muted hover:border-accent hover:text-foreground"
            >
              {item ? locale : `+ ${locale}`}
              {isOutdated(item, state.source) && " ⚠"}
            </Link>
          )
        )}
      </nav>
      {!here && state.source && (
        <p role="status" className="mt-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          <span className="font-semibold">New translation:</span> there is no <code>{current}</code> version yet. This starts
          as a copy of the <code>{state.source.lang}</code> version{"draft" in (state.source.data as object) ? ", as a draft" : ""}.
          Nothing is saved until you save.
        </p>
      )}
      {isOutdated(here, state.source) && state.source && here && (
        <p role="status" className="mt-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          <span className="font-semibold">Outdated:</span> the <code>{state.source.lang}</code> version was changed on{" "}
          {when(state.source.txFrom)}, after this translation ({when(here.txFrom)}).{" "}
          <Link href={`/admin/${type}/history/${slug}?lang=${state.source.lang}`} className="underline">
            See what changed
          </Link>
          . Saving this translation marks it as up to date.
        </p>
      )}
    </div>
  );
}

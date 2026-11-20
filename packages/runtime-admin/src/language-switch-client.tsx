"use client";

import { usePathname } from "next/navigation";
import { languageLinks, splitLocalePath, translationsFromSlugs } from "@imprint/content-core/lang";
import { LanguageSwitch } from "./language-switch";

/**
 * The language choice for a header that sits in a layout (design/meertaligheid.md
 * layer 4). A layout does not know which page is shown, so this client part
 * reads the address and looks the page up in the slugs per language the
 * layout hands it (`pageSlugsByLocale`, read once on the server). An address
 * that is no page of the store (a plugin's route, the search page) has no
 * translation: the other languages then point at their start page.
 */
export function LanguageSwitchClient({
  slugs,
  locales,
  defaultLocale,
  className,
}: {
  /** The page slugs each language has, from `pageSlugsByLocale`. */
  slugs: Readonly<Record<string, readonly string[]>>;
  locales: readonly string[];
  defaultLocale: string;
  className?: string;
}) {
  const site = { locales, defaultLocale };
  const { locale, segments } = splitLocalePath((usePathname() ?? "/").split("/").filter(Boolean), site);
  const translations = translationsFromSlugs(slugs, segments.join("/") || "home", site);
  return <LanguageSwitch links={languageLinks(translations, site)} current={locale} className={className} />;
}

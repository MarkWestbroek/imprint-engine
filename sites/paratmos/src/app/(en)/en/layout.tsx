import type { Metadata } from "next";
import { localizedSite } from "@imprint/content-core";
import { readOpts } from "@imprint/runtime-admin";
import { LanguageChoice } from "@/components/language-choice";
import { languageLabel, menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";
import { LANGUAGES, pagesPerLanguage, SITE } from "@/lib/locale";

/**
 * The English side of the site (/en, design/meertaligheid.md layer 4): the
 * English menu (menus/main.en.json), the page, the footer. One root layout
 * serves both languages, so <html lang> stays the base language; everything
 * visible here sits in an element marked lang="en", which screen readers and
 * search engines follow, and every page carries its hreflang alternates.
 */
const LOCALE = "en";

export async function generateMetadata(): Promise<Metadata> {
  const site = localizedSite(await store.getSiteConfig(), LOCALE);
  return { title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` }, description: site.motto || site.tagline };
}

export default async function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const menu = await store.getMenu("main", { ...(await readOpts()), lang: LOCALE, exactLang: true });
  const languages = <LanguageChoice languages={LANGUAGES} defaultLocale={SITE.defaultLocale} pages={await pagesPerLanguage()} label={languageLabel(LOCALE)} />;
  return (
    <div lang={LOCALE}>
      <SiteHeader nav={menuToNav(menu)} locale={LOCALE} languages={languages} />
      <main className="pm-main">
        <article className="pm-container pm-page">{children}</article>
      </main>
      <SiteFooter locale={LOCALE} />
    </div>
  );
}

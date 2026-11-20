import { readOpts } from "@imprint/runtime-admin";
import { LanguageChoice } from "@/components/language-choice";
import { languageLabel, menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";
import { LANGUAGES, pagesPerLanguage, SITE } from "@/lib/locale";

/** The public site in the base language (Dutch): header with the "main" menu, the page, the footer. English is under app/(en). */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = SITE.defaultLocale;
  const menu = await store.getMenu("main", { ...(await readOpts()), lang: locale });
  const languages = <LanguageChoice languages={LANGUAGES} defaultLocale={locale} pages={await pagesPerLanguage()} label={languageLabel(locale)} />;
  return (
    <>
      <SiteHeader nav={menuToNav(menu)} locale={locale} languages={languages} />
      <main className="pm-main">
        <article className="pm-container pm-page">{children}</article>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

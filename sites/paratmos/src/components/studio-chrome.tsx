import type { ReactNode } from "react";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";
import { SITE } from "@/lib/locale";

/**
 * The site's chrome around the studio canvas: the real header and footer, not
 * clickable while editing, in the language of the page being edited (the
 * studio passes `locale`): an English page gets the English menu and footer.
 */
export async function StudioChrome({ children, locale = SITE.defaultLocale }: { children: ReactNode; locale?: string }) {
  const menu = await store.getMenu("main", locale === SITE.defaultLocale ? { lang: locale } : { lang: locale, exactLang: true });
  const chrome = (
    <div className="relative isolate">
      <div className="pointer-events-none select-none">
        <SiteHeader nav={menuToNav(menu)} locale={locale} />
      </div>
      <main className="pm-main">
        <article className="pm-container pm-page">{children}</article>
      </main>
      <div className="pointer-events-none select-none">
        <SiteFooter locale={locale} />
      </div>
    </div>
  );
  return locale === SITE.defaultLocale ? chrome : <div lang={locale}>{chrome}</div>;
}

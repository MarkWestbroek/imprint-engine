import type { ReactNode } from "react";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";

/** The site's chrome around the studio canvas: the real header and footer, not clickable while editing. */
export async function StudioChrome({ children }: { children: ReactNode }) {
  const [menu, site] = await Promise.all([store.getMenu("main"), store.getSiteConfig()]);
  return (
    <div className="relative isolate">
      <div className="pointer-events-none select-none">
        <SiteHeader nav={menuToNav(menu)} name={site.name} tagline={site.tagline} />
      </div>
      <main className="tl-main">
        <article className="tl-container tl-page">{children}</article>
      </main>
      <div className="pointer-events-none select-none">
        <SiteFooter />
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { menus, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";

/** The site's chrome around the studio canvas: the real header and footer, not clickable while editing. */
export async function StudioChrome({ children }: { children: ReactNode }) {
  const [nav, site] = await Promise.all([menus(), store.getSiteConfig()]);
  return (
    <div className="relative isolate">
      <div className="pointer-events-none select-none">
        <SiteHeader menus={nav} name={site.name} tagline={site.tagline} />
      </div>
      <main className="tl-main">
        <article className="tl-container tl-page">{children}</article>
      </main>
      <div className="pointer-events-none select-none">
        <SiteFooter menus={nav} name={site.name} tagline={site.tagline} />
      </div>
    </div>
  );
}

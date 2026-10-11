import type { ReactNode } from "react";
import { menuToNav, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { store } from "@/lib/content";

/** The site's chrome around the studio canvas: the real header and footer, not clickable while editing. */
export async function StudioChrome({ children }: { children: ReactNode }) {
  const menu = await store.getMenu("main");
  return (
    <div className="relative isolate">
      <div className="pointer-events-none select-none">
        <SiteHeader nav={menuToNav(menu)} />
      </div>
      <main className="om-main">
        <article className="om-container om-page">{children}</article>
      </main>
      <div className="pointer-events-none select-none">
        <SiteFooter />
      </div>
    </div>
  );
}

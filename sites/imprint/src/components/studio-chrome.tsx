import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

/**
 * The site's chrome around the studio canvas: header and footer, not
 * clickable while editing. The header is `position: absolute` on the site
 * (it floats over the hero), so the wrapper is the positioned ancestor and
 * a stacking context of its own — otherwise the header pins itself to the
 * admin window and paints over the sidebar.
 */
export function StudioChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate">
      <div className="pointer-events-none select-none">
        <SiteHeader />
      </div>
      <main className="page-main">
        <article className="content-page">{children}</article>
      </main>
      <div className="pointer-events-none select-none">
        <SiteFooter />
      </div>
    </div>
  );
}

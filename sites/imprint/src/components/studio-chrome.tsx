import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

/** The site's chrome around the studio canvas: header and footer, not clickable while editing. */
export function StudioChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="pointer-events-none select-none">
        <SiteHeader />
      </div>
      <main className="page-main">
        <article className="content-page">{children}</article>
      </main>
      <div className="pointer-events-none select-none">
        <SiteFooter />
      </div>
    </>
  );
}

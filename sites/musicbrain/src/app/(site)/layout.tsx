import Link from "next/link";
import { store } from "@/lib/content";
import { getPreview, readOpts } from "@/lib/preview";
import { menuToNav, SiteChrome } from "@/components/site-chrome";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [preview, opts] = [await getPreview(), await readOpts()];
  const site = await store.getSiteConfig();
  const menu = await store.getMenu("main", opts);
  const themes = await store.listThemes(opts);
  return (
    <SiteChrome site={site} nav={menuToNav(menu)} themes={themes}>
      {preview.active && (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-accent bg-accent/10 px-4 py-2 text-center text-sm backdrop-blur">
          <span>
            Preview
            {preview.asOf && (
              <>
                {" "}
                — site as of{" "}
                <strong className="font-mono">
                  {preview.asOf.toISOString().replace("T", " ").slice(0, 16)} UTC
                </strong>
              </>
            )}
          </span>
          {/* prefetch={false}: a prefetch would end the preview by accident. */}
          <Link
            href="/api/preview/exit"
            prefetch={false}
            className="font-semibold text-accent underline underline-offset-4"
          >
            Exit preview
          </Link>
        </div>
      )}
      {children}
    </SiteChrome>
  );
}

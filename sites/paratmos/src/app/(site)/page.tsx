import type { Metadata } from "next";
import { PageView } from "@/components/page-view";
import { store } from "@/lib/content";
import { pageMetadata, pageReadOptions, SITE } from "@/lib/locale";

/** The home page is the page `home` from the store, like every other page. */

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home", SITE.defaultLocale);
}

export default async function Home() {
  const page = await store.getPage("home", await pageReadOptions(SITE.defaultLocale));
  if (!page) {
    return (
      <>
        <h1>Paratmos</h1>
        <p>Er is nog geen startpagina. Maak in de admin een pagina met de slug <code>home</code>.</p>
      </>
    );
  }
  return <PageView page={page} locale={SITE.defaultLocale} />;
}

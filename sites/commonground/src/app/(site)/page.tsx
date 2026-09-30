import type { Metadata } from "next";
import { readOpts } from "@imprint/runtime-admin";
import { PageView } from "@/components/page-view";
import { store } from "@/lib/content";

/** The home page is the page `home` from the store, like every other page. */

export async function generateMetadata(): Promise<Metadata> {
  const page = await store.getPage("home");
  return page?.description ? { description: page.description } : {};
}

export default async function Home() {
  const page = await store.getPage("home", await readOpts());
  if (!page) {
    return (
      <article className="cg-page">
        <h1>Common Ground</h1>
        <p>Er is nog geen startpagina. Maak in de admin een pagina met de slug <code>home</code>.</p>
      </article>
    );
  }
  return (
    <article className="cg-page">
      <PageView page={page} />
    </article>
  );
}

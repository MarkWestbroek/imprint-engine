import type { Metadata } from "next";
import Link from "next/link";
import { readOpts } from "@imprint/runtime-admin";
import { PageView } from "@/components/page-view";
import { store } from "@/lib/content";

/** The public explanation is the page `home` from the store. */

export async function generateMetadata(): Promise<Metadata> {
  const page = await store.getPage("home");
  return page?.description ? { description: page.description } : {};
}

export default async function Home() {
  const page = await store.getPage("home", await readOpts());
  if (page) return <PageView page={page} />;
  return (
    <>
      <h1>Inrichting van e-diensten</h1>
      <p>
        Er is nog geen uitlegpagina: maak in de admin een pagina met de slug <code>home</code>. De inrichting zelf staat onder{" "}
        <Link href="/inrichting">/inrichting</Link>.
      </p>
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readOpts } from "@imprint/runtime-admin";
import { Leerling, pakketHref } from "@imprint/plugin-taal";
import { pluginAction } from "@/app/admin/actions";
import { PageView } from "@/components/page-view";
import { store } from "@/lib/content";
import { TAAL } from "../../../imprint.config";

/**
 * The front page: the page `home` from the store (edited in the studio), with
 * the widget "verder" pointing at the next lesson. Without that page the site
 * opens on the lessons of its package, as before.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await store.getPage("home");
  return page ? { title: { absolute: page.title }, description: page.description } : {};
}

export default async function Home() {
  const page = await store.getPage("home", await readOpts());
  if (!page) redirect(pakketHref(TAAL.standaardUi, TAAL.pakket));
  return (
    <>
      {/* For a member: bring the browser's results and the account's in line, so "verder" knows. */}
      <Leerling call={pluginAction} />
      <PageView page={page} />
    </>
  );
}

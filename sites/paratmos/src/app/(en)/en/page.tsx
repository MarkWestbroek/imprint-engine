import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageView } from "@/components/page-view";
import { store } from "@/lib/content";
import { pageMetadata, pageReadOptions } from "@/lib/locale";

/** The English start page: the English version of `home`, else the Dutch one. */
const LOCALE = "en";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home", LOCALE);
}

export default async function EnglishHome() {
  const page = await store.getPage("home", await pageReadOptions(LOCALE));
  if (!page) redirect("/");
  return <PageView page={page} locale={LOCALE} />;
}

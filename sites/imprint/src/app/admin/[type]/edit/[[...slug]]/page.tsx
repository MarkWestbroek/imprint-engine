import { ItemEditScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";

type Props = {
  params: Promise<{ type: string; slug?: string[] }>;
  searchParams: Promise<{ lang?: string }>;
};

/**
 * Every type through the generic form, pages included: the form edits a
 * page's meta and keeps its layout as it is. The visual studio comes with
 * Fase 4 of the engine revision.
 */
export default async function AdminEdit({ params, searchParams }: Props) {
  const { type, slug: slugParts } = await params;
  const { lang } = await searchParams;
  const slug = slugParts?.map(decodeURIComponent).join("/");
  return <ItemEditScreen admin={admin} type={type} slug={slug} lang={lang ?? "en"} actions={adminActions} />;
}

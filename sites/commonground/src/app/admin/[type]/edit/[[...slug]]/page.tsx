import { ItemEditScreen, PageStudioScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";

type Props = {
  params: Promise<{ type: string; slug?: string[] }>;
  searchParams: Promise<{ lang?: string; previewAs?: string }>;
};

/** Pages get the visual studio (the shared one, with this site's widgets and chrome); the rest the generic form. */
export default async function AdminEdit({ params, searchParams }: Props) {
  const { type, slug: slugParts } = await params;
  const { lang, previewAs } = await searchParams;
  const slug = slugParts?.map(decodeURIComponent).join("/");
  if (type === "page") {
    return <PageStudioScreen admin={admin} actions={adminActions} slug={slug} lang={lang ?? "en"} previewAs={previewAs} />;
  }
  return <ItemEditScreen admin={admin} type={type} slug={slug} lang={lang ?? "en"} actions={adminActions} />;
}

import { ItemEditScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";
import { PageStudio } from "@/components/admin/studio";

type Props = {
  params: Promise<{ type: string; slug?: string[] }>;
  searchParams: Promise<{ lang?: string; previewAs?: string }>;
};

export default async function AdminEdit({ params, searchParams }: Props) {
  const { type, slug: slugParts } = await params;
  const { lang, previewAs } = await searchParams;
  const slug = slugParts?.map(decodeURIComponent).join("/");

  // Pages get the visual studio (live canvas + sidebar), the rest the generic form.
  if (type === "page") {
    return <PageStudio slug={slug} lang={lang ?? "en"} previewAs={previewAs} />;
  }
  return <ItemEditScreen admin={admin} type={type} slug={slug} lang={lang ?? "en"} actions={adminActions} />;
}

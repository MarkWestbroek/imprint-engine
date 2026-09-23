import { HistoryScreen } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";
import { adminActions } from "@/lib/admin-actions";

type Props = {
  params: Promise<{ type: string; slug: string[] }>;
  searchParams: Promise<{ lang?: string }>;
};

export default async function AdminHistory({ params, searchParams }: Props) {
  const { type, slug: slugParts } = await params;
  const { lang } = await searchParams;
  const slug = slugParts.map(decodeURIComponent).join("/");
  return <HistoryScreen admin={admin} type={type} slug={slug} lang={lang ?? "en"} actions={adminActions} />;
}

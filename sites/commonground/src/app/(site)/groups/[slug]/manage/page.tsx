import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GroupManageScreen } from "@imprint/plugin-groups";
import { admin } from "@/lib/admin";
import { pluginAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Beheer", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** The group's own management page (plugin-groups): for its owner, managers and the site's staff. */
export default async function ManageGroupPage({ params }: Props) {
  const { slug } = await params;
  const screen = await GroupManageScreen({ admin, slug, call: pluginAction });
  if (!screen) {
    if (!(await admin.auth.getSession())) redirect(`/account/login?next=${encodeURIComponent(`/groups/${slug}/manage`)}`);
    notFound();
  }
  return <div className="cg-page">{screen}</div>;
}

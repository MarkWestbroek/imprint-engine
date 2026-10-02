import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pluginPublicRoute, readOpts } from "@imprint/runtime-admin";
import { subjectFor } from "@imprint/runtime-admin/admin-server";
import { PageView } from "@/components/page-view";
import { ItemTools } from "@/components/item-tools";
import { Thread } from "@/components/thread";
import { admin } from "@/lib/admin";
import { imprint } from "@/lib/content";
import { pluginAction } from "@/app/admin/actions";

/**
 * Content that is not for everyone (design/communities.md §4.2): `restricted`
 * (members of the site) and `group:<slug>` (members of that group). Rendered
 * per request for the session at hand: the subject carries the user's groups,
 * the PDP decides, and nothing of it is ever prerendered. The public
 * catch-all sends non-public items here; not signed in = to the login first.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const session = await admin.auth.getSession();
  const page = await imprint.storeFor(await subjectFor(admin, session)).getPage(slug.join("/"), await readOpts());
  return page ? { title: page.title, description: page.description, robots: { index: false } } : { robots: { index: false } };
}

export default async function MembersPage({ params }: Props) {
  const { slug } = await params;
  const joined = slug.map(decodeURIComponent).join("/");
  const session = await admin.auth.getSession();
  if (!session) redirect(`/account/login?next=${encodeURIComponent(`/members/${joined}`)}`);
  const subject = await subjectFor(admin, session);

  // A plugin may claim the URL (a wiki, a term, a group); it decides with the PDP for this subject.
  const hit = await pluginPublicRoute({ imprint, slug, members: true, session, subject, call: pluginAction });
  if (hit) {
    if ("redirect" in hit) notFound();
    return (
      <article className="cg-page">
        {hit.item && <ItemTools type={hit.item.type} slug={hit.item.slug} />}
        {hit.render}
        {hit.item && <Thread type={hit.item.type} slug={hit.item.slug} path={`/members/${joined}`} />}
      </article>
    );
  }

  const page = await imprint.storeFor(subject).getPage(joined, await readOpts());
  if (!page) notFound();
  return (
    <article className="cg-page">
      <PageView page={page} />
      <Thread type="page" slug={page.slug} path={`/members/${joined}`} />
    </article>
  );
}

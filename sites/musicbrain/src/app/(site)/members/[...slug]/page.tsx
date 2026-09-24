import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { imprint } from "@/lib/content";
import { getSession } from "@/lib/auth";
import { pluginPublicRoute } from "@imprint/runtime-admin";
import { subjectOf } from "@/lib/authorize";
import { readOpts } from "@/lib/preview";
import { PageBody } from "@/components/page-body";

/**
 * Restricted content lives here (design/fase-3 §4.3, decision: own path).
 * The public catch-all is prerendered and must never hold restricted content,
 * so it sends restricted slugs to /members/<slug>; this route renders per
 * request, for the session at hand, after the PDP said yes. Denied — or not
 * signed in — is a 404: the URL does not confirm that something exists.
 *
 * Same content as the catch-all (pages, wikis), same look; only who may see
 * it differs. Products, components and releases have no restricted view yet:
 * restricted ones simply vanish from the public site (backlog).
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const reader = imprint.storeFor(subjectOf(await getSession()));
  const page = await reader.getPage(slug.join("/"), await readOpts());
  return page ? { title: page.title, description: page.description, robots: { index: false } } : {};
}

export default async function MembersPage({ params }: Props) {
  const { slug } = await params;
  const joined = slug.join("/");
  const session = await getSession();
  const subject = subjectOf(session);
  const opts = await readOpts();

  // A plugin may claim the URL (the wiki does); it decides with the PDP for this session.
  const hit = await pluginPublicRoute({ imprint, slug, members: true, session });
  if (hit) {
    if ("redirect" in hit) notFound();
    return hit.render;
  }

  const page = await imprint.storeFor(subject).getPage(joined, opts);
  if (!page) notFound();
  return <PageBody page={page} reader={subject} />;
}

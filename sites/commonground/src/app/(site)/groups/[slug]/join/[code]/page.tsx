import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { redeemInvite } from "@imprint/plugin-groups";
import { admin } from "@/lib/admin";

export const metadata: Metadata = { title: "Uitnodiging", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; code: string }> };

/** An invitation link (design/communities.md §4.1a): sign in (or register) first, then the membership is there. */
export default async function JoinPage({ params }: Props) {
  const { slug, code } = await params;
  const here = `/groups/${slug}/join/${code}`;
  if (!(await admin.auth.getSession())) redirect(`/account/login?next=${encodeURIComponent(here)}`);
  const result = await redeemInvite(admin, slug, code);
  if (result.ok) redirect(`/groups/${slug}?joined=1`);
  return (
    <article className="cg-page cg-narrow">
      <h1>Uitnodiging</h1>
      <p className="cg-error">{result.error}</p>
      <p>
        <Link href={`/groups/${slug}`}>Naar de community</Link>
      </p>
    </article>
  );
}

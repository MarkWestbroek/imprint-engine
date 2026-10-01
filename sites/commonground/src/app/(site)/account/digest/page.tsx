import type { Metadata } from "next";
import Link from "next/link";
import { digestOffByToken } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

export const metadata: Metadata = { title: "Dagelijkse mail", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

/** The unsubscribe link from a digest mail: one click, no login; the inbox on the site stays. */
export default async function DigestOffPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const user = await digestOffByToken(admin, token ?? "");
  return (
    <article className="cg-page cg-narrow">
      <h1>Dagelijkse mail</h1>
      {user ? (
        <p className="cg-notice">
          Je ontvangt geen dagelijkse mail meer, {user.name}. Je mededelingen blijven op de site staan; weer aanzetten kan op <Link href="/account">Mijn account</Link>.
        </p>
      ) : (
        <p className="cg-error">
          Deze link is onbekend, al gebruikt of verlopen. De dagelijkse mail zet je ook uit op <Link href="/account">Mijn account</Link>.
        </p>
      )}
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { markNotificationsRead, myNotifications } from "@imprint/runtime-admin/admin-server";
import { admin } from "@/lib/admin";

export const metadata: Metadata = { title: "Mededelingen", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = (d: Date) => d.toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });

/**
 * The member's inbox (design/communities.md §4.4, G3c): what happened, newest
 * first, unread ones marked. Opening the page is reading it: everything is
 * marked read after it rendered, so the bell count drops on the next page.
 */
export default async function NotificationsPage() {
  const inbox = await myNotifications(admin, 100);
  if (!inbox) redirect("/account/login?next=/account/notifications");
  if (inbox.unread > 0) await markNotificationsRead(admin);
  return (
    <article className="cg-page cg-narrow">
      <p>
        <Link href="/account" className="cg-muted">
          ← Mijn account
        </Link>
      </p>
      <h1>Mededelingen</h1>
      {inbox.items.length === 0 ? (
        <p className="cg-muted">Nog niets te melden. Je hoort het hier als iemand reageert op je werk of je community iets nieuws heeft.</p>
      ) : (
        <ul className="cg-results">
          {inbox.items.map((n) => (
            <li key={n.id} className={n.readAt ? "" : "font-semibold"}>
              <Link href={n.href}>{n.title}</Link>
              <span className="cg-muted">
                {" "}
                · {when(n.createdAt)}
                {!n.readAt && " · nieuw"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

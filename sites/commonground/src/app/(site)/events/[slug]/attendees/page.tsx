import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EventAttendeesScreen } from "@imprint/plugin-events";
import { admin } from "@/lib/admin";

export const metadata: Metadata = { title: "Aanmeldingen", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Who signed up for an event (plugin-events): for the site's staff and the managers of the event's group. */
export default async function AttendeesPage({ params }: Props) {
  const { slug } = await params;
  const screen = await EventAttendeesScreen({ admin, slug });
  if (!screen) {
    if (!(await admin.auth.getSession())) redirect(`/account/login?next=${encodeURIComponent(`/events/${slug}/attendees`)}`);
    notFound();
  }
  return <div className="cg-page">{screen}</div>;
}

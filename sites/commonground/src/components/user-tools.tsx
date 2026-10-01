"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Pencil } from "lucide-react";

/**
 * The signed-in part of the chrome. Public pages are prerendered, so who is
 * looking is asked in the browser (/api/me) and never baked into the HTML.
 * Signed in: notifications and the round avatar (initials until members have a
 * photo); may edit: the floating pencil to the studio. Not signed in: "Inloggen".
 */

type Me = { name: string; role: string; canEdit: boolean; unread: number } | null;

function useMe(): Me | undefined {
  const [me, setMe] = useState<Me | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: Me) => live && setMe(body))
      .catch(() => live && setMe(null));
    return () => {
      live = false;
    };
  }, []);
  return me;
}

const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export function UserTools() {
  const me = useMe();
  if (me === undefined) return <span className="cg-avatar is-pending" aria-hidden />;
  if (!me) {
    return (
      <Link href="/account/login" className="cg-login">
        Inloggen
      </Link>
    );
  }
  return (
    <>
      <Link href="/account/notifications" className="cg-icon-button relative" title="Mededelingen" aria-label={me.unread > 0 ? `Mededelingen, ${me.unread} nieuw` : "Mededelingen"}>
        <Bell size={22} aria-hidden />
        {me.unread > 0 && <span className="cg-badge-dot">{me.unread > 9 ? "9+" : me.unread}</span>}
      </Link>
      <Link href="/account" className="cg-avatar" title={me.name} aria-label={`Ingelogd als ${me.name}`}>
        {initials(me.name)}
        <span className="cg-online" aria-hidden />
      </Link>
      {me.canEdit && <EditButton />}
    </>
  );
}

/** Round button bottom right: edit this page in the studio. */
function EditButton() {
  const path = usePathname();
  const slug = path.replace(/^\/+|\/+$/g, "") || "home";
  if (slug === "search" || slug.startsWith("groups/") || slug.startsWith("terms/") || slug === "groups" || slug.startsWith("account") || slug.startsWith("events/") || slug === "events" || slug === "blog" || slug.startsWith("blog/")) return null;
  // A members-only page edits as the page it is.
  const target = slug.startsWith("members/") ? slug.slice(8) : slug;
  return (
    <Link href={`/admin/page/edit/${target}`} className="cg-edit" aria-label="Deze pagina bewerken" title="Deze pagina bewerken">
      <Pencil size={22} aria-hidden />
    </Link>
  );
}

import Link from "next/link";
import type { AdminContext, PluginCall } from "@imprint/runtime-admin";
import { members } from "./actions";
import { getGroup } from "./groups";
import { groupHref } from "./href";
import { ManageMembers } from "./manage-members";

/**
 * `/groups/<slug>/manage`: the group's own management, for its owner and
 * managers (and the site's staff) — requests to approve, members and their
 * roles, invitation links. A dynamic page: the site renders it per request.
 * Returns null when the visitor may not manage this group.
 */
export async function GroupManageScreen({ admin, slug, call }: { admin: AdminContext; slug: string; call: PluginCall }) {
  const store = admin.imprint.writableStore;
  const group = store ? await getGroup(store, slug) : null;
  const list = group ? await members(admin, slug) : null;
  if (!group || !list) return null;
  return (
    <article>
      <Link href={groupHref(slug)} className="text-sm text-muted hover:underline">
        ← {group.title}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Beheer: {group.title}</h1>
      <p className="mt-2 text-muted">
        {group.membershipOnRequest ? "Lid worden gaat op aanvraag: keur aanvragen hieronder goed." : "Iedereen met een bevestigd e-mailadres kan lid worden."}
      </p>
      <ManageMembers slug={slug} call={call} initial={list} />
    </article>
  );
}

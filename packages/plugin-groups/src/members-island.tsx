"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { MyGroup, RosterEntry } from "./actions";
import { groupHref } from "./href";

/**
 * What a member sees of membership (design/communities.md §4.1, G2b), asked
 * in the browser so the pages stay prerendered: who else is in the group
 * (names and roles, no addresses — for members only, the PDP decides), and
 * on the overview the communities they are in themselves.
 */

const ROLE: Record<string, string> = { owner: "eigenaar", manager: "beheerder", member: "" };

function useOnMembership(refresh: () => Promise<void>) {
  useEffect(() => {
    const run = () => void refresh().catch(() => undefined);
    run();
    window.addEventListener("imprint:membership", run);
    return () => window.removeEventListener("imprint:membership", run);
  }, [refresh]);
}

/** On a group's page: the members, for members. */
export function GroupMembers({ slug, call }: { slug: string; call?: PluginCall }) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    if (call) setRoster((await call("groups", "roster", slug)) as RosterEntry[] | null);
  }, [call, slug]);
  useOnMembership(refresh);

  if (!roster || roster.length === 0) return null;
  const shown = open ? roster : roster.slice(0, 24);
  return (
    <section className="mt-10 max-w-3xl" aria-label="Leden">
      <h2 className="text-xl font-semibold">
        Leden <span className="font-normal text-muted">({roster.length})</span>
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {shown.map((m) => (
          <li key={m.name} className="rounded-full border border-line px-3 py-0.5 text-sm">
            {m.name}
            {ROLE[m.role] && <span className="text-muted"> · {ROLE[m.role]}</span>}
          </li>
        ))}
      </ul>
      {roster.length > shown.length && (
        <button type="button" className="mt-2 text-sm text-muted underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
          toon alle {roster.length}
        </button>
      )}
    </section>
  );
}

/** On the overview: the visitor's own communities first. */
export function MyGroups({ call }: { call?: PluginCall }) {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const refresh = useCallback(async () => {
    if (call) setGroups((await call("groups", "myGroups")) as MyGroup[] | null);
  }, [call]);
  useOnMembership(refresh);

  if (!groups || groups.length === 0) return null;
  return (
    <section className="mb-8 rounded-md border border-line bg-surface p-4" aria-label="Jouw communities">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Jouw communities</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {groups.map((g) => (
          <li key={g.slug}>
            <Link href={groupHref(g.slug)} className="inline-block rounded-full border border-line bg-background px-3 py-1 text-sm hover:border-accent">
              {g.title}
              {ROLE[g.role] && <span className="text-muted"> · {ROLE[g.role]}</span>}
              {g.status === "requested" && <span className="text-muted"> · aangevraagd</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

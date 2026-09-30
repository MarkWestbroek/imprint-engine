"use client";

import { useState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { MembershipRole } from "@imprint/content-core/user-store";
import type { ActionResult, MemberList } from "./actions";

const ROLE_LABEL: Record<MembershipRole, string> = { owner: "eigenaar", manager: "beheerder", member: "lid" };

/** The lists on the management page; every change goes through the plugin's actions and reloads the list. */
export function ManageMembers({ slug, call, initial }: { slug: string; call: PluginCall; initial: MemberList }) {
  const [list, setList] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<MembershipRole>("member");

  const run = async (action: string, ...args: unknown[]) => {
    setError(null);
    const result = (await call("groups", action, slug, ...args)) as ActionResult & { url?: string };
    if (!result.ok) setError(result.error ?? "Dat lukte niet.");
    if (result.url) setInviteUrl(result.url);
    const fresh = (await call("groups", "members", slug)) as MemberList | null;
    if (fresh) setList(fresh);
  };

  const requested = list.members.filter((m) => m.status === "requested");
  const active = list.members.filter((m) => m.status === "active");
  const btn = "rounded-md border border-line px-3 py-1 text-sm hover:bg-surface";
  const primary = "rounded-md bg-accent px-3 py-1 text-sm font-semibold text-background hover:bg-accent-strong";

  return (
    <div className="mt-8 space-y-10">
      {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <section>
        <h2 className="text-xl font-semibold">Aanvragen ({requested.length})</h2>
        {requested.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Geen open aanvragen.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-md border border-line">
            {requested.map((m) => (
              <li key={m.userName} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-semibold">{m.userName}</span>
                  <span className="ml-2 text-sm text-muted">{new Date(m.createdAt).toLocaleDateString("nl-NL")}</span>
                </span>
                <span className="flex gap-2">
                  <button type="button" className={primary} onClick={() => run("decide", m.userName, "approve")}>
                    Goedkeuren
                  </button>
                  <button type="button" className={btn} onClick={() => run("decide", m.userName, "reject")}>
                    Afwijzen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Leden ({active.length})</h2>
        <ul className="mt-3 divide-y divide-line rounded-md border border-line">
          {active.map((m) => (
            <li key={m.userName} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold">{m.userName}</span>
              <span className="flex items-center gap-2">
                <select
                  aria-label={`Rol van ${m.userName}`}
                  value={m.role}
                  onChange={(e) => run("setRole", m.userName, e.target.value)}
                  className="rounded-md border border-line bg-background px-2 py-1 text-sm"
                >
                  {(Object.keys(ROLE_LABEL) as MembershipRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                {m.role !== "owner" && (
                  <button type="button" className={btn} onClick={() => run("decide", m.userName, "remove")}>
                    Verwijderen
                  </button>
                )}
              </span>
            </li>
          ))}
          {active.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nog geen leden.</li>}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Uitnodigingslinks</h2>
        <p className="mt-1 text-sm text-muted">
          Wie de link opent en inlogt, is meteen lid (of beheerder) — zonder goedkeuring. Een link is 30 dagen geldig.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="Rol voor de uitnodiging"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
            className="rounded-md border border-line bg-background px-2 py-1 text-sm"
          >
            <option value="member">lid</option>
            <option value="manager">beheerder</option>
          </select>
          <button type="button" className={primary} onClick={() => run("createInvite", inviteRole)}>
            Nieuwe link maken
          </button>
        </div>
        {inviteUrl && (
          <p className="mt-3 rounded-md border border-line bg-surface px-3 py-2 text-sm">
            Deel deze link (hij wordt maar één keer getoond): <code className="break-all">{inviteUrl}</code>
          </p>
        )}
        {list.invites.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-md border border-line text-sm">
            {list.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                <span>
                  {ROLE_LABEL[i.role]} · gemaakt {new Date(i.createdAt).toLocaleDateString("nl-NL")} door {i.createdBy} · {i.uses}× gebruikt ·{" "}
                  {i.active ? `geldig tot ${new Date(i.expiresAt).toLocaleDateString("nl-NL")}` : "verlopen"}
                </span>
                {i.active && (
                  <button type="button" className={btn} onClick={() => run("revokeInvite", i.id)}>
                    Intrekken
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import type { TokenAction } from "./types";

/**
 * Personal API tokens on the account screen (design/beeldbibliotheek.md
 * §12.4): a client such as the patch editor uses one to put files in the media
 * library. A new token is shown once; afterwards only its first characters.
 */

export type TokenRow = {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
};

const INPUT = "mt-1 w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none";
const LABEL = "block text-xs font-medium uppercase tracking-wide text-muted";
const SCOPE_LABELS: Record<string, string> = { "media:upload": "upload media", "media:read": "list media" };

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

export function TokenManager({
  tokens,
  scopes,
  create,
  revoke,
}: {
  tokens: TokenRow[];
  scopes: readonly string[];
  create: TokenAction;
  revoke: TokenAction;
}) {
  const [created, createAction, creating] = useActionState(create, null);
  const [revoked, revokeAction] = useActionState(revoke, null);
  const [copied, setCopied] = useState(false);

  return (
    <section className="max-w-3xl space-y-4 rounded-xl border border-line bg-surface p-5" aria-label="API tokens">
      <div>
        <h2 className="text-sm font-semibold">API tokens</h2>
        <p className="mt-1 text-xs text-muted">
          For programs outside the admin, such as the patch editor. A token acts as you, limited to what you tick
          below. Treat it like a password.
        </p>
      </div>

      {created?.ok && created.token && (
        <div role="status" className="rounded-lg border border-accent bg-accent/10 p-3 text-sm">
          <p className="font-semibold">Your new token — copy it now, it is not shown again:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background px-2 py-1 font-mono text-xs" data-testid="new-token">
              {created.token}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(created.token!).then(() => setCopied(true));
              }}
              className="rounded-md border border-line px-2 py-1 text-xs hover:border-accent"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {(created?.error || revoked?.error) && <p className="text-sm text-red-400">{created?.error ?? revoked?.error}</p>}

      {tokens.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1.5 pr-3">Name</th>
              <th className="py-1.5 pr-3">Token</th>
              <th className="py-1.5 pr-3">May</th>
              <th className="py-1.5 pr-3">Expires</th>
              <th className="py-1.5 pr-3">Last used</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className={`border-b border-line ${t.active ? "" : "text-muted line-through"}`}>
                <td className="py-1.5 pr-3">{t.name}</td>
                <td className="py-1.5 pr-3 font-mono text-xs">{t.prefix}…</td>
                <td className="py-1.5 pr-3 text-xs">{t.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(", ")}</td>
                <td className="py-1.5 pr-3 text-xs">{t.expiresAt ? day(t.expiresAt) : "never"}</td>
                <td className="py-1.5 pr-3 text-xs">{day(t.lastUsedAt)}</td>
                <td className="py-1.5 text-right">
                  {t.active && (
                    <form action={revokeAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="text-xs text-red-400 hover:underline" aria-label={`Revoke ${t.name}`}>
                        Revoke
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={createAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="block">
          <span className={LABEL}>New token for</span>
          <input name="name" required maxLength={64} placeholder="e.g. patch editor" className={INPUT} />
        </label>
        <fieldset className="flex gap-3 text-sm">
          <legend className="sr-only">What the token may do</legend>
          {scopes.map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input type="checkbox" name="scopes" value={s} defaultChecked /> {SCOPE_LABELS[s] ?? s}
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className={LABEL}>Valid</span>
          <select name="days" defaultValue="365" className={INPUT}>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="0">no end</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create token"}
        </button>
      </form>
    </section>
  );
}

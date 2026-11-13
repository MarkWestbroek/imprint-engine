"use client";

import { useActionState, useState } from "react";
import { accountTeksten } from "@/lib/account-teksten";

export type ContactState = { ok: boolean; error?: string } | null;

const veld = "mt-1 w-full rounded-md border border-line bg-background px-3 py-2";

/** The contact form; the action says what went wrong in the language of the site. */
export function ContactForm({ ui, action }: { ui: string; action: (prev: ContactState, formData: FormData) => Promise<ContactState> }) {
  const t = accountTeksten(ui).kontakt;
  const [state, submit, pending] = useActionState(action, null);
  const [nieuw, setNieuw] = useState(0);
  if (state?.ok && nieuw === 0) {
    return (
      <div className="space-y-3 rounded-md border border-line bg-surface p-4">
        <p>{t.verstuurd}</p>
        <button type="button" className="underline underline-offset-4" onClick={() => setNieuw(1)}>
          {t.nogEen}
        </button>
      </div>
    );
  }
  return (
    <form key={nieuw} action={(fd) => { setNieuw(0); submit(fd); }} className="space-y-4">
      <input type="hidden" name="ui" value={ui} />
      <label className="block">
        {t.naam}
        <input name="name" autoComplete="name" maxLength={100} className={veld} />
      </label>
      <label className="block">
        {t.email}
        <input name="email" type="email" autoComplete="email" className={veld} />
        <small className="text-muted">{t.emailHint}</small>
      </label>
      <label className="block">
        {t.bericht}
        <textarea name="message" required rows={7} maxLength={5000} className={veld} />
      </label>
      {/* The honeypot: hidden for people, filled in by bots. */}
      <label className="hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {state && !state.ok && <p className="font-semibold">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 font-semibold text-background hover:bg-accent-strong disabled:opacity-60">
        {pending ? accountTeksten(ui).bezig : t.verstuur}
      </button>
    </form>
  );
}

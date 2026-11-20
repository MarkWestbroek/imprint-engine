"use client";

import { useActionState, useState } from "react";
import { CONTACT_TEKSTEN, type ContactTaal } from "@/lib/contact-teksten";

export type ContactState = { ok: boolean; error?: string } | null;
export type ContactAction = (prev: ContactState, formData: FormData) => Promise<ContactState>;

const field = "mt-1 w-full rounded-md border border-line bg-background px-3 py-2 text-foreground";

/**
 * The contact form of the widget `contact`: name, address (for an answer) and
 * a message, in the widget's language. The owner's address is never in the
 * page; the server action mails it on. `page` tells the owner which page the
 * message came from.
 */
export function ContactForm({ action, page, taal }: { action: ContactAction; page: string; taal: ContactTaal }) {
  const t = CONTACT_TEKSTEN[taal];
  const [state, submit, pending] = useActionState(action, null);
  const [again, setAgain] = useState(0);
  if (state?.ok && again === 0) {
    return (
      <div className="space-y-3 rounded-md border border-line bg-background p-4" role="status">
        <p>{t.verstuurd}</p>
        <button type="button" className="underline underline-offset-4" onClick={() => setAgain(1)}>
          {t.nogEen}
        </button>
      </div>
    );
  }
  return (
    <form
      key={again}
      action={(formData) => {
        setAgain(0);
        submit(formData);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="page" value={page} />
      <input type="hidden" name="taal" value={taal} />
      <label className="block">
        {t.naam}
        <input name="name" autoComplete="name" maxLength={100} className={field} />
      </label>
      <label className="block">
        {t.email}
        <input name="email" type="email" autoComplete="email" maxLength={200} className={field} />
        <small className="text-muted">{t.emailHint}</small>
      </label>
      <label className="block">
        {t.bericht}
        <textarea name="message" required rows={6} maxLength={5000} className={field} />
      </label>
      {/* The honeypot: hidden for people, filled in by bots. */}
      <label className="hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {state && !state.ok ? (
        <p className="font-semibold" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 font-semibold text-background hover:bg-accent-strong disabled:opacity-60">
        {pending ? t.bezig : t.verstuur}
      </button>
    </form>
  );
}

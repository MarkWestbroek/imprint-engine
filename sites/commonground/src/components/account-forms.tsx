"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ActionResult } from "@/app/(site)/account/actions";

type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function RegisterForm({ action }: { action: FormAction }) {
  const [state, submit, pending] = useActionState(action, null);
  if (state?.ok) {
    return (
      <div className="cg-notice">
        <p>
          <strong>Bijna klaar.</strong> We hebben je een e-mail gestuurd met een link om je adres te bevestigen. Daarna kun je
          inloggen en lid worden van communities.
        </p>
        {state.verifyUrl && (
          <p className="cg-muted">
            (Ontwikkelomgeving zonder mail: <a href={state.verifyUrl}>bevestig hier</a>.)
          </p>
        )}
      </div>
    );
  }
  return (
    <form action={submit} className="cg-form">
      <label>
        Gebruikersnaam
        <input name="name" required autoComplete="username" pattern="[A-Za-z0-9][A-Za-z0-9._\-]{1,63}" />
        <small>Letters, cijfers, punt, streepje of underscore; dit is je naam op de site.</small>
      </label>
      <label>
        E-mailadres
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Wachtwoord
        <input name="password" type="password" required minLength={12} autoComplete="new-password" />
        <small>Minstens 12 tekens.</small>
      </label>
      {/* The honeypot: hidden for people, filled in by bots. */}
      <label className="cg-hp" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {state?.error && <p className="cg-error">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Bezig…" : "Account maken"}
      </button>
      <p className="cg-muted">
        Al een account? <Link href="/account/login">Inloggen</Link>
      </p>
    </form>
  );
}

export function LoginForm({ action, next }: { action: FormAction; next: string }) {
  const [state, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="cg-form">
      <input type="hidden" name="next" value={next} />
      <label>
        Gebruikersnaam of e-mailadres
        <input name="identifier" required autoComplete="username" />
      </label>
      <label>
        Wachtwoord
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      {state?.error && <p className="cg-error">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Bezig…" : "Inloggen"}
      </button>
      <p className="cg-muted">
        Nog geen account? <Link href="/account/register">Registreren</Link>
      </p>
    </form>
  );
}

export function ResendButton({ action }: { action: () => Promise<ActionResult> }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="cg-inline">
      <button type="button" className="cg-link" onClick={async () => setResult(await action())}>
        Bevestigingsmail opnieuw sturen
      </button>
      {result && (
        <span className={result.ok ? "cg-muted" : "cg-error"}>
          {result.ok ? "Verstuurd." : result.error}
          {result.verifyUrl && (
            <>
              {" "}
              <a href={result.verifyUrl}>(bevestig hier)</a>
            </>
          )}
        </span>
      )}
    </span>
  );
}

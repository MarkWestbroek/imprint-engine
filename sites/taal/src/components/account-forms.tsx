"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { NewPasswordFields, PasswordInput } from "@imprint/runtime-admin/password-fields";
import { vergeetKoppeling, vergeetLokaal } from "@imprint/plugin-taal/opslag";
import { accountPad, accountTeksten } from "@/lib/account-teksten";

/**
 * The forms of the account pages. Each gets its server action as a prop and
 * the interface language as `ui`; the texts come from lib/account-teksten.
 * Errors arrive from the action already in the language of the site.
 */
export type ActionResult = { ok: boolean; error?: string; verifyUrl?: string };
type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const veld = "mt-1 w-full rounded-md border border-line bg-background px-3 py-2";
const knop = "rounded-md bg-accent px-4 py-2 font-semibold text-background hover:bg-accent-strong disabled:opacity-60";
const fout = "font-semibold text-foreground";
const melding = "rounded-md border border-line bg-surface p-4";
const link = "underline underline-offset-4";

/** React resets a form after its action ran; this keeps what was typed across an error. */
function useKept(initial = "") {
  const [value, setValue] = useState(initial);
  return { value, onChange: (e: { target: { value: string } }) => setValue(e.target.value) };
}

function TestLink({ ui, url }: { ui: string; url?: string }) {
  if (!url) return null;
  return (
    <p className="mt-2 text-sm text-muted">
      {accountTeksten(ui).zonderMail} <a className={link} href={url}>{url}</a>
    </p>
  );
}

export function RegisterForm({ ui, action }: { ui: string; action: FormAction }) {
  const t = accountTeksten(ui);
  const [state, submit, pending] = useActionState(action, null);
  const name = useKept();
  const email = useKept();
  if (state?.ok) {
    return (
      <div className={melding}>
        <p>{t.bijnaKlaar}</p>
        <TestLink ui={ui} url={state.verifyUrl} />
        <p className="mt-3">
          <Link className={link} href={accountPad(ui, "login")}>
            {t.inloggen}
          </Link>
        </p>
      </div>
    );
  }
  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="ui" value={ui} />
      <label className="block">
        {t.naam}
        <input name="name" required autoComplete="username" pattern="[A-Za-z0-9][A-Za-z0-9._\-]{1,63}" className={veld} {...name} />
        <small className="text-muted">{t.naamHint}</small>
      </label>
      <label className="block">
        {t.email}
        <input name="email" type="email" required autoComplete="email" className={veld} {...email} />
      </label>
      <NewPasswordFields
        label={t.wachtwoord}
        confirmLabel={t.herhaal}
        minLength={12}
        hint={t.wachtwoordHint}
        mismatchText={t.nietGelijk}
        eyeLabels={t.oog}
        labelClassName="block"
        inputClassName={veld}
        hintClassName="text-muted"
        errorClassName={fout}
      />
      {/* The honeypot: hidden for people, filled in by bots. */}
      <label className="hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {state?.error && <p className={fout}>{state.error}</p>}
      <button type="submit" disabled={pending} className={knop}>
        {pending ? t.bezig : t.maakAccount}
      </button>
      <p className="text-sm text-muted">
        {t.alAccount}{" "}
        <Link className={link} href={accountPad(ui, "login")}>
          {t.inloggen}
        </Link>
      </p>
    </form>
  );
}

export function LoginForm({ ui, action, next }: { ui: string; action: FormAction; next: string }) {
  const t = accountTeksten(ui);
  const [state, submit, pending] = useActionState(action, null);
  const identifier = useKept();
  return (
    // Whoever signs in is someone else to the lessons: they ask the server again on the next page.
    <form action={submit} onSubmit={vergeetKoppeling} className="space-y-4">
      <input type="hidden" name="ui" value={ui} />
      <input type="hidden" name="next" value={next} />
      <label className="block">
        {t.naamOfEmail}
        <input name="identifier" required autoComplete="username" className={veld} {...identifier} />
      </label>
      <label className="block">
        {t.wachtwoord}
        <PasswordInput name="password" required autoComplete="current-password" className={veld} eyeLabels={t.oog} />
      </label>
      {state?.error && <p className={fout}>{state.error}</p>}
      <button type="submit" disabled={pending} className={knop}>
        {pending ? t.bezig : t.inloggen}
      </button>
      <p className="text-sm text-muted">
        {t.nogGeenAccount}{" "}
        <Link className={link} href={accountPad(ui, "register")}>
          {t.registreren}
        </Link>{" "}
        ·{" "}
        <Link className={link} href={accountPad(ui, "forgot")}>
          {t.wachtwoordVergeten}
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm({ ui, action }: { ui: string; action: FormAction }) {
  const t = accountTeksten(ui);
  const [state, submit, pending] = useActionState(action, null);
  const email = useKept();
  if (state?.ok) {
    return (
      <div className={melding}>
        <p>{t.linkVerstuurd}</p>
        <TestLink ui={ui} url={state.verifyUrl} />
      </div>
    );
  }
  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="ui" value={ui} />
      <label className="block">
        {t.email}
        <input name="email" type="email" required autoComplete="email" className={veld} {...email} />
      </label>
      {state?.error && <p className={fout}>{state.error}</p>}
      <button type="submit" disabled={pending} className={knop}>
        {pending ? t.bezig : t.stuurLink}
      </button>
    </form>
  );
}

export function ResetForm({ ui, action, token }: { ui: string; action: FormAction; token: string }) {
  const t = accountTeksten(ui);
  const [state, submit, pending] = useActionState(action, null);
  if (state?.ok) {
    return (
      <div className={melding}>
        <p>
          {t.gewijzigd}{" "}
          <Link className={link} href={accountPad(ui, "login")}>
            {t.inloggen}
          </Link>
        </p>
      </div>
    );
  }
  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="ui" value={ui} />
      <input type="hidden" name="token" value={token} />
      <NewPasswordFields
        label={t.nieuwWachtwoord}
        confirmLabel={t.herhaal}
        minLength={12}
        hint={t.wachtwoordHint}
        mismatchText={t.nietGelijk}
        eyeLabels={t.oog}
        labelClassName="block"
        inputClassName={veld}
        hintClassName="text-muted"
        errorClassName={fout}
      />
      {state?.error && (
        <p className={fout}>
          {state.error}{" "}
          <Link className={link} href={accountPad(ui, "forgot")}>
            {t.nieuweLink}
          </Link>
        </p>
      )}
      <button type="submit" disabled={pending} className={knop}>
        {pending ? t.bezig : t.opslaan}
      </button>
    </form>
  );
}

export function ResendButton({ ui, action }: { ui: string; action: (ui: string) => Promise<ActionResult> }) {
  const t = accountTeksten(ui);
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span>
      <button type="button" className={link} onClick={async () => setResult(await action(ui))}>
        {t.opnieuwSturen}
      </button>
      {result && <span className="ml-2 text-muted">{result.ok ? t.verstuurd : result.error}</span>}
      {result?.verifyUrl && <TestLink ui={ui} url={result.verifyUrl} />}
    </span>
  );
}

/** Signing out also empties what this browser kept, so the next learner on it starts clean. */
export function LogoutButton({ ui, action }: { ui: string; action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} onSubmit={vergeetLokaal}>
      <input type="hidden" name="ui" value={ui} />
      <button type="submit" className="rounded-md border border-line px-4 py-2 hover:border-accent">
        {accountTeksten(ui).uitloggen}
      </button>
    </form>
  );
}

/** After the account is gone (the action redirects here): what this browser kept goes too. */
export function Vergeet() {
  useEffect(() => vergeetLokaal(), []);
  return null;
}

export function DeleteForm({ ui, action }: { ui: string; action: FormAction }) {
  const t = accountTeksten(ui);
  const [state, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="ui" value={ui} />
      <p className="text-muted">{t.verwijderUitleg}</p>
      <label className="block">
        {t.wachtwoord}
        <PasswordInput name="password" required autoComplete="current-password" className={veld} eyeLabels={t.oog} />
      </label>
      {state?.error && <p className={fout}>{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-md border border-line px-4 py-2 font-semibold hover:border-accent disabled:opacity-60">
        {pending ? t.bezig : t.verwijderKnop}
      </button>
    </form>
  );
}

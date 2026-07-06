"use client";

import { useActionState } from "react";
import { loginAction, type ActionResult } from "@/app/admin/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    loginAction,
    null
  );

  return (
    <form
      action={formAction}
      className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6"
    >
      <h1 className="text-lg font-semibold">
        <span className="text-accent">Imprint</span> admin
      </h1>
      <label className="block">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          username
        </span>
        <input
          name="name"
          autoComplete="username"
          className="mt-1 w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

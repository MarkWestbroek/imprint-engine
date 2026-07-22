"use client";

import { useActionState } from "react";
import { createWikiAction } from "@/app/admin/wiki/actions";
import type { ActionResult } from "@/app/admin/actions";

/** Mini-formulier op het wiki-overzicht; de slug volgt uit de titel. */
export function NewWikiForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createWikiAction,
    null
  );
  return (
    <form action={formAction} className="mt-3 space-y-3">
      <label className="block">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          Titel
        </span>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          placeholder="bijv. Help, of Deepdive in Cortex"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">
          Taal
        </span>
        <select
          name="lang"
          defaultValue="en"
          className="mt-1 w-32 rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        >
          <option value="en">en</option>
          <option value="nl">nl</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-40"
      >
        {pending ? "Bezig…" : "Maak wiki"}
      </button>
      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

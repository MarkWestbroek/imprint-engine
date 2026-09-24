"use client";

import { useActionState } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import type { ActionResult } from "./actions";

const input =
  "w-full rounded-md border border-line bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none";

export function NewPlanningForm({ products, call }: { products: string[]; call: PluginCall }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    (prev, formData) => call("planning", "createPlanning", prev, formData) as Promise<ActionResult>,
    null
  );
  return (
    <form action={action} className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-muted">slug</span>
          <input name="slug" required placeholder="roadmap" className={`mt-1 ${input}`} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">name</span>
          <input name="name" required placeholder="Roadmap" className={`mt-1 ${input}`} />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-muted">product (optional)</span>
        <select name="product" className={`mt-1 ${input}`} defaultValue="">
          <option value="">—</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
      >
        Create board
      </button>
    </form>
  );
}

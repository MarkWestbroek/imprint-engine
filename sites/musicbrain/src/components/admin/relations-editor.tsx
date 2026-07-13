"use client";

import { useActionState, useState } from "react";
import type { RelationRule } from "@imprint/content-core";
import { saveRelationsAction, type ActionResult } from "@/app/admin/actions";

/**
 * Beheerscherm for referential integrity: which field of which content type
 * references which other type, and whether a missing target blocks the write.
 * Saved as the "relations" content item; the store reads it on every put.
 */
export function RelationsEditor({
  initialRules,
  types,
  defaults,
}: {
  initialRules: RelationRule[];
  types: string[];
  defaults: RelationRule[];
}) {
  const [rules, setRules] = useState<RelationRule[]>(initialRules);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveRelationsAction,
    null
  );

  const update = (i: number, patch: Partial<RelationRule>) =>
    setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRules(rules.filter((_, idx) => idx !== i));
  const add = () =>
    setRules([
      ...rules,
      { fromType: types[0], field: "", toType: types[0], enforce: true },
    ]);
  const loadDefaults = () => {
    const have = new Set(rules.map((r) => `${r.fromType}|${r.field}|${r.toType}`));
    const missing = defaults.filter(
      (d) => !have.has(`${d.fromType}|${d.field}|${d.toType}`)
    );
    setRules([...rules, ...missing]);
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="rules" value={JSON.stringify(rules)} />

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-3">From type</th>
            <th className="py-2 pr-3">Field (path)</th>
            <th className="py-2 pr-3">→ To type</th>
            <th className="py-2 pr-3">Enforce</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-2 pr-3">
                <TypeSelect
                  value={rule.fromType}
                  types={types}
                  onChange={(v) => update(i, { fromType: v })}
                />
              </td>
              <td className="py-2 pr-3">
                <input
                  className="w-48 rounded-md border border-line bg-background px-2 py-1 font-mono text-xs"
                  placeholder="components[].component"
                  value={rule.field}
                  onChange={(e) => update(i, { field: e.target.value })}
                />
              </td>
              <td className="py-2 pr-3">
                <TypeSelect
                  value={rule.toType}
                  types={types}
                  onChange={(v) => update(i, { toType: v })}
                />
              </td>
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  checked={rule.enforce}
                  onChange={(e) => update(i, { enforce: e.target.checked })}
                />
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded border border-line px-2 py-1 text-xs text-muted hover:border-red-400 hover:text-red-400"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted">
                No relations yet — add one or load the defaults.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          + rule
        </button>
        <button
          type="button"
          onClick={loadDefaults}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-accent"
        >
          Load defaults
        </button>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save relations"}
        </button>
        {state?.ok && <span className="text-sm text-emerald-400">Saved ✓</span>}
        {state?.error && <span className="text-sm text-red-400">{state.error}</span>}
      </div>

      <p className="mt-4 text-xs text-muted">
        Field paths: <code>product</code> (a slug), <code>components[]</code> (array of
        slugs), <code>components[].component</code> (array of objects with a slug field).
        With <em>enforce</em> on, saving an item whose reference points at a
        non-existent target is rejected.
      </p>
    </form>
  );
}

function TypeSelect({
  value,
  types,
  onChange,
}: {
  value: string;
  types: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="rounded-md border border-line bg-background px-2 py-1 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {types.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

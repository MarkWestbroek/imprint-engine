"use client";

import { useState } from "react";
import type { JsonSchema } from "@/lib/admin-schemas";

/**
 * Generic form over a JSON Schema that came from a zod schema (§C: forms
 * generated from the schemas). Scalars become real controls; anything the
 * schema can't express as a scalar renders as a validated JSON box. Actual
 * validation happens server-side against the zod schema on save.
 */

const LONG_TEXT_KEYS = new Set(["body", "markdown", "description", "text"]);

const inputCls =
  "w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm " +
  "focus:border-accent focus:outline-none";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-muted";

export function SchemaForm({
  schema,
  value,
  onChange,
}: {
  schema: JsonSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const keys = Object.keys(properties);

  // Schema too rich for controls (e.g. recursive config): edit it whole.
  if (keys.length === 0) {
    return (
      <JsonField
        label="config (JSON)"
        value={value}
        onApply={(v) => onChange(v as Record<string, unknown>)}
      />
    );
  }

  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <Field
          key={key}
          name={key}
          prop={properties[key]}
          value={value[key]}
          onChange={(v) => set(key, v)}
        />
      ))}
    </div>
  );
}

function Field({
  name,
  prop,
  value,
  onChange,
}: {
  name: string;
  prop: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const type = prop.type as string | undefined;
  const options = (prop.enum ?? (prop.anyOf as JsonSchema[] | undefined)?.flatMap(
    (o) => (o.enum as string[] | undefined) ?? []
  )) as string[] | undefined;

  if (options && options.length > 0) {
    return (
      <label className="block">
        <span className={labelCls}>{name}</span>
        <select
          className={`${inputCls} mt-1`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (type === "string") {
    const long = LONG_TEXT_KEYS.has(name);
    return (
      <label className="block">
        <span className={labelCls}>{name}</span>
        {long ? (
          <textarea
            className={`${inputCls} mt-1 min-h-40 font-mono`}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            className={`${inputCls} mt-1`}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </label>
    );
  }

  if (type === "number" || type === "integer") {
    return (
      <label className="block">
        <span className={labelCls}>{name}</span>
        <input
          type="number"
          className={`${inputCls} mt-1 w-40`}
          value={value === undefined || value === null ? "" : Number(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      </label>
    );
  }

  if (type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={labelCls}>{name}</span>
      </label>
    );
  }

  // Arrays, nested objects, records, recursion: JSON box with validation.
  return <JsonField label={name} value={value} onApply={onChange} />;
}

export function JsonField({
  label,
  value,
  onApply,
}: {
  label: string;
  value: unknown;
  onApply: (v: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    value === undefined ? "" : JSON.stringify(value, null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <label className="block">
      <span className={labelCls}>
        {label} <span className="normal-case text-muted/70">(JSON)</span>
      </span>
      <textarea
        className={`${inputCls} mt-1 min-h-28 font-mono text-xs ${
          error ? "border-red-400" : ""
        }`}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (next.trim() === "") {
            setError(null);
            onApply(undefined);
            return;
          }
          try {
            onApply(JSON.parse(next));
            setError(null);
          } catch {
            setError("Invalid JSON — not applied yet");
          }
        }}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}

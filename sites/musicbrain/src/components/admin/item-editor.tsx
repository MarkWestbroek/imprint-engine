"use client";

import { useActionState, useState } from "react";
import type { ContentType } from "@imprint/content-core";
import { saveItemAction, type ActionResult } from "@/app/admin/actions";
import type { JsonSchema } from "@/lib/admin-schemas";
import { SchemaForm } from "./schema-form";
import { PageComposer, type LayoutValue } from "./page-composer";

/**
 * Editor for one content item. The form fields come from the type's zod
 * schema; pages additionally get a markdown body and the widget composer.
 * Saving asserts a new version in the bitemporal store — nothing is ever
 * overwritten, so "History" on the list page can always roll back.
 */
export function ItemEditor({
  type,
  initialData,
  formSchema,
  isNew,
  validFrom,
  validTo,
  templates,
  widgetSchemas,
}: {
  type: ContentType;
  initialData: Record<string, unknown>;
  formSchema: JsonSchema;
  isNew: boolean;
  validFrom?: string;
  validTo?: string;
  templates?: Record<string, { regions: string[] }>;
  widgetSchemas?: { name: string; label: string; schema: JsonSchema }[];
}) {
  const [data, setData] = useState(initialData);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveItemAction,
    null
  );

  const isPage = type === "page";
  const body = typeof data.body === "string" ? data.body : "";
  const layout = data.layout as LayoutValue | undefined;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <SchemaForm
        schema={formSchema}
        value={data}
        onChange={(next) =>
          // keep body/layout (not part of the meta form) when meta changes
          setData(isPage ? { ...next, body: data.body, layout: data.layout } : next)
        }
      />

      {isPage && (
        <>
          <label className="block">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              body (markdown)
            </span>
            <textarea
              className="mt-1 min-h-48 w-full rounded-md border border-line bg-background px-2.5 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
              value={body}
              onChange={(e) => setData({ ...data, body: e.target.value })}
            />
          </label>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Widget layout
            </h3>
            <PageComposer
              value={layout}
              onChange={(next) => {
                const rest = { ...data };
                delete rest.layout;
                setData(next ? { ...rest, layout: next } : rest);
              }}
              templates={templates ?? { single: { regions: ["main"] } }}
              widgetSchemas={widgetSchemas ?? []}
            />
          </section>
        </>
      )}

      <details className="rounded-xl border border-line p-4 text-sm">
        <summary className="cursor-pointer text-muted">
          Validity (scheduled publishing)
        </summary>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="block">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              valid from
            </span>
            <input
              type="datetime-local"
              name="validFrom"
              defaultValue={validFrom}
              className="mt-1 rounded-md border border-line bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              valid to (empty = forever)
            </span>
            <input
              type="datetime-local"
              name="validTo"
              defaultValue={validTo}
              className="mt-1 rounded-md border border-line bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "Saving…" : isNew ? "Create" : "Save new version"}
        </button>
        {state?.ok && <span className="text-sm text-emerald-400">Saved ✓</span>}
        {state?.error && <span className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}

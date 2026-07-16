"use client";

import { useActionState, useState } from "react";
import type { ContentType } from "@imprint/content-core";
import { saveItemAction, type ActionResult } from "@/app/admin/actions";
import type { JsonSchema } from "@/lib/admin-schemas";
import { SchemaForm } from "./schema-form";
import { MenuEditor, type MenuItemV } from "./menu-editor";
import { ThemeEditor } from "./theme-editor";

/**
 * Form editor for site/product/release/menu items (pages have their own
 * visual studio). Fields come from the type's zod schema; menus get the
 * dedicated menu editor. Saving asserts a new version in the bitemporal
 * store — nothing is ever overwritten, so History can always roll back.
 */
export function ItemEditor({
  type,
  initialData,
  formSchema,
  isNew,
  validFrom,
  validTo,
  pages,
}: {
  type: ContentType;
  initialData: Record<string, unknown>;
  formSchema: JsonSchema;
  isNew: boolean;
  validFrom?: string;
  validTo?: string;
  pages?: { slug: string; title: string }[];
}) {
  const [data, setData] = useState(initialData);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveItemAction,
    null
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <SchemaForm
        schema={formSchema}
        value={data}
        onChange={(next) =>
          // keep fields the meta form doesn't know about (menu items, theme tokens)
          setData({ ...next, items: data.items, colors: data.colors, fonts: data.fonts })
        }
      />

      {type === "theme" && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Design tokens
          </h3>
          <ThemeEditor
            colors={(data.colors as Record<string, string>) ?? {}}
            fonts={(data.fonts as { sans?: string; mono?: string }) ?? {}}
            onColors={(colors) => setData({ ...data, colors })}
            onFonts={(fonts) => setData({ ...data, fonts })}
          />
        </section>
      )}

      {type === "menu" && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Menu items
          </h3>
          <MenuEditor
            items={(data.items as MenuItemV[]) ?? []}
            onChange={(items) => setData({ ...data, items })}
            pages={pages ?? []}
          />
        </section>
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

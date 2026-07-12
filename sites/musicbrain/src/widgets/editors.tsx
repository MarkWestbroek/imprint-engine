"use client";

import type { JsonSchema } from "@/lib/admin-schemas";
import { SchemaForm } from "@/components/admin/schema-form";

/**
 * The editor half of a widget (the viewer half lives in components.tsx):
 *
 *   widget type = configschema (registry.ts)
 *               + viewer  — server component, renders the widget on the site
 *               + editor  — client component, edits the config in the studio
 *
 * Most widgets don't need a hand-written editor: the default renders the
 * form generated from the config schema. Add an entry to `widgetEditors`
 * only when a widget deserves richer editing (e.g. a map picker).
 */

export type WidgetEditorProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** JSON Schema generated from the widget's zod config schema. */
  schema: JsonSchema;
};
export type WidgetEditor = (props: WidgetEditorProps) => React.ReactNode;

/** Custom editors per widget type; absent = schema-generated form. */
export const widgetEditors: Record<string, WidgetEditor> = {};

export function WidgetEditorFor({ type, ...props }: WidgetEditorProps & { type: string }) {
  const Custom = widgetEditors[type];
  if (Custom) return <Custom {...props} />;
  return <SchemaForm schema={props.schema} value={props.config} onChange={props.onChange} />;
}

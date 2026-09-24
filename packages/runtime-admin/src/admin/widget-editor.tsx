"use client";

import type { JsonSchema } from "../forms";
import { SchemaForm } from "./schema-form";

/**
 * The editor half of a widget (the viewer half is a `WidgetViewer`):
 *
 *   widget type = config schema (the site's registry)
 *               + viewer  — server component, renders the widget on the site
 *               + editor  — client component, edits the config in the studio
 *
 * Most widgets need no hand-written editor: the default renders the form
 * generated from the config schema. A site hands the studio one client
 * component (`AdminContext.studio.editor`) that picks a richer editor per
 * type and falls back to this default.
 */
export type WidgetEditorProps = {
  type: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** JSON Schema generated from the widget's zod config schema. */
  schema: JsonSchema;
};
export type WidgetEditor = (props: WidgetEditorProps) => React.ReactNode;

export function DefaultWidgetEditor({ schema, config, onChange }: WidgetEditorProps) {
  return <SchemaForm schema={schema} value={config} onChange={onChange} />;
}

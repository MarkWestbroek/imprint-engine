import { z } from "zod";
import type { ContentTypeDefinition } from "@imprint/content-core";

/**
 * Bridges zod to the admin forms: every editor form is generated from the
 * same schemas that validate the content (§C: "formulier gegenereerd uit
 * zod-schema"). Serializable JSON Schema goes to the client; fields whose
 * shape is too rich for a form control (nested arrays/objects, recursion)
 * get an empty schema `{}`, which the form renders as a validated JSON box.
 *
 * This is the form definition per content type until the Omnium-style
 * `FormulierDefinitie` takes over (design/fase-3 §5); the admin context
 * (`admin.forms`) is where a site or plugin would swap it.
 */

export type JsonSchema = Record<string, unknown>;

function fieldSchema(field: z.ZodType): JsonSchema {
  try {
    // Through JSON: zod hangs a non-enumerable `~standard` (with methods) on the
    // result, and React refuses anything but plain data as a client prop.
    return JSON.parse(JSON.stringify(z.toJSONSchema(field, { io: "input" }))) as JsonSchema;
  } catch {
    return {}; // recursive/unrepresentable → JSON textarea in the form
  }
}

export function objectSchema(schema: z.ZodObject): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    properties[key] = fieldSchema(field as z.ZodType);
  }
  return { type: "object", properties };
}

/**
 * Form schema for one content type: its `formSchema` when the form edits a
 * subset (page meta, a menu's name), else the whole schema; a type whose
 * schema is not an object (a wrapped one) gets no generated fields.
 */
/**
 * An `access` field (`x-imprint.access`, content-core's Access) as a select:
 * the site-wide levels plus `group:<slug>` for every group the site has
 * (design/communities.md §4.2). Without groups the field stays as it is.
 */
export function withAccessOptions(schema: JsonSchema, groups: { slug: string }[]): JsonSchema {
  const props = schema.properties as Record<string, JsonSchema> | undefined;
  if (!props) return schema;
  const out: Record<string, JsonSchema> = {};
  for (const [name, prop] of Object.entries(props)) {
    const hint = prop["x-imprint"] as { access?: boolean } | undefined;
    out[name] = hint?.access
      ? { ...prop, enum: ["public", "restricted", ...groups.map((g) => `group:${g.slug}`)] }
      : prop;
  }
  return { ...schema, properties: out };
}

export function contentFormSchema(def: ContentTypeDefinition): JsonSchema {
  const schema = def.formSchema ?? def.schema;
  return schema instanceof z.ZodObject ? objectSchema(schema) : { type: "object", properties: {} };
}

/** What a widget catalogue entry must offer for its editor form. */
export type WidgetCatalogEntry = {
  name: string;
  label: string;
  version?: string;
  help?: string;
  configSchema: z.ZodType;
};

export type WidgetFormSchema = {
  name: string;
  label: string;
  version?: string;
  help?: string;
  schema: JsonSchema;
};

/** A site's widget catalogue with JSON-Schema configs (+ version/help), for the composer. */
export function widgetFormSchemas(catalog: readonly WidgetCatalogEntry[]): WidgetFormSchema[] {
  return catalog.map((w) => ({
    name: w.name,
    label: w.label,
    version: w.version,
    help: w.help,
    schema: objectSchema(w.configSchema as unknown as z.ZodObject),
  }));
}

import { z } from "zod";
import {
  ComponentSchema,
  PageMetaSchema,
  ProductSchema,
  ReleaseSchema,
  SiteConfigSchema,
  type ContentType,
} from "@imprint/content-core";
import { widgetCatalog } from "@/widgets/registry";

/**
 * Bridges zod to the admin forms: every editor form is generated from the
 * same schemas that validate the content (§C: "formulier gegenereerd uit
 * zod-schema"). Serializable JSON Schema goes to the client; fields whose
 * shape is too rich for a form control (nested arrays/objects, recursion)
 * get an empty schema `{}`, which the form renders as a validated JSON box.
 */

export type JsonSchema = Record<string, unknown>;

function fieldSchema(field: z.ZodType): JsonSchema {
  try {
    return z.toJSONSchema(field, { io: "input" }) as JsonSchema;
  } catch {
    return {}; // recursive/unrepresentable → JSON textarea in the form
  }
}

function objectSchema(schema: z.ZodObject): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    properties[key] = fieldSchema(field as z.ZodType);
  }
  return { type: "object", properties };
}

/** Form schema per content type; pages use meta only (body/layout are special-cased). */
export function contentFormSchema(type: ContentType): JsonSchema {
  switch (type) {
    case "site":
      return objectSchema(SiteConfigSchema);
    case "product":
      return objectSchema(ProductSchema);
    case "component":
      return objectSchema(ComponentSchema);
    case "release":
      return objectSchema(ReleaseSchema);
    case "menu":
      // Only the name; the items get the dedicated MenuEditor, not a form.
      return { type: "object", properties: { name: { type: "string" } } };
    case "page":
      return objectSchema(PageMetaSchema);
  }
}

export type WidgetFormSchema = {
  name: string;
  label: string;
  version?: string;
  help?: string;
  schema: JsonSchema;
};

/** Widget catalogue with JSON-Schema configs (+ version/help), for the composer. */
export function widgetFormSchemas(): WidgetFormSchema[] {
  return widgetCatalog.map((w) => ({
    name: w.name,
    label: w.label,
    version: w.version,
    help: w.help,
    schema: objectSchema(w.configSchema as unknown as z.ZodObject),
  }));
}

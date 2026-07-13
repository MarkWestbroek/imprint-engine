import { z } from "zod";

/**
 * Referential integrity between content types — the generic answer to
 * "product bevat releases, heeft een verzameling componenten". References are
 * still soft (a slug inside the JSON payload), but a set of RelationRules
 * declares which fields point at which type, so the store can check on write
 * that the target exists. The rules are content themselves (edited in
 * /admin/relations), not hardcoded — so relations are configurable per site.
 */

export const RelationRule = z.object({
  /** Content type that holds the reference, e.g. "release". */
  fromType: z.string().min(1),
  /**
   * Path to the reference(s) within the item's data. Supports:
   *   "product"              a scalar slug field
   *   "components[]"         an array of slugs
   *   "components[].component" an array of objects, each with a slug field
   */
  field: z.string().min(1),
  /** Content type the reference points at, e.g. "component". */
  toType: z.string().min(1),
  /** Block the write when a referenced item doesn't exist (else advisory). */
  enforce: z.boolean().default(true),
  /** Human label for the admin screen. */
  label: z.string().optional(),
});
export type RelationRule = z.infer<typeof RelationRule>;

export const RelationsDoc = z.object({
  rules: z.array(RelationRule).default([]),
});
export type RelationsDoc = z.infer<typeof RelationsDoc>;

/** Sensible starting rules for the product/component/release model. */
export const DEFAULT_RELATION_RULES: RelationRule[] = [
  { fromType: "product", field: "components[]", toType: "component", enforce: true, label: "Product → components" },
  { fromType: "component", field: "children[]", toType: "component", enforce: true, label: "Component → sub-components" },
  { fromType: "release", field: "product", toType: "product", enforce: true, label: "Release → product" },
  { fromType: "release", field: "components[].component", toType: "component", enforce: true, label: "Release → components" },
  { fromType: "board-spec", field: "component", toType: "component", enforce: true, label: "Board-spec → component" },
];

/** Collect the slugs a path points at, walking arrays (`[]`) as it goes. */
export function extractRefs(field: string, data: unknown): string[] {
  const out: string[] = [];
  const walk = (segments: string[], value: unknown): void => {
    if (value === null || value === undefined) return;
    if (segments.length === 0) {
      if (typeof value === "string" && value !== "") out.push(value);
      return;
    }
    const [head, ...rest] = segments;
    if (head.endsWith("[]")) {
      const key = head.slice(0, -2);
      const arr = key ? (value as Record<string, unknown>)[key] : value;
      if (Array.isArray(arr)) for (const el of arr) walk(rest, el);
    } else {
      walk(rest, (value as Record<string, unknown>)[head]);
    }
  };
  walk(field.split("."), data);
  return out;
}

export type MissingRef = { field: string; toType: string; slug: string };

/**
 * Return the enforced references in `data` (of type `type`) whose target
 * doesn't exist. `existingSlugs` yields the current slugs of a target type
 * (loaded once per type). Empty result = all good.
 */
export async function validateReferences(
  rules: RelationRule[],
  type: string,
  data: unknown,
  existingSlugs: (toType: string) => Promise<Set<string>>
): Promise<MissingRef[]> {
  const applicable = rules.filter((r) => r.fromType === type && r.enforce);
  if (applicable.length === 0) return [];

  const slugCache = new Map<string, Set<string>>();
  const missing: MissingRef[] = [];
  for (const rule of applicable) {
    let existing = slugCache.get(rule.toType);
    if (!existing) {
      existing = await existingSlugs(rule.toType);
      slugCache.set(rule.toType, existing);
    }
    for (const slug of extractRefs(rule.field, data)) {
      if (!existing.has(slug)) missing.push({ field: rule.field, toType: rule.toType, slug });
    }
  }
  return missing;
}

import Link from "next/link";
import { z } from "zod";
import {
  BoardSpecSchema,
  ComponentSchema,
  DEFAULT_RELATION_RULES,
  MenuSchema,
  PageMetaSchema,
  PlanningSchema,
  PlanningItemSchema,
  ProductSchema,
  ReleaseSchema,
  RelationsDoc,
  SiteConfigSchema,
  ThemeSchema,
  WikiSchema,
  WikiFolderSchema,
  WikiPageSchema,
  type RelationRule,
} from "@imprint/content-core";
import { writableStore } from "@/lib/content";

/**
 * Read-only view of the content model (the types are code — the zod schemas).
 * Same source as GET /api/meta, rendered as tables so you can see every type's
 * fields and the relation rules without reading source.
 */

const TYPES: { type: string; domain: string; schema: z.ZodType }[] = [
  { type: "product", domain: "catalogus", schema: ProductSchema },
  { type: "component", domain: "catalogus", schema: ComponentSchema },
  { type: "board-spec", domain: "catalogus", schema: BoardSpecSchema },
  { type: "release", domain: "catalogus", schema: ReleaseSchema },
  { type: "planning", domain: "planning", schema: PlanningSchema },
  { type: "planning-item", domain: "planning", schema: PlanningItemSchema },
  { type: "wiki", domain: "wiki", schema: WikiSchema },
  { type: "wiki-folder", domain: "wiki", schema: WikiFolderSchema },
  { type: "wiki-page", domain: "wiki", schema: WikiPageSchema },
  { type: "page", domain: "site", schema: PageMetaSchema },
  { type: "menu", domain: "site", schema: MenuSchema },
  { type: "theme", domain: "site", schema: ThemeSchema },
  { type: "site", domain: "site", schema: SiteConfigSchema },
];

type JS = {
  type?: string | string[];
  properties?: Record<string, JS>;
  items?: JS;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  required?: string[];
  anyOf?: JS[];
  description?: string;
};

function unwrap(js: JS): JS {
  if (js.anyOf) return unwrap(js.anyOf.find((v) => v.type !== "null") ?? js.anyOf[0]);
  return js;
}
function typeName(js: JS): string {
  const j = unwrap(js);
  if (j.enum) return "enum";
  const t = Array.isArray(j.type) ? j.type.find((x) => x !== "null") : j.type;
  if (t === "array") return `${typeName(unwrap(j.items ?? {}))}[]`;
  return t ?? "—";
}
function detail(js: JS): string {
  const j = unwrap(js);
  if (j.enum) return j.enum.map(String).join(" · ");
  if (j.format) return j.format;
  if (j.pattern) return j.pattern.length > 32 ? j.pattern.slice(0, 30) + "…" : j.pattern;
  const inner = j.type === "array" ? unwrap(j.items ?? {}) : null;
  if (inner?.type === "object") return "object[]";
  if (inner?.enum) return inner.enum.map(String).join(" · ");
  return "";
}

function fieldsOf(schema: z.ZodType): { name: string; type: string; req: boolean; detail: string }[] {
  let js: JS;
  try {
    js = z.toJSONSchema(schema, { io: "input" }) as JS;
  } catch {
    return [];
  }
  const required = new Set(js.required ?? []);
  return Object.entries(js.properties ?? {}).map(([name, prop]) => ({
    name,
    type: typeName(prop),
    req: required.has(name),
    detail: detail(prop),
  }));
}

export default async function ContentModelPage() {
  let rules: RelationRule[] = DEFAULT_RELATION_RULES;
  if (writableStore) {
    const item = await writableStore.getItem("relations", "relations");
    if (item) {
      const parsed = RelationsDoc.safeParse(item.data);
      if (parsed.success && parsed.data.rules.length) rules = parsed.data.rules;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Content model</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        The content types are defined in code (zod schemas), so this overview is
        read-only. It is the same model published at{" "}
        <a href="/api/meta" target="_blank" className="text-accent hover:underline">/api/meta</a>{" "}
        (JSON Schema) and{" "}
        <a href="/api/meta?format=v3" target="_blank" className="text-accent hover:underline">
          /api/meta?format=v3
        </a>{" "}
        (the V3 metamodel for external form builders).
      </p>

      <div className="mt-8 space-y-6">
        {TYPES.map(({ type, domain, schema }) => (
          <section key={type} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline gap-2">
              <h2 className="font-mono text-lg font-semibold text-accent">{type}</h2>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                {domain}
              </span>
            </div>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1.5 pr-4">Field</th>
                  <th className="py-1.5 pr-4">Type</th>
                  <th className="py-1.5 pr-4">Required</th>
                  <th className="py-1.5">Details</th>
                </tr>
              </thead>
              <tbody>
                {fieldsOf(schema).map((f) => (
                  <tr key={f.name} className="border-b border-line/50">
                    <td className="py-1.5 pr-4 font-mono">{f.name}</td>
                    <td className="py-1.5 pr-4 font-mono text-muted">{f.type}</td>
                    <td className="py-1.5 pr-4 text-muted">{f.req ? "•" : ""}</td>
                    <td className="py-1.5 font-mono text-xs text-muted">{f.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-lg font-semibold">Relations</h2>
        <p className="mt-1 text-sm text-muted">
          Enforced references between types (edit under{" "}
          <Link href="/admin/relations" className="text-accent hover:underline">Relations</Link>).
        </p>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1.5 pr-4">From</th>
              <th className="py-1.5 pr-4">Field</th>
              <th className="py-1.5 pr-4">→ Type</th>
              <th className="py-1.5">Enforced</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i} className="border-b border-line/50">
                <td className="py-1.5 pr-4 font-mono">{r.fromType}</td>
                <td className="py-1.5 pr-4 font-mono text-muted">{r.field}</td>
                <td className="py-1.5 pr-4 font-mono text-accent">{r.toType}</td>
                <td className="py-1.5 text-muted">{r.enforce ? "•" : "advisory"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

import type { z } from "zod";
import type { RelationRule } from "./relations";
import type { ContentType } from "./store";

/**
 * Content types as definitions (design/fase-5 §3.1), the way widgets already
 * work: the core knows no fixed list; core, plugins and site register their
 * types with schema and rules, and everything that used to switch on a type
 * name looks the definition up instead. Two layers:
 *
 *  - `ContentTypeRegistry` — **available**: every definition this instance
 *    knows (core + plugins + site). The store validates writes with it; an
 *    unregistered type cannot be written, but existing rows stay readable.
 *  - `ContentTypeCatalog` — **active**: which of those a site uses
 *    (`imprint.config.ts`). Drives the admin menu, lists and the write API.
 */

export type ContentTypeFlag = "listable" | "editable" | "ingestable" | "overview" | "viewable";

/** Where a type's generic list sits in the admin menu; null = reachable, not listed. */
export type ContentTypeMenu = { group: "content" | "design" | "config"; section?: string };

export interface ContentTypeDefinition {
  /** The type name as stored: "page", "planning-item". */
  name: string;
  /** Validates the whole payload on write (and on typed reads). */
  schema: z.ZodType;
  /** Plural, as shown in menus and on the dashboard. */
  label: string;
  /** listable: generic list and save/delete; editable: generic form and history; ingestable: POST /api/content; overview: dashboard tile; viewable: has a default view. */
  flags?: ContentTypeFlag[];
  menu?: ContentTypeMenu | null;
  /** Grouping for model overviews and the V3 export ("catalogus", "site", …). */
  domain?: string;
  /** Relation rules in which this type holds the reference. */
  relations?: RelationRule[];
  /** Starting data for a new item, so required fields are visible in the form. */
  emptyData?: () => Record<string, unknown>;
  /** The natural key inside the data; default `data.slug`. */
  slugOf?: (data: Record<string, unknown>) => string;
  /** The fields the generic form edits, when that is not the whole schema. */
  formSchema?: z.ZodObject;
}

/** What the admin asks about a type without touching zod: label, capabilities, menu place. */
export type ContentTypeInfo = {
  label: string;
  listable: boolean;
  editable: boolean;
  ingestable: boolean;
  overview: boolean;
  viewable: boolean;
  menu: ContentTypeMenu | null;
};

function infoOf(def: ContentTypeDefinition): ContentTypeInfo {
  const flags = def.flags ?? [];
  return {
    label: def.label,
    listable: flags.includes("listable"),
    editable: flags.includes("editable"),
    ingestable: flags.includes("ingestable"),
    overview: flags.includes("overview"),
    viewable: flags.includes("viewable"),
    menu: def.menu ?? null,
  };
}

/** Every content type an instance knows, in registration order. */
export class ContentTypeRegistry {
  private readonly defs = new Map<string, ContentTypeDefinition>();

  constructor(definitions: readonly ContentTypeDefinition[] = []) {
    for (const def of definitions) {
      if (this.defs.has(def.name)) throw new Error(`Content type "${def.name}" is defined twice`);
      this.defs.set(def.name, def);
    }
  }

  /** Core, then plugins, then site: one registry. */
  static of(...groups: readonly (readonly ContentTypeDefinition[])[]): ContentTypeRegistry {
    return new ContentTypeRegistry(groups.flat());
  }

  names(): ContentType[] {
    return [...this.defs.keys()];
  }

  definitions(): ContentTypeDefinition[] {
    return [...this.defs.values()];
  }

  has(name: string): name is ContentType {
    return this.defs.has(name);
  }

  find(name: string): ContentTypeDefinition | undefined {
    return this.defs.get(name);
  }

  get(name: string): ContentTypeDefinition {
    const def = this.defs.get(name);
    if (!def) throw new Error(`Unknown content type "${name}" (known: ${this.names().join(", ")})`);
    return def;
  }

  info(name: string): ContentTypeInfo {
    return infoOf(this.get(name));
  }

  /** Parse a payload with the type's schema; an unknown type is an error (nothing unregistered gets written). */
  validate(name: string, data: unknown): unknown {
    return this.get(name).schema.parse(data);
  }

  /** The natural key of an item of this type. */
  slugOf(name: string, data: Record<string, unknown>): string {
    const def = this.get(name);
    return def.slugOf ? def.slugOf(data) : String(data.slug ?? "");
  }

  /** Every relation rule the registered types declare — the default rules document. */
  relations(): RelationRule[] {
    return this.definitions().flatMap((def) => def.relations ?? []);
  }
}

/** The types one site has switched on, out of a registry. Default: everything registered. */
export class ContentTypeCatalog {
  private readonly activeTypes: ContentType[];

  constructor(
    readonly registry: ContentTypeRegistry,
    active?: readonly string[]
  ) {
    for (const type of active ?? []) registry.get(type); // fail early on an unknown type
    // Registry order, whatever order the site listed them in.
    const all = registry.names();
    this.activeTypes = active ? all.filter((type) => active.includes(type)) : all;
  }

  /** Active types, optionally only those with a capability. */
  types(flag?: ContentTypeFlag): ContentType[] {
    return flag ? this.activeTypes.filter((type) => this.registry.info(type)[flag]) : [...this.activeTypes];
  }

  /** Is this (untrusted, e.g. from a URL) name an active type — with this capability? */
  has(type: string, flag?: ContentTypeFlag): type is ContentType {
    return (
      this.registry.has(type) &&
      this.activeTypes.includes(type) &&
      (flag === undefined || this.registry.info(type)[flag])
    );
  }

  info(type: string): ContentTypeInfo {
    return this.registry.info(type);
  }

  definition(type: string): ContentTypeDefinition {
    return this.registry.get(type);
  }
}

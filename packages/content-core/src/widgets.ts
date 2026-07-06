import { z } from "zod";

/**
 * Widget model (UML: Page ◆— PageLayout ◇— 0..* Widget, Widget /type → WidgetType).
 *
 * The core deliberately knows no concrete widgets. A site declares its own
 * widget types (name + zod config schema) in a WidgetTypeRegistry and pairs
 * each type with a React component on the rendering side. That keeps widgets
 * "free": a treeview on the left and API content in the middle is just two
 * entries in a page's layout, no engine changes needed.
 */

/** A widget as placed on a page: which type, in which region, with what config. */
export const WidgetPlacementSchema = z.object({
  /** WidgetType name, e.g. "text", "treeview", "api". Resolved via the registry. */
  type: z.string().min(1),
  /** Region of the layout template this widget lands in (e.g. "sidebar", "main"). */
  region: z.string().default("main"),
  /** Type-specific config; validated against the registered config schema. */
  config: z.unknown().default({}),
});
export type WidgetPlacement = z.infer<typeof WidgetPlacementSchema>;

/**
 * PageLayout: a template name (the region arrangement, defined by the site's
 * renderer) plus the widgets placed on it, in order.
 */
export const PageLayoutSchema = z.object({
  template: z.string().default("single"),
  widgets: z.array(WidgetPlacementSchema).default([]),
});
export type PageLayout = z.infer<typeof PageLayoutSchema>;

/** Declaration of one widget type: its name plus the shape of its config. */
export interface WidgetTypeDef<TConfig = unknown> {
  name: string;
  configSchema: z.ZodType<TConfig>;
}

/**
 * Registry of widget types a site supports (UML: WidgetType). The store uses
 * it to validate widget configs on read, so a typo'd or malformed widget
 * breaks the build instead of rendering garbage.
 */
export class WidgetTypeRegistry {
  private readonly types = new Map<string, WidgetTypeDef>();

  register<TConfig>(def: WidgetTypeDef<TConfig>): this {
    if (this.types.has(def.name)) {
      throw new Error(`Widget type "${def.name}" is already registered`);
    }
    this.types.set(def.name, def as WidgetTypeDef);
    return this;
  }

  has(name: string): boolean {
    return this.types.has(name);
  }

  names(): string[] {
    return [...this.types.keys()];
  }

  /** Validate a placement; returns it with a parsed, type-checked config. */
  parse(placement: WidgetPlacement): WidgetPlacement {
    const def = this.types.get(placement.type);
    if (!def) {
      throw new Error(
        `Unknown widget type "${placement.type}" (registered: ${this.names().join(", ")})`
      );
    }
    const result = def.configSchema.safeParse(placement.config);
    if (!result.success) {
      throw new Error(
        `Invalid config for widget "${placement.type}": ${result.error.message}`
      );
    }
    return { ...placement, config: result.data };
  }

  /** Validate a whole layout (all placements) in one go. */
  parseLayout(layout: PageLayout): PageLayout {
    return { ...layout, widgets: layout.widgets.map((w) => this.parse(w)) };
  }
}

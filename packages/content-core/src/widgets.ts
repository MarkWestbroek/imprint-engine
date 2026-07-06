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

/** A widget instance: which type, with what config (UML: Widget /type). */
export const WidgetInstanceSchema = z.object({
  /** WidgetType name, e.g. "text", "treeview", "api". Resolved via the registry. */
  type: z.string().min(1),
  /** Type-specific config; validated against the registered config schema. */
  config: z.unknown().default({}),
});
export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>;

/** Legacy (pre-rows) placement: widget + named region of a template. */
export const WidgetPlacementSchema = WidgetInstanceSchema.extend({
  region: z.string().default("main"),
});
export type WidgetPlacement = z.infer<typeof WidgetPlacementSchema>;

/**
 * A cell ("vak"): a box in a row that holds widgets, stacked vertically.
 * `span` is its relative width in fraction units (a 1|2 row renders as
 * one-third + two-thirds).
 */
export const LayoutCellSchema = z.object({
  span: z.number().int().min(1).max(4).default(1),
  widgets: z.array(WidgetInstanceSchema).default([]),
});
export type LayoutCell = z.infer<typeof LayoutCellSchema>;

export const LayoutRowSchema = z.object({
  cells: z.array(LayoutCellSchema).min(1),
});
export type LayoutRow = z.infer<typeof LayoutRowSchema>;

/**
 * PageLayout: rows of cells, widgets inside cells — free-form, Pleio-style;
 * cells can be added left/right, rows above/below. The legacy shape
 * (template + region-tagged widgets) still parses; sites convert it to rows
 * when rendering/editing, and the composer saves rows.
 */
export const PageLayoutSchema = z.object({
  rows: z.array(LayoutRowSchema).optional(),
  /** Legacy: named template ("single", "sidebar-left", …). */
  template: z.string().optional(),
  /** Legacy: widgets tagged with a template region. */
  widgets: z.array(WidgetPlacementSchema).optional(),
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

  /** Validate a widget instance; returns it with a parsed, type-checked config. */
  parse<T extends WidgetInstance>(widget: T): T {
    const def = this.types.get(widget.type);
    if (!def) {
      throw new Error(
        `Unknown widget type "${widget.type}" (registered: ${this.names().join(", ")})`
      );
    }
    const result = def.configSchema.safeParse(widget.config);
    if (!result.success) {
      throw new Error(
        `Invalid config for widget "${widget.type}": ${result.error.message}`
      );
    }
    return { ...widget, config: result.data };
  }

  /** Validate every widget in a layout (rows and legacy placements) in one go. */
  parseLayout(layout: PageLayout): PageLayout {
    return {
      ...layout,
      rows: layout.rows?.map((row) => ({
        cells: row.cells.map((cell) => ({
          ...cell,
          widgets: cell.widgets.map((w) => this.parse(w)),
        })),
      })),
      widgets: layout.widgets?.map((w) => this.parse(w)),
    };
  }
}

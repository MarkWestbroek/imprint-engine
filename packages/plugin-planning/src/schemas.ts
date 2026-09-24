import { z } from "zod";
import { Access, Locale } from "@imprint/content-core";

/**
 * Planning (UML: a Project's board). A `planning` belongs to a product and
 * declares its phases (the kanban columns). The cards are their own content
 * type — a `planning-item` — because a card has its own owner, its own rich
 * body, and its own lifecycle: moving it to another column is a status change,
 * not a new card. That change is a new bitemporal version, so a board carries
 * the full history of how each item travelled through the phases (and
 * time-travel shows the board as it was on any date).
 */
export const PlanningPhaseSchema = z.object({
  /** Stable key stored on items as `status`. */
  key: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  order: z.number().int().default(0),
});
export type PlanningPhase = z.infer<typeof PlanningPhaseSchema>;

const DEFAULT_PHASES: PlanningPhase[] = [
  { key: "backlog", label: "Backlog", order: 0 },
  { key: "in-progress", label: "In progress", order: 1 },
  { key: "beta", label: "Beta", order: 2 },
  { key: "done", label: "Done", order: 3 },
];

export const PlanningSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  name: z.string().min(1),
  /** Slug of the product this board plans (UML: Project → Product). */
  product: z.string().optional(),
  description: z.string().default(""),
  /** The columns, left to right (by `order`). */
  phases: z.array(PlanningPhaseSchema).default(DEFAULT_PHASES),
  order: z.number().int().default(0),
});
export type Planning = z.infer<typeof PlanningSchema>;

export const PlanningItemSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  title: z.string().min(1),
  /** The board this card lives on. */
  planning: z.string().min(1),
  /** Which phase (a `PlanningPhase.key`). Unknown key = bucketed as "other". */
  status: z.string().default("backlog"),
  /** Owner = a username (soft ref into the users table; not a content type). */
  owner: z.string().default(""),
  /** Rich text (markdown); internal links to other content are just links. */
  body: z.string().default(""),
  /** Optional first-class link to the component being worked on. */
  component: z.string().optional(),
  /** Optional version of that component (e.g. "v2.1"). */
  componentVersion: z.string().optional(),
  /** Sort order within its column. */
  order: z.number().default(0),
});
export type PlanningItem = z.infer<typeof PlanningItemSchema>;

import Link from "next/link";
import { z } from "zod";
import type { ContentType } from "@imprint/content-core";
import { Markdown, WidgetFrame, type WidgetContext } from "@imprint/runtime-admin";
import { bucketInto, groupIntoColumns } from "./planning";
import { PlanningItemSchema, PlanningSchema } from "./schemas";

/** Display a version with a single leading "v" (versions may or may not carry one). */
const displayVersion = (version: string) => "v" + version.replace(/^v/i, "");

/**
 * A configurable board view (Mark's model): a main item groups sub-items into
 * phases (columns), each sub-item carrying a phase field and optionally an
 * owner. Two ways to point it at data:
 *
 *  - **Board mode** — set `planning` to a planning slug. Sub-items are its
 *    planning-items (phase = `status`, owner = `owner`); phases come from the
 *    planning. This is the default (planbord / kaart / gebruiker), editable
 *    with drag & drop in the admin.
 *  - **Generic mode** — set `itemType` to any content type (e.g. "component").
 *    A read-only view: items are grouped by `phaseField` into the `phases`
 *    you configure here. Moving items happens via their own admin/API (e.g.
 *    the project sets `component.phase`).
 */
export const PlanningConfig = z.object({
  title: z.string().optional(),
  // Board mode
  planning: z.string().default(""),
  // Generic mode
  itemType: z.string().optional(),
  titleField: z.string().default("title"),
  phaseField: z.string().default("status"),
  ownerField: z.string().default("owner"),
  /** Field holding a component slug to show as a chip (e.g. "slug" for components). */
  componentField: z.string().optional(),
  /** Columns for generic mode (board mode takes phases from the planning). */
  phases: z.array(z.object({ key: z.string(), label: z.string().min(1) })).default([]),
  /** Optional filter: only items whose `filterField` equals `filterValue`. */
  filterField: z.string().optional(),
  filterValue: z.string().optional(),
});
export type PlanningConfig = z.infer<typeof PlanningConfig>;

/** Unified card model, so board mode and generic mode render identically. */
type ViewCard = {
  key: string;
  title: string;
  body?: string;
  owner?: string;
  component?: string;
  componentVersion?: string;
};
type ViewColumn = { key: string; label: string; cards: ViewCard[] };

function PlanningCard({ card }: { card: ViewCard }) {
  return (
    <div className="rounded-md border border-line bg-background p-2 text-sm">
      <div className="font-medium leading-snug">{card.title}</div>
      {card.body && (
        <div className="markdown mt-1 text-[13px] text-muted [&_p]:my-0.5">
          <Markdown>{card.body}</Markdown>
        </div>
      )}
      {(card.component || card.owner) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {card.component && (
            <Link
              href={`/components/${card.component}`}
              className="rounded-full border border-line px-1.5 py-0.5 text-accent hover:border-accent"
            >
              {card.component}
              {card.componentVersion ? ` ${displayVersion(card.componentVersion)}` : ""}
            </Link>
          )}
          {card.owner && <span className="ml-auto">@{card.owner}</span>}
        </div>
      )}
    </div>
  );
}

function Board({ title, columns }: { title?: string; columns: ViewColumn[] }) {
  return (
    <WidgetFrame title={title}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <div key={col.key} className="w-64 shrink-0 rounded-lg border border-line bg-surface/60 p-2">
            <h3 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold">
              {col.label}
              <span className="text-xs font-normal text-muted">{col.cards.length}</span>
            </h3>
            <div className="space-y-2">
              {col.cards.map((card) => (
                <PlanningCard key={card.key} card={card} />
              ))}
              {col.cards.length === 0 && <p className="px-1 py-2 text-xs text-muted">—</p>}
            </div>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

export async function PlanningWidget({ config, ctx }: { config: PlanningConfig; ctx: WidgetContext }) {
  const { writableStore } = ctx;
  if (!writableStore) {
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">Planning boards need the database (set DATABASE_URL).</p>
      </WidgetFrame>
    );
  }

  // Generic mode: a read-only board over any content type, grouped by a
  // configurable field (Mark's "view op data"). Moving items happens via
  // their own admin/API.
  if (config.itemType) {
    if (config.phases.length === 0) {
      return (
        <WidgetFrame title={config.title}>
          <p className="text-sm text-muted">Configure at least one phase for this view.</p>
        </WidgetFrame>
      );
    }
    const recs = (await writableStore.listItems(config.itemType as ContentType)).map(
      (r) => r.data as Record<string, unknown>
    );
    const str = (v: unknown) => (v == null ? "" : String(v));
    const filtered = config.filterField
      ? recs.filter((r) => str(r[config.filterField!]) === (config.filterValue ?? ""))
      : recs;
    const columns = bucketInto(config.phases, filtered, (r) => str(r[config.phaseField])).map(
      (col) => ({
        key: col.key,
        label: col.label,
        cards: col.records.map((r, i): ViewCard => ({
          key: str(r.slug) || `${col.key}-${i}`,
          title: str(r[config.titleField]) || str(r.slug),
          owner: config.ownerField ? str(r[config.ownerField]) || undefined : undefined,
          component: config.componentField ? str(r[config.componentField]) || undefined : undefined,
        })),
      })
    );
    return <Board title={config.title} columns={columns} />;
  }

  // Board mode: a planning + its planning-items (the default). listItems
  // returns current assertions; the phase history lives in the item versions.
  const rec = config.planning ? await writableStore.getItem("planning", config.planning) : null;
  if (!rec) {
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">
          {config.planning ? `Planning "${config.planning}" not found.` : "No planning selected."}
        </p>
      </WidgetFrame>
    );
  }
  const planning = PlanningSchema.parse(rec.data);
  const items = (await writableStore.listItems("planning-item")).map((r) =>
    PlanningItemSchema.parse(r.data)
  );
  const columns: ViewColumn[] = groupIntoColumns(planning, items).map((col) => ({
    key: col.key,
    label: col.label,
    cards: col.cards.map(
      (it): ViewCard => ({
        key: it.slug,
        title: it.title,
        body: it.body || undefined,
        owner: it.owner || undefined,
        component: it.component,
        componentVersion: it.componentVersion,
      })
    ),
  }));
  return <Board title={config.title ?? planning.name} columns={columns} />;
}


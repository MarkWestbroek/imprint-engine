import type { Planning, PlanningItem } from "@imprint/content-core";

/**
 * Pure planning-board logic (mutations kept out of components/actions, cf. the
 * layout-ops convention). A card's column is its `status` (a phase key); its
 * position is `order`. Moving a card is therefore a data change on the item,
 * which the store records as a new bitemporal version.
 */

export type PlanningColumn = { key: string; label: string; cards: PlanningItem[] };

const OTHER_KEY = "__other";

/** Group items into columns following the planning's phase order; unknown
 * phase keys (e.g. a removed phase) collect in a trailing "Other" column. */
export function groupIntoColumns(planning: Planning, items: PlanningItem[]): PlanningColumn[] {
  const phases = [...planning.phases].sort((a, b) => a.order - b.order);
  const buckets = new Map<string, PlanningItem[]>();
  for (const p of phases) buckets.set(p.key, []);
  const other: PlanningItem[] = [];
  for (const it of items.filter((i) => i.planning === planning.slug)) {
    (buckets.get(it.status) ?? other).push(it);
  }
  const byOrder = (a: PlanningItem, b: PlanningItem) => a.order - b.order;
  const cols: PlanningColumn[] = phases.map((p) => ({
    key: p.key,
    label: p.label,
    cards: buckets.get(p.key)!.sort(byOrder),
  }));
  if (other.length) cols.push({ key: OTHER_KEY, label: "Other", cards: other.sort(byOrder) });
  return cols;
}

export type PhaseDef = { key: string; label: string };

/**
 * Generic bucketing: drop `records` into the configured `phases` by the key
 * `phaseOf` returns; anything with an unknown key lands in a trailing "Other"
 * column. Used by the widget's generic mode (a board over any content type).
 */
export function bucketInto<T>(
  phases: PhaseDef[],
  records: T[],
  phaseOf: (r: T) => string
): { key: string; label: string; records: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const p of phases) buckets.set(p.key, []);
  const other: T[] = [];
  for (const r of records) (buckets.get(phaseOf(r)) ?? other).push(r);
  const cols = phases.map((p) => ({ key: p.key, label: p.label, records: buckets.get(p.key)! }));
  if (other.length) cols.push({ key: "__other", label: "Other", records: other });
  return cols;
}

export type ItemPatch = { slug: string; status: string; order: number };

/**
 * Compute the (status, order) each item should have after moving `movedSlug`
 * to `toPhase` at position `toIndex`. Returns only the items that actually
 * change — the caller persists those (each a new version). Renumbers the
 * source and target columns to a clean 0..n so gaps never accumulate.
 */
export function computeMove(
  planning: Planning,
  items: PlanningItem[],
  movedSlug: string,
  toPhase: string,
  toIndex: number
): ItemPatch[] {
  const mine = items.filter((i) => i.planning === planning.slug);
  const moved = mine.find((i) => i.slug === movedSlug);
  if (!moved) return [];
  const fromPhase = moved.status;

  const columnCards = (phase: string) =>
    mine
      .filter((i) => i.status === phase && i.slug !== movedSlug)
      .sort((a, b) => a.order - b.order);

  const target = columnCards(toPhase);
  const clampedIndex = Math.max(0, Math.min(toIndex, target.length));
  target.splice(clampedIndex, 0, moved);

  const patches: ItemPatch[] = [];
  const renumber = (phase: string, cards: PlanningItem[]) => {
    cards.forEach((card, i) => {
      const status = phase;
      if (card.order !== i || card.status !== status) {
        patches.push({ slug: card.slug, status, order: i });
      }
    });
  };

  renumber(toPhase, target);
  if (fromPhase !== toPhase) renumber(fromPhase, columnCards(fromPhase));
  return patches;
}

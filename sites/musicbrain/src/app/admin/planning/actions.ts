"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PlanningItemSchema,
  PlanningSchema,
  type PlanningItem,
} from "@imprint/content-core";
import { canEdit, getSession } from "@/lib/auth";
import { writableStore } from "@/lib/content";
import { computeMove } from "@/lib/planning";
import type { ActionResult } from "../actions";

/**
 * Server actions for the planning board. Every card mutation is a bitemporal
 * put — moving a card between phases is just a `status` change, so the item's
 * version history is the record of how it travelled through the board.
 */

async function loadBoard(planningSlug: string) {
  const rec = await writableStore!.getItem("planning", planningSlug);
  if (!rec) return null;
  const planning = PlanningSchema.parse(rec.data);
  const items = (await writableStore!.listItems("planning-item"))
    .map((r) => PlanningItemSchema.parse(r.data))
    .filter((i) => i.planning === planningSlug);
  return { planning, items };
}

function refresh(planningSlug: string) {
  revalidatePath("/", "layout"); // public widget cache
  revalidatePath(`/admin/planning/${planningSlug}`);
}

/** Create a new board. */
export async function createPlanningAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const product = String(formData.get("product") ?? "").trim();
  try {
    const data = PlanningSchema.parse({ slug, name, ...(product && { product }) });
    if (await writableStore.getItem("planning", slug)) {
      return { ok: false, error: `Planning "${slug}" already exists` };
    }
    await writableStore.putItem("planning", slug, data, { by: session.name });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  redirect(`/admin/planning/${slug}`);
}

/** Move a card to `toPhase` at `toIndex` (persists the renumbered columns). */
export async function moveCardAction(
  planningSlug: string,
  movedSlug: string,
  toPhase: string,
  toIndex: number
): Promise<void> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return;
  const board = await loadBoard(planningSlug);
  if (!board) return;
  const patches = computeMove(board.planning, board.items, movedSlug, toPhase, toIndex);
  for (const patch of patches) {
    const item = board.items.find((i) => i.slug === patch.slug);
    if (!item) continue;
    await writableStore.putItem(
      "planning-item",
      patch.slug,
      { ...item, status: patch.status, order: patch.order },
      { lang: item.lang, by: session.name }
    );
  }
  refresh(planningSlug);
}

export type CardInput = {
  slug?: string;
  planning: string;
  title: string;
  status: string;
  owner: string;
  body: string;
  component?: string;
  componentVersion?: string;
};

/** Create or update a card. Returns the slug (generated on create). */
export async function saveCardAction(
  input: CardInput
): Promise<ActionResult & { slug?: string; item?: PlanningItem }> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    const isNew = !input.slug;
    const slug = input.slug ?? `${input.planning}-${Date.now().toString(36)}`;
    let order = 0;
    if (isNew) {
      const board = await loadBoard(input.planning);
      order = (board?.items.filter((i) => i.status === input.status).length ?? 0);
    } else {
      const existing = await writableStore.getItem("planning-item", slug);
      if (existing) order = PlanningItemSchema.parse(existing.data).order;
    }
    const data: PlanningItem = PlanningItemSchema.parse({
      slug,
      planning: input.planning,
      title: input.title,
      status: input.status,
      owner: input.owner,
      body: input.body,
      order,
      ...(input.component ? { component: input.component } : {}),
      ...(input.componentVersion ? { componentVersion: input.componentVersion } : {}),
    });
    await writableStore.putItem("planning-item", slug, data, { by: session.name });
    refresh(input.planning);
    return { ok: true, slug, item: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCardAction(
  planningSlug: string,
  slug: string,
  lang: string
): Promise<void> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return;
  await writableStore.deleteItem("planning-item", slug, lang || "en");
  refresh(planningSlug);
}

/** Delete a whole board (and tombstone its cards, so none dangle). */
export async function deletePlanningAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return;
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;
  const cards = (await writableStore.listItems("planning-item"))
    .map((r) => PlanningItemSchema.parse(r.data))
    .filter((i) => i.planning === slug);
  for (const c of cards) await writableStore.deleteItem("planning-item", c.slug, c.lang);
  const rec = await writableStore.getItem("planning", slug);
  await writableStore.deleteItem("planning", slug, rec?.lang ?? "en");
  revalidatePath("/", "layout");
  redirect("/admin/planning");
}

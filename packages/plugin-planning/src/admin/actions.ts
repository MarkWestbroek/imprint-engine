import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdminContext } from "@imprint/runtime-admin";
import { computeMove } from "../planning";
import { PlanningItemSchema, PlanningSchema, type PlanningItem } from "../schemas";

/**
 * The plugin's actions, reached through the site's `pluginAction("planning",
 * <name>, ...args)` dispatcher. Every card mutation is a bitemporal put —
 * moving a card between phases is just a `status` change, so the item's
 * version history is the record of how it travelled through the board.
 * Every action re-checks the session: the dispatcher is a public endpoint.
 */

export type ActionResult = { ok: boolean; error?: string };

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

export type SaveCardResult = ActionResult & { slug?: string; item?: PlanningItem };

async function editing(admin: AdminContext) {
  const session = await admin.auth.editingSession();
  const store = admin.imprint.writableStore;
  return session && store ? { session, store } : null;
}

async function loadBoard(admin: AdminContext, planningSlug: string) {
  const store = admin.imprint.writableStore!;
  const rec = await store.getItem("planning", planningSlug);
  if (!rec) return null;
  const planning = PlanningSchema.parse(rec.data);
  const items = (await store.listItems("planning-item"))
    .map((r) => PlanningItemSchema.parse(r.data))
    .filter((i) => i.planning === planningSlug);
  return { planning, items };
}

function refresh(planningSlug: string) {
  revalidatePath("/", "layout"); // public widget cache
  revalidatePath(`/admin/planning/${planningSlug}`);
}

/** Create a new board (a `useActionState` form action). */
export async function createPlanning(admin: AdminContext, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const e = await editing(admin);
  if (!e) return { ok: false, error: "Not signed in" };
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const product = String(formData.get("product") ?? "").trim();
  try {
    const data = PlanningSchema.parse({ slug, name, ...(product && { product }) });
    if (await e.store.getItem("planning", slug)) {
      return { ok: false, error: `Planning "${slug}" already exists` };
    }
    await e.store.putItem("planning", slug, data, { by: e.session.name });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  redirect(`/admin/planning/${slug}`);
}

/** Move a card to `toPhase` at `toIndex` (persists the renumbered columns). */
export async function moveCard(admin: AdminContext, planningSlug: string, movedSlug: string, toPhase: string, toIndex: number): Promise<void> {
  const e = await editing(admin);
  if (!e) return;
  const board = await loadBoard(admin, planningSlug);
  if (!board) return;
  const patches = computeMove(board.planning, board.items, movedSlug, toPhase, toIndex);
  for (const patch of patches) {
    const item = board.items.find((i) => i.slug === patch.slug);
    if (!item) continue;
    await e.store.putItem(
      "planning-item",
      patch.slug,
      { ...item, status: patch.status, order: patch.order },
      { lang: item.lang, by: e.session.name }
    );
  }
  refresh(planningSlug);
}

/** Create or update a card. Returns the slug (generated on create). */
export async function saveCard(admin: AdminContext, input: CardInput): Promise<SaveCardResult> {
  const e = await editing(admin);
  if (!e) return { ok: false, error: "Not signed in" };
  try {
    const isNew = !input.slug;
    const slug = input.slug ?? `${input.planning}-${Date.now().toString(36)}`;
    let order = 0;
    if (isNew) {
      const board = await loadBoard(admin, input.planning);
      order = board?.items.filter((i) => i.status === input.status).length ?? 0;
    } else {
      const existing = await e.store.getItem("planning-item", slug);
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
    await e.store.putItem("planning-item", slug, data, { by: e.session.name });
    refresh(input.planning);
    return { ok: true, slug, item: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCard(admin: AdminContext, planningSlug: string, slug: string, lang: string): Promise<void> {
  const e = await editing(admin);
  if (!e) return;
  await e.store.deleteItem("planning-item", slug, lang || "en");
  refresh(planningSlug);
}

/** Delete a whole board (and tombstone its cards, so none dangle). A plain form action. */
export async function deletePlanning(admin: AdminContext, formData: FormData): Promise<void> {
  const e = await editing(admin);
  if (!e) return;
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;
  const cards = (await e.store.listItems("planning-item"))
    .map((r) => PlanningItemSchema.parse(r.data))
    .filter((i) => i.planning === slug);
  for (const c of cards) await e.store.deleteItem("planning-item", c.slug, c.lang);
  const rec = await e.store.getItem("planning", slug);
  await e.store.deleteItem("planning", slug, rec?.lang ?? "en");
  revalidatePath("/", "layout");
  redirect("/admin/planning");
}

/** What the dispatcher may call, by name. */
export const planningActions = { createPlanning, moveCard, saveCard, deleteCard, deletePlanning };

import Link from "next/link";
import type { PluginScreenProps } from "@imprint/runtime-admin";
import { PlanningItemSchema, PlanningSchema } from "../schemas";
import { PlanningBoard } from "./board";
import { DeleteBoardButton } from "./delete-button";
import { NewPlanningForm } from "./new-form";

/** `/admin/planning` — the board list and the create form; `/admin/planning/<slug>` — one board. */
export async function planningScreen({ admin, path, call }: PluginScreenProps) {
  if (path.length === 0) return <PlanningList admin={admin} call={call} />;
  if (path.length === 1) return <PlanningBoardScreen admin={admin} slug={decodeURIComponent(path[0])} call={call} />;
  return null;
}

async function PlanningList({ admin, call }: Pick<PluginScreenProps, "admin" | "call">) {
  const store = admin.imprint.writableStore!;
  const plannings = (await store.listItems("planning")).map((r) => ({
    slug: r.slug,
    data: PlanningSchema.parse(r.data),
    by: r.createdBy,
  }));
  const products = (await store.listItems("product")).map((p) => p.slug);
  const itemCounts = new Map<string, number>();
  for (const r of await store.listItems("planning-item")) {
    const p = String((r.data as { planning?: string }).planning ?? "");
    itemCounts.set(p, (itemCounts.get(p) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Planning</h1>
      <p className="mt-1 text-sm text-muted">
        Boards with cards you drag between phases. Each move is a new version, so
        a board keeps the full history of how work travelled through its phases.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plannings.map((p) => (
          <Link
            key={p.slug}
            href={`/admin/planning/${p.slug}`}
            className="rounded-xl border border-line bg-surface p-5 hover:border-accent"
          >
            <p className="font-semibold">{p.data.name}</p>
            <p className="mt-1 font-mono text-xs text-muted">{p.slug}</p>
            <p className="mt-2 text-sm text-muted">
              {itemCounts.get(p.slug) ?? 0} cards
              {p.data.product ? ` · ${p.data.product}` : ""}
            </p>
          </Link>
        ))}
        {plannings.length === 0 && (
          <p className="text-sm text-muted">No boards yet — create one below.</p>
        )}
      </div>

      <div className="mt-8 max-w-md rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">New board</h2>
        <NewPlanningForm products={products} call={call} />
      </div>
    </div>
  );
}

async function PlanningBoardScreen({ admin, slug, call }: Pick<PluginScreenProps, "admin" | "call"> & { slug: string }) {
  const store = admin.imprint.writableStore!;
  const rec = await store.getItem("planning", slug);
  if (!rec) return null;
  const planning = PlanningSchema.parse(rec.data);

  const items = (await store.listItems("planning-item"))
    .map((r) => PlanningItemSchema.parse(r.data))
    .filter((i) => i.planning === slug);
  const users = admin.imprint.users ? (await admin.imprint.users.list()).map((u) => u.name) : [];
  const components = (await store.listItems("component")).map((c) => ({
    slug: c.slug,
    name: String((c.data as { name?: string }).name ?? c.slug),
  }));
  const session = await admin.auth.getSession();

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin/planning" className="text-sm text-muted hover:text-foreground">
          ← Planning
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{planning.name}</h1>
        {planning.product && (
          <Link
            href={`/admin/product/edit/${planning.product}`}
            className="rounded-full border border-line px-2 py-0.5 text-xs text-accent hover:border-accent"
          >
            {planning.product}
          </Link>
        )}
        <DeleteBoardButton slug={slug} cardCount={items.length} call={call} />
      </div>
      <p className="mb-4 text-sm text-muted">
        Drag cards between phases; click a card to edit. Every change is versioned.
      </p>
      <PlanningBoard
        planning={planning}
        items={items}
        users={users}
        components={components}
        currentUser={session?.name ?? ""}
        call={call}
      />
    </div>
  );
}

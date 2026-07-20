import Link from "next/link";
import { PlanningSchema } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { NewPlanningForm } from "@/components/admin/new-planning-form";

/** Board list + create form (the board itself lives at /admin/planning/[slug]). */
export default async function PlanningList() {
  const store = writableStore!;
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
        <NewPlanningForm products={products} />
      </div>
    </div>
  );
}

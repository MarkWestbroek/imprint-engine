import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanningSchema, PlanningItemSchema } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { getSession } from "@/lib/auth";
import { userStore } from "@/lib/auth";
import { PlanningBoard } from "@/components/admin/planning-board";
import { DeleteBoardButton } from "@/components/admin/delete-board-button";

type Props = { params: Promise<{ slug: string }> };

export default async function PlanningBoardPage({ params }: Props) {
  const { slug } = await params;
  const store = writableStore!;
  const rec = await store.getItem("planning", slug);
  if (!rec) notFound();
  const planning = PlanningSchema.parse(rec.data);

  const items = (await store.listItems("planning-item"))
    .map((r) => PlanningItemSchema.parse(r.data))
    .filter((i) => i.planning === slug);
  const users = userStore ? (await userStore.list()).map((u) => u.name) : [];
  const components = (await store.listItems("component")).map((c) => ({
    slug: c.slug,
    name: String((c.data as { name?: string }).name ?? c.slug),
  }));
  const session = await getSession();

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
        <DeleteBoardButton slug={slug} cardCount={items.length} />
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
      />
    </div>
  );
}

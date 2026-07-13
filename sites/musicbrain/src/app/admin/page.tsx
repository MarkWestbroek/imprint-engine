import Link from "next/link";
import type { ContentType } from "@imprint/content-core";
import { writableStore } from "@/lib/content";

const TYPES: { type: ContentType; label: string }[] = [
  { type: "page", label: "Pages" },
  { type: "product", label: "Products" },
  { type: "component", label: "Components" },
  { type: "board-spec", label: "Board specs" },
  { type: "release", label: "Releases" },
  { type: "menu", label: "Menus" },
];

export default async function AdminDashboard() {
  const store = writableStore!;
  const counts = await Promise.all(
    TYPES.map(async ({ type, label }) => ({
      type,
      label,
      count: (await store.listItems(type)).length,
    }))
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Every save creates a new version; nothing is overwritten. Use History
        on any item to inspect or roll back.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map(({ type, label, count }) => (
          <Link
            key={type}
            href={`/admin/${type}`}
            className="rounded-xl border border-line bg-surface p-5 hover:border-accent"
          >
            <p className="text-3xl font-semibold text-accent">{count}</p>
            <p className="mt-1 text-sm text-muted">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

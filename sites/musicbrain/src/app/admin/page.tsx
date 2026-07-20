import Link from "next/link";
import type { ContentType } from "@imprint/content-core";
import { writableStore } from "@/lib/content";

const TYPES: { type: ContentType; label: string }[] = [
  { type: "page", label: "Pages" },
  { type: "product", label: "Products" },
  { type: "component", label: "Components" },
  { type: "board-spec", label: "Board specs" },
  { type: "release", label: "Releases" },
  { type: "planning", label: "Planning" },
  { type: "menu", label: "Menus" },
  { type: "theme", label: "Themes" },
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

      {/* As-of preview (S6): browse the public site as it was/will be at a moment. */}
      <section className="mt-10 max-w-xl rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Time travel</h2>
        <p className="mt-1 text-sm text-muted">
          Browse the public site as it was — or, with scheduled content, will
          be — at a chosen moment. A banner on the site marks the preview;
          only your browser sees it.
        </p>
        <form action="/api/preview" method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Moment</span>
            <input
              type="datetime-local"
              name="asOf"
              required
              className="rounded-lg border border-line bg-background px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Start at</span>
            <input
              type="text"
              name="to"
              defaultValue="/"
              className="w-40 rounded-lg border border-line bg-background px-3 py-1.5 font-mono"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong"
          >
            Preview
          </button>
        </form>
      </section>
    </div>
  );
}

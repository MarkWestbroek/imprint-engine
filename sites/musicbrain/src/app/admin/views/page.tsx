import Link from "next/link";
import type { ContentType } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { viewSlugFor } from "@/components/default-view";

/**
 * Entry point for editing the per-content-type default views. Each links into
 * the studio for the "_view/<type>" page; composing widgets there (with the
 * "preview as" sample) defines how every item of that type renders. Absent a
 * view, the hand-coded route stays the fallback.
 */
const TYPES: { type: ContentType; label: string }[] = [
  { type: "product", label: "Product" },
  { type: "component", label: "Component" },
  { type: "release", label: "Release" },
  { type: "board-spec", label: "Board spec" },
];

export default async function AdminViews() {
  const store = writableStore!;
  const rows = await Promise.all(
    TYPES.map(async ({ type, label }) => ({
      type,
      label,
      exists: (await store.getItem("page", viewSlugFor(type))) !== null,
    }))
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Default views</h1>
      <p className="mt-1 text-sm text-muted">
        Compose how each content type renders by default. Edit the view in the
        studio; use “Preview as” to see it filled with a sample item. Without a
        view, the built-in layout is used.
      </p>
      <div className="mt-6 space-y-2">
        {rows.map(({ type, label, exists }) => (
          <Link
            key={type}
            href={`/admin/page/edit/${viewSlugFor(type)}`}
            className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent"
          >
            <span className="font-medium">{label}</span>
            <span className="text-xs text-muted">
              {exists ? "edit view" : "no view yet — create"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

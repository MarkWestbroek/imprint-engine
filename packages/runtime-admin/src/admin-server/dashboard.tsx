import Link from "next/link";
import type { AdminContext } from "../admin-context";

export async function DashboardScreen({ admin }: { admin: AdminContext }) {
  const store = admin.imprint.writableStore!;
  const catalog = admin.imprint.contentTypes;
  const counts = await Promise.all(
    catalog.types("overview").map(async (type) => ({
      type,
      label: catalog.info(type).label,
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

      {/* Diagnostics (Fase 6): what this instance runs with — plugins, their versions and what they bring. */}
      <section className="mt-10 max-w-3xl rounded-xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Extensions</h2>
        <p className="mt-1 text-sm text-muted">
          Plugins switched on in <code>imprint.config.ts</code>, and the content types they bring.
          Widgets: {admin.imprint.widgets.names().length} in the catalogue.
        </p>
        {admin.plugins.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No plugins — the core types only.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-4">Plugin</th>
                <th className="py-1.5 pr-4">Version</th>
                <th className="py-1.5 pr-4">Content types</th>
                <th className="py-1.5">Provides</th>
              </tr>
            </thead>
            <tbody>
              {admin.plugins.map((p) => (
                <tr key={p.name} className="border-b border-line">
                  <td className="py-1.5 pr-4 font-mono">{p.name}</td>
                  <td className="py-1.5 pr-4 text-muted">{p.version}</td>
                  <td className="py-1.5 pr-4 text-muted">{(p.contentTypes ?? []).map((t) => t.name).join(", ") || "—"}</td>
                  <td className="py-1.5 text-muted">
                    {[p.screen && "screens", p.actions && "actions", p.publicRoute && "public route", (p.widgets ?? []).length > 0 && "widgets"]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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

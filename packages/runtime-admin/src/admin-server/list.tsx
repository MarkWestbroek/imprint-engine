import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminContext } from "../admin-context";
import type { AdminActions } from "./actions";
import { isOutdated, isTranslatable } from "./translations";

function title(data: unknown, slug: string): string {
  const d = data as Record<string, unknown>;
  return String(d.title ?? d.name ?? slug);
}

/** The generic list of one content type: every current item, with edit, history and delete. */
export async function ListScreen({
  admin,
  type,
  actions,
}: {
  admin: AdminContext;
  type: string;
  actions: Pick<AdminActions, "deleteItem">;
}) {
  if (!admin.imprint.contentTypes.has(type, "listable")) notFound();
  const items = await admin.imprint.writableStore!.listItems(type);
  // On a site with more languages: per item, which other languages it has.
  const translatable = isTranslatable(admin, type);
  const { locales, defaultLocale } = admin.imprint;
  const version = (slug: string, lang: string) => items.find((i) => i.slug === slug && i.lang === lang) ?? null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold capitalize tracking-tight">{type}s</h1>
        <Link
          href={`/admin/${type}/edit`}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong"
        >
          + New {type}
        </Link>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Slug</th>
            <th className="py-2 pr-4">Lang</th>
            {translatable && <th className="py-2 pr-4">Translations</th>}
            <th className="py-2 pr-4">Valid from</th>
            <th className="py-2 pr-4">By</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-2.5 pr-4 font-medium">{title(item.data, item.slug)}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-muted">{item.slug}</td>
              <td className="py-2.5 pr-4 text-muted">
                {item.lang}
                {translatable && isOutdated(item, version(item.slug, defaultLocale)) && (
                  <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs" title={`The ${defaultLocale} version was changed after this translation`}>
                    outdated
                  </span>
                )}
              </td>
              {translatable && (
                <td className="py-2.5 pr-4">
                  <span className="flex flex-wrap gap-1.5">
                    {locales
                      .filter((l) => l !== item.lang)
                      .map((l) => (
                        <Link
                          key={l}
                          href={`/admin/${type}/edit/${item.slug}?lang=${l}`}
                          className="rounded border border-line px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-foreground"
                        >
                          {version(item.slug, l) ? `${l} ✓` : `+ ${l}`}
                        </Link>
                      ))}
                  </span>
                </td>
              )}
              <td className="py-2.5 pr-4 text-muted">
                {item.validFrom.toISOString().slice(0, 16).replace("T", " ")}
              </td>
              <td className="py-2.5 pr-4 text-muted">{item.createdBy ?? "—"}</td>
              <td className="py-2.5 text-right">
                <span className="flex justify-end gap-2">
                  <Link
                    href={`/admin/${type}/edit/${item.slug}?lang=${item.lang}`}
                    className="rounded border border-line px-2 py-1 hover:border-accent"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/${type}/history/${item.slug}?lang=${item.lang}`}
                    className="rounded border border-line px-2 py-1 text-muted hover:border-accent"
                  >
                    History
                  </Link>
                  <form action={actions.deleteItem}>
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="slug" value={item.slug} />
                    <input type="hidden" name="lang" value={item.lang} />
                    <button className="rounded border border-line px-2 py-1 text-muted hover:border-red-400 hover:text-red-400">
                      Delete
                    </button>
                  </form>
                </span>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={translatable ? 7 : 6} className="py-6 text-center text-muted">
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

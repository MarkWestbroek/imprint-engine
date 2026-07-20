import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContentType } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { deleteItemAction } from "../actions";

const CONTENT_TYPES: ContentType[] = ["site", "product", "component", "board-spec", "release", "page", "menu", "theme", "planning-item"];

type Props = { params: Promise<{ type: string }> };

function title(data: unknown, slug: string): string {
  const d = data as Record<string, unknown>;
  return String(d.title ?? d.name ?? slug);
}

export default async function AdminList({ params }: Props) {
  const { type } = await params;
  if (!CONTENT_TYPES.includes(type as ContentType)) notFound();
  const contentType = type as ContentType;
  const items = await writableStore!.listItems(contentType);

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
              <td className="py-2.5 pr-4 text-muted">{item.lang}</td>
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
                  <form action={deleteItemAction}>
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
              <td colSpan={6} className="py-6 text-center text-muted">
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

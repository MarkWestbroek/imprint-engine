import Link from "next/link";
import type { PluginScreenProps } from "@imprint/runtime-admin";
import { WikiFolderSchema, WikiPageSchema, WikiSchema } from "../schemas";
import { NewWikiForm } from "./new-form";
import { WikiStudio } from "./studio";

/** `/admin/wiki` — overview and create form; `/admin/wiki/<slug>` — the tree studio (design/wiki.md §4b). */
export async function wikiScreen({ admin, path, call }: PluginScreenProps) {
  if (path.length === 0) return <WikiList admin={admin} call={call} />;
  if (path.length === 1) return <WikiStudioScreen admin={admin} slug={decodeURIComponent(path[0])} call={call} />;
  return null;
}

async function WikiList({ admin, call }: Pick<PluginScreenProps, "admin" | "call">) {
  const store = admin.imprint.writableStore!;
  const wikis = (await store.listItems("wiki")).flatMap((r) => {
    const parsed = WikiSchema.safeParse(r.data);
    return parsed.success ? [parsed.data] : [];
  });
  const folderCounts = new Map<string, number>();
  for (const r of await store.listItems("wiki-folder")) {
    const w = String((r.data as { wiki?: string }).wiki ?? "");
    folderCounts.set(w, (folderCounts.get(w) ?? 0) + 1);
  }
  const pageCounts = new Map<string, number>();
  for (const r of await store.listItems("wiki-page")) {
    const w = String((r.data as { wiki?: string }).wiki ?? "");
    pageCounts.set(w, (pageCounts.get(w) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Wikis</h1>
      <p className="mt-1 text-sm text-muted">
        Op zichzelf staande informatiebundels: een wiki bevat folders, folders
        bevatten pagina&apos;s. Open een wiki om de boom te bewerken.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wikis.map((w) => (
          <Link
            key={w.slug}
            href={`/admin/wiki/${w.slug}`}
            className="rounded-xl border border-line bg-surface p-5 hover:border-accent"
          >
            <p className="font-semibold">{w.title}</p>
            <p className="mt-1 font-mono text-xs text-muted">
              /{w.slug} · {w.lang} · {w.access}
            </p>
            <p className="mt-2 text-sm text-muted">
              {folderCounts.get(w.slug) ?? 0} folders · {pageCounts.get(w.slug) ?? 0} pagina&apos;s
            </p>
          </Link>
        ))}
        {wikis.length === 0 && (
          <p className="text-sm text-muted">Nog geen wiki&apos;s — maak er hieronder een.</p>
        )}
      </div>

      <div className="mt-8 max-w-md rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Nieuwe wiki</h2>
        <NewWikiForm call={call} />
      </div>
    </div>
  );
}

async function WikiStudioScreen({ admin, slug, call }: Pick<PluginScreenProps, "admin" | "call"> & { slug: string }) {
  const store = admin.imprint.writableStore!;
  const rec = (await store.listItems("wiki")).find((i) => i.slug === slug);
  if (!rec) return null;
  const parsed = WikiSchema.safeParse(rec.data);
  if (!parsed.success) return null;
  const wiki = parsed.data;

  const folders = (await store.listItems("wiki-folder")).flatMap((r) => {
    const f = WikiFolderSchema.safeParse(r.data);
    return f.success && f.data.wiki === slug ? [f.data] : [];
  });
  const pages = (await store.listItems("wiki-page")).flatMap((r) => {
    const p = WikiPageSchema.safeParse(r.data);
    return p.success && p.data.wiki === slug ? [p.data] : [];
  });
  const byOrder = <T extends { order: number; title: string }>(a: T, b: T) =>
    a.order - b.order || a.title.localeCompare(b.title);
  folders.sort(byOrder);
  pages.sort(byOrder);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin/wiki" className="text-sm text-muted hover:text-foreground">
          ← Wikis
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{wiki.title}</h1>
        <span className="font-mono text-xs text-muted">/{wiki.slug}</span>
      </div>
      <WikiStudio wiki={wiki} folders={folders} pages={pages} publishTarget={publishTarget(admin.imprint.secrets.publish)} call={call} />
    </div>
  );
}

/**
 * Host of the publish target, or null when publishing is not set up here.
 * Live has no PUBLISH_URL/PUBLISH_TOKEN, so the button does not appear there
 * (you do not publish live to live).
 */
function publishTarget(publish: { url?: string; token?: string } | undefined): string | null {
  const { url, token } = publish ?? {};
  if (!url || !token) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

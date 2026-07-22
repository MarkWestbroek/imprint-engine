import Link from "next/link";
import { WikiSchema } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { NewWikiForm } from "@/components/admin/new-wiki-form";

/**
 * Wiki-overzicht + aanmaken; de studio zelf leeft op /admin/wiki/[slug].
 * Deze statische route wint van de generieke /admin/[type]-lijst — bewust:
 * wiki's bewerk je hiërarchisch (boom), niet als platte typelijst.
 */
export default async function WikiList() {
  const store = writableStore!;
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
              /{w.slug} · {w.lang} · {w.visibility}
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
        <NewWikiForm />
      </div>
    </div>
  );
}

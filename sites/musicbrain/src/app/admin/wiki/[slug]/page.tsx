import Link from "next/link";
import { notFound } from "next/navigation";
import { WikiSchema, WikiFolderSchema, WikiPageSchema } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { WikiStudio } from "@/components/admin/wiki-studio";

type Props = { params: Promise<{ slug: string }> };

/** De wiki-studio: boom links, eigenschappen + tekst rechts (wiki.md §4b). */
export default async function WikiStudioPage({ params }: Props) {
  const { slug } = await params;
  const store = writableStore!;
  const rec = (await store.listItems("wiki")).find((i) => i.slug === slug);
  if (!rec) notFound();
  const parsed = WikiSchema.safeParse(rec.data);
  if (!parsed.success) notFound();
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
      <WikiStudio wiki={wiki} folders={folders} pages={pages} publishTarget={publishTarget()} />
    </div>
  );
}

/**
 * Doel van de publiceer-knop, of null als publiceren hier niet is ingericht.
 * Live heeft geen PUBLISH_URL/PUBLISH_TOKEN — daar verschijnt de knop dus
 * niet (op live publiceer je niet nog een keer naar live).
 */
function publishTarget(): string | null {
  const url = process.env.PUBLISH_URL;
  if (!url || !process.env.PUBLISH_TOKEN) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

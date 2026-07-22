import Link from "next/link";
import type { Wiki, WikiFolder, WikiPage } from "@imprint/content-core";
import { Markdown } from "@/components/markdown";
import { wikiPageHref } from "@/lib/wiki";

/**
 * Wiki-chrome (design/wiki.md §3): navigatieboom links, content rechts —
 * het "boek" met zijn hoofdstukken. De boom is de folder/pagina-structuur
 * zelf; de actieve pagina licht op in accent.
 */

type TreeProps = {
  folders: WikiFolder[];
  pages: WikiPage[];
  parent: string;
  current: WikiPage | null;
  depth: number;
};

function Tree({ folders, pages, parent, current, depth }: TreeProps) {
  const childFolders = folders.filter((f) => (f.parent || "") === parent);
  const childPages = pages.filter((p) => p.folder === parent);
  if (childFolders.length === 0 && childPages.length === 0) return null;
  return (
    <ul className={depth > 0 ? "ml-3 border-l border-line pl-3" : undefined}>
      {childPages.map((p) => (
        <li key={p.slug} className="my-1">
          <Link
            href={wikiPageHref(p, folders)}
            className={
              current?.slug === p.slug
                ? "font-semibold text-accent"
                : "text-muted hover:text-foreground"
            }
          >
            {p.title}
          </Link>
        </li>
      ))}
      {childFolders.map((f) => (
        <li key={f.slug} className="my-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {f.title}
          </p>
          <Tree folders={folders} pages={pages} parent={f.slug} current={current} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export function WikiView({
  wiki,
  folders,
  pages,
  current,
}: {
  wiki: Wiki;
  folders: WikiFolder[];
  pages: WikiPage[];
  current: WikiPage | null;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="text-sm">
        <Link href={`/${wiki.slug}`} className="eyebrow hover:underline">
          {wiki.title}
        </Link>
        <nav className="mt-3">
          {/* Pagina's die (nog) in geen enkele bestaande folder zitten. */}
          <Tree folders={folders} pages={pages} parent="" current={current} depth={0} />
          {pages
            .filter((p) => !folders.some((f) => f.slug === p.folder))
            .map((p) => (
              <p key={p.slug} className="my-1">
                <Link
                  href={wikiPageHref(p, folders)}
                  className={
                    current?.slug === p.slug
                      ? "font-semibold text-accent"
                      : "text-muted hover:text-foreground"
                  }
                >
                  {p.title}
                </Link>
              </p>
            ))}
        </nav>
      </aside>

      <article className="min-w-0 max-w-3xl">
        {current ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{current.title}</h1>
            <div className="mt-6">
              <Markdown>{current.body}</Markdown>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{wiki.title}</h1>
            {wiki.description && <p className="mt-2 text-lg text-muted">{wiki.description}</p>}
            {pages.length === 0 && (
              <p className="mt-6 text-sm text-muted">
                Nog geen pagina&apos;s — vul deze wiki in de admin (Content → Wiki).
              </p>
            )}
          </>
        )}
      </article>
    </div>
  );
}

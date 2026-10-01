import Link from "next/link";
import type { Wiki, WikiFolder, WikiPage } from "./schemas";
import { Markdown } from "@imprint/runtime-admin";
import { wikiPageHref } from "./href";
import { TreeToggle } from "./tree-toggle";

/**
 * Wiki-chrome (design/wiki.md §3): navigatieboom links, content rechts —
 * het "boek" met zijn hoofdstukken. De boom is de folder/pagina-structuur
 * zelf; de actieve pagina licht op in accent.
 *
 * Folders klappen in (`<details>`, werkt zonder JavaScript): alleen de eerste
 * laag en het pad naar de huidige pagina staan open, met "Alles uitklappen"
 * erboven. Heeft een folder een pagina met dezelfde titel, dan is die zijn
 * inleiding: de foldernaam linkt ernaar en de pagina staat niet nog eens in
 * de lijst (zo ziet een Pleio-wiki eruit, waar een pagina kinderen heeft).
 */

type TreeProps = {
  folders: WikiFolder[];
  pages: WikiPage[];
  parent: string;
  current: WikiPage | null;
  /** Folders on the path to the current page: these start open. */
  openPath: Set<string>;
  depth: number;
};

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The folder's own page: the one in it with the folder's title. */
const introOf = (folder: WikiFolder, pages: WikiPage[]) =>
  pages.find((p) => p.folder === folder.slug && sameTitle(p.title, folder.title)) ?? null;

function pageLinkClass(active: boolean) {
  return active ? "font-semibold text-accent" : "text-muted hover:text-foreground";
}

function Tree({ folders, pages, parent, current, openPath, depth }: TreeProps) {
  const childFolders = folders.filter((f) => (f.parent || "") === parent);
  const intro = folders.find((f) => f.slug === parent);
  const introPage = intro ? introOf(intro, pages) : null;
  const childPages = pages.filter((p) => p.folder === parent && p.slug !== introPage?.slug);
  if (childFolders.length === 0 && childPages.length === 0) return null;
  // Pages and folders in one list, by their order (a page's order sits among its sibling folders').
  const entries = [
    ...childPages.map((p) => ({ order: p.order, page: p, folder: null })),
    ...childFolders.map((f) => ({ order: f.order, page: null, folder: f })),
  ].sort((a, b) => a.order - b.order);
  return (
    <ul className={depth > 0 ? "ml-2 border-l border-line pl-3" : undefined}>
      {entries.map(({ page, folder }) => {
        if (page) {
          return (
            <li key={`p-${page.slug}`} className="my-1">
              <Link href={wikiPageHref(page, folders)} className={pageLinkClass(current?.slug === page.slug)}>
                {page.title}
              </Link>
            </li>
          );
        }
        const f = folder!;
        const own = introOf(f, pages);
        const hasChildren =
          folders.some((c) => c.parent === f.slug) || pages.some((p) => p.folder === f.slug && p.slug !== own?.slug);
        const label = own ? (
          <Link href={wikiPageHref(own, folders)} className={pageLinkClass(current?.slug === own.slug)}>
            {f.title}
          </Link>
        ) : (
          <span className="text-muted">{f.title}</span>
        );
        if (!hasChildren) {
          return (
            <li key={`f-${f.slug}`} className="my-1">
              {label}
            </li>
          );
        }
        return (
          <li key={`f-${f.slug}`} className="my-1">
            <details open={openPath.has(f.slug) || undefined} className="group/wf">
              <summary className="flex cursor-pointer list-none items-start gap-1 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="mt-[0.35em] inline-block h-0 w-0 shrink-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-current text-muted transition-transform group-open/wf:rotate-90"
                />
                {label}
              </summary>
              <Tree
                folders={folders}
                pages={pages}
                parent={f.slug}
                current={current}
                openPath={openPath}
                depth={depth + 1}
              />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** The folders from the current page up to the top: they start open. */
function pathTo(current: WikiPage | null, folders: WikiFolder[]): Set<string> {
  const open = new Set<string>();
  const bySlug = new Map(folders.map((f) => [f.slug, f]));
  let cursor = current ? bySlug.get(current.folder) : undefined;
  while (cursor && !open.has(cursor.slug)) {
    open.add(cursor.slug);
    cursor = cursor.parent ? bySlug.get(cursor.parent) : undefined;
  }
  // The first layer is always visible: a single top folder (a whole wiki in one chapter) opens too.
  const top = folders.filter((f) => !f.parent);
  if (top.length === 1) open.add(top[0]!.slug);
  return open;
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
  const hasFolders = folders.some((f) => folders.some((c) => c.parent === f.slug) || pages.some((p) => p.folder === f.slug));
  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <aside className="text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={`/${wiki.slug}`} className="eyebrow hover:underline">
            {wiki.title}
          </Link>
          {hasFolders && <TreeToggle target="wiki-tree" />}
        </div>
        <nav className="mt-3" id="wiki-tree">
          <Tree folders={folders} pages={pages} parent="" current={current} openPath={pathTo(current, folders)} depth={0} />
          {/* Pagina's die (nog) in geen enkele bestaande folder zitten. */}
          {pages
            .filter((p) => !folders.some((f) => f.slug === p.folder))
            .map((p) => (
              <p key={p.slug} className="my-1">
                <Link href={wikiPageHref(p, folders)} className={pageLinkClass(current?.slug === p.slug)}>
                  {p.title}
                </Link>
              </p>
            ))}
        </nav>
      </aside>

      {/* 48rem by default for readable lines; a site can widen it with --wiki-article-width. */}
      <article className="min-w-0 max-w-[var(--wiki-article-width,48rem)]">
        {current ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{current.title}</h1>
            <div data-annotation-field="body" className="mt-6">
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

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Wiki, WikiFolder, WikiPage } from "@imprint/content-core";
import {
  createFolderAction,
  createPageAction,
  deleteWikiItemAction,
  moveWikiItemAction,
  publishWikiAction,
  saveFolderAction,
  savePageAction,
  saveWikiAction,
} from "@/app/admin/wiki/actions";
import { wikiPageHref } from "@/lib/wiki-href";
import { confirmDialog, promptDialog } from "./dialog";
import { MarkdownEditor } from "./markdown-editor";

/**
 * De wiki-studio (design/wiki.md §4b): structuur → inhoud, links naar
 * rechts. De boom links is de compositie (Wiki ◆— Folder ◆— Page); slepen
 * verplaatst (alleen het folder/parent-veld wijzigt, History vertelt de
 * rest). Rechts de eigenschappen en de tekst van de selectie; niets
 * geselecteerd = de wiki zelf.
 */

type Selection = { kind: "folder" | "page"; slug: string } | null;

const inputCls =
  "w-full rounded-md border border-line bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-muted";

export function WikiStudio({
  wiki,
  folders,
  pages,
  publishTarget,
}: {
  wiki: Wiki;
  folders: WikiFolder[];
  pages: WikiPage[];
  /** Host van het publicatiedoel; null = publiceren niet ingericht (bijv. op live). */
  publishTarget: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Selection>(null);
  // Concept-wijzigingen van de selectie (of van de wiki zelf); pas "Save"
  // maakt er een versie van.
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Selection>(null);
  /** Actieve invoegpositie tijdens slepen: "kind:parent:index" → streepje. */
  const [dropMark, setDropMark] = useState<string | null>(null);
  /** Inline hernoemen in de boom (dubbelklik): welke node + concepttitel. */
  const [renaming, setRenaming] = useState<{ sel: NonNullable<Selection>; title: string } | null>(null);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  const selectedFolder =
    selected?.kind === "folder" ? folders.find((f) => f.slug === selected.slug) : undefined;
  const selectedPage =
    selected?.kind === "page" ? pages.find((p) => p.slug === selected.slug) : undefined;

  const select = (sel: Selection) => {
    setSelected(sel);
    setDraft(null);
    setError(null);
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : (result.error ?? "Onbekende fout"));
      if (result.ok) router.refresh();
    });

  // ── Slepen: pagina → folder, folder → folder/wiki-wortel ──────────────
  const isDescendant = (candidate: string, ancestor: string): boolean => {
    let cursor = folders.find((f) => f.slug === candidate);
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.slug)) {
      if (cursor.slug === ancestor) return true;
      seen.add(cursor.slug);
      cursor = folders.find((f) => f.slug === cursor!.parent);
    }
    return false;
  };

  const dropOn = (targetFolder: string) => {
    if (!dragging) return;
    if (dragging.kind === "page") {
      const page = pages.find((p) => p.slug === dragging.slug);
      if (page && page.folder !== targetFolder && targetFolder !== "") {
        run(() => savePageAction({ ...page, folder: targetFolder }));
      }
    } else {
      const folder = folders.find((f) => f.slug === dragging.slug);
      // Niet in zichzelf of een eigen nakomeling slepen (cykel).
      if (folder && folder.slug !== targetFolder && !isDescendant(targetFolder, folder.slug)) {
        run(() => saveFolderAction({ ...folder, parent: targetFolder }));
      }
    }
    setDragging(null);
  };

  const dragProps = (sel: NonNullable<Selection>) => ({
    draggable: true,
    onDragStart: () => setDragging(sel),
    onDragEnd: () => {
      setDragging(null);
      setDropMark(null);
    },
  });

  /**
   * Dunne zone tussen items: licht op als invoeg-streepje wanneer er een
   * passend item overheen sleept; droppen voegt in op die positie
   * (moveWikiItemAction hernummert de broertjes server-side).
   */
  const DropZone = ({ kind, parent, index }: { kind: "page" | "folder"; parent: string; index: number }) => {
    const key = `${kind}:${parent}:${index}`;
    const accepts =
      dragging?.kind === kind &&
      !(kind === "page" && parent === "") &&
      !(kind === "folder" &&
        dragging !== null &&
        (parent === dragging.slug || isDescendant(parent, dragging.slug)));
    // Altijd renderen: verschijnen de zones pas bij dragstart, dan muteert
    // de DOM rond het gesleepte element en annuleert Chrome de drag.
    return (
      <div
        onDragOver={(e) => {
          if (!accepts) return;
          e.preventDefault();
          setDropMark(key);
        }}
        onDragLeave={() => setDropMark((m) => (m === key ? null : m))}
        onDrop={(e) => {
          if (!accepts || !dragging) return;
          e.preventDefault();
          e.stopPropagation();
          const moved = dragging.slug;
          setDragging(null);
          setDropMark(null);
          run(() =>
            moveWikiItemAction(
              kind === "page" ? "wiki-page" : "wiki-folder",
              moved,
              wiki.slug,
              parent,
              index
            )
          );
        }}
        className="h-1.5"
      >
        <div
          className={`mx-1 h-0.5 translate-y-0.5 rounded transition-colors ${
            dropMark === key ? "bg-accent" : "bg-transparent"
          }`}
        />
      </div>
    );
  };
  const dropProps = (targetFolder: string) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropOn(targetFolder);
    },
  });

  // ── Nieuw ─────────────────────────────────────────────────────────────
  const newFolder = async () => {
    const title = await promptDialog("Titel van de nieuwe folder", { confirmLabel: "Maak" });
    if (!title?.trim()) return;
    const parent = selectedFolder?.slug ?? "";
    run(() => createFolderAction(wiki.slug, parent, title.trim(), wiki.lang));
  };
  const newPage = async () => {
    const folder = selectedFolder?.slug ?? selectedPage?.folder ?? folders[0]?.slug;
    if (!folder) {
      setError("Maak eerst een folder — pagina's leven in een folder");
      return;
    }
    const title = await promptDialog("Titel van de nieuwe pagina", { confirmLabel: "Maak" });
    if (!title?.trim()) return;
    run(async () => {
      const result = await createPageAction(wiki.slug, folder, title.trim(), wiki.lang);
      if (result.ok && result.slug) setSelected({ kind: "page", slug: result.slug });
      return result;
    });
  };

  // ── Inline hernoemen (dubbelklik) — wijzigt alléén de titel; de slug
  // blijft stabiel, dus verwijzingen en URL's breken niet. ───────────────
  const commitRename = () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    const { sel } = renaming;
    setRenaming(null);
    if (!title) return;
    if (sel.kind === "page") {
      const page = pages.find((p) => p.slug === sel.slug);
      if (page && page.title !== title) run(() => savePageAction({ ...page, title }));
    } else {
      const folder = folders.find((f) => f.slug === sel.slug);
      if (folder && folder.title !== title) run(() => saveFolderAction({ ...folder, title }));
    }
  };

  const renameInput = (
    <input
      autoFocus
      value={renaming?.title ?? ""}
      onChange={(e) => renaming && setRenaming({ ...renaming, title: e.target.value })}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") setRenaming(null);
      }}
      className="w-full rounded border border-accent bg-background px-1.5 py-0.5 text-sm focus:outline-none"
    />
  );

  // ── Boom ──────────────────────────────────────────────────────────────
  const renderTree = (parent: string, depth: number): React.ReactNode => {
    const childFolders = folders.filter((f) => (f.parent || "") === parent);
    const childPages = pages.filter((p) => p.folder === parent);
    if (childFolders.length === 0 && childPages.length === 0) return null;
    return (
      <ul className={depth > 0 ? "ml-2 border-l border-line pl-2" : undefined}>
        {childPages.map((p, i) => (
          <li key={p.slug}>
            <DropZone kind="page" parent={parent} index={i} />
            {renaming?.sel.kind === "page" && renaming.sel.slug === p.slug ? (
              renameInput
            ) : (
              <button
                type="button"
                {...dragProps({ kind: "page", slug: p.slug })}
                onClick={() => select({ kind: "page", slug: p.slug })}
                onDoubleClick={() =>
                  setRenaming({ sel: { kind: "page", slug: p.slug }, title: p.title })
                }
                title="Dubbelklik om te hernoemen"
                className={`w-full cursor-grab rounded px-1.5 py-0.5 text-left text-sm ${
                  selected?.kind === "page" && selected.slug === p.slug
                    ? "bg-accent/15 font-semibold text-accent"
                    : "text-foreground hover:bg-surface"
                }`}
              >
                {p.title}
              </button>
            )}
          </li>
        ))}
        <li>
          <DropZone kind="page" parent={parent} index={childPages.length} />
        </li>
        {childFolders.map((f, i) => (
          <li key={f.slug} className="mt-1" {...dropProps(f.slug)}>
            <DropZone kind="folder" parent={parent} index={i} />
            {renaming?.sel.kind === "folder" && renaming.sel.slug === f.slug ? (
              renameInput
            ) : (
              <button
                type="button"
                {...dragProps({ kind: "folder", slug: f.slug })}
                onClick={() => select({ kind: "folder", slug: f.slug })}
                onDoubleClick={() =>
                  setRenaming({ sel: { kind: "folder", slug: f.slug }, title: f.title })
                }
                title="Dubbelklik om te hernoemen"
                className={`w-full cursor-grab rounded px-1.5 py-0.5 text-left font-mono text-[11px] uppercase tracking-[0.14em] ${
                  selected?.kind === "folder" && selected.slug === f.slug
                    ? "bg-accent/15 font-semibold text-accent"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                ▸ {f.title}
              </button>
            )}
            {renderTree(f.slug, depth + 1)}
          </li>
        ))}
        <li>
          <DropZone kind="folder" parent={parent} index={childFolders.length} />
        </li>
      </ul>
    );
  };

  // ── Eigenschappenpaneel ───────────────────────────────────────────────
  const data = (draft ??
    selectedPage ??
    selectedFolder ??
    wiki) as unknown as Record<string, unknown>;
  const setField = (key: string, v: unknown) => setDraft({ ...data, [key]: v });
  const dirty = draft !== null;

  const save = () => {
    if (!draft) return;
    if (selectedPage) run(() => savePageAction(draft as unknown as WikiPage));
    else if (selectedFolder) run(() => saveFolderAction(draft as unknown as WikiFolder));
    else run(() => saveWikiAction(draft as unknown as Wiki));
    setDraft(null);
  };

  const remove = async () => {
    const target = selectedPage ?? selectedFolder;
    if (!target || !selected) return;
    // Compositie: een folder neemt zijn subfolders en pagina's mee — zeg
    // er dus eerlijk bij hoeveel dat er zijn.
    let message = `"${target.title}" verwijderen? (herstelbaar via History)`;
    if (selectedFolder) {
      const doomed = new Set<string>([selectedFolder.slug]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const f of folders) {
          if (!doomed.has(f.slug) && f.parent && doomed.has(f.parent)) {
            doomed.add(f.slug);
            grew = true;
          }
        }
      }
      const subfolders = doomed.size - 1;
      const pageCount = pages.filter((p) => doomed.has(p.folder)).length;
      if (subfolders > 0 || pageCount > 0) {
        message =
          `Folder "${target.title}" verwijderen, inclusief ` +
          `${subfolders} subfolder(s) en ${pageCount} pagina('s)?\n\n` +
          `Alles is herstelbaar via History.`;
      }
    }
    if (!(await confirmDialog(message, { confirmLabel: "Verwijder", danger: true }))) return;
    run(async () => {
      const result = await deleteWikiItemAction(
        selected.kind === "page" ? "wiki-page" : "wiki-folder",
        target.slug,
        target.lang,
        wiki.slug
      );
      if (result.ok) setSelected(null);
      return result;
    });
  };

  const folderOptions = folders.filter(
    (f) => !selectedFolder || (f.slug !== selectedFolder.slug && !isDescendant(f.slug, selectedFolder.slug))
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Boom */}
      <aside className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => select(null)}
            className={`eyebrow ${selected === null ? "" : "opacity-70 hover:opacity-100"}`}
          >
            {wiki.title}
          </button>
          <span className="flex gap-1">
            <button
              type="button"
              onClick={newFolder}
              className="rounded border border-line px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-foreground"
              title="Nieuwe folder (in de geselecteerde folder, of bovenin)"
            >
              + folder
            </button>
            <button
              type="button"
              onClick={newPage}
              className="rounded border border-line px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-foreground"
              title="Nieuwe pagina (in de geselecteerde folder)"
            >
              + pagina
            </button>
          </span>
        </div>
        {/* Droppen op de kop = naar de wortel (alleen folders). */}
        <div {...dropProps("")} className="min-h-40">
          {renderTree("", 0) ?? (
            <p className="px-1.5 text-sm text-muted">Nog leeg — begin met een folder.</p>
          )}
        </div>
        <p className="mt-3 px-1.5 text-xs text-muted">
          Sleep pagina&apos;s naar een folder en folders in elkaar; klik om te bewerken.
        </p>
      </aside>

      {/* Eigenschappen + inhoud */}
      <section className="min-w-0 rounded-xl border border-line bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {selectedPage ? "Pagina" : selectedFolder ? "Folder" : "Wiki"}
            {dirty && <span className="ml-2 text-accent">• niet opgeslagen</span>}
          </h2>
          <span className="flex items-center gap-2">
            {selectedPage && (
              <Link
                href={wikiPageHref(selectedPage, folders)}
                target="_blank"
                className="text-xs text-accent underline underline-offset-4"
              >
                Bekijk op site ↗
              </Link>
            )}
            {!selected && (
              <>
                <Link
                  href={`/${wiki.slug}`}
                  target="_blank"
                  className="text-xs text-accent underline underline-offset-4"
                >
                  Bekijk op site ↗
                </Link>
                {publishTarget && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={async () => {
                      const ok = await confirmDialog(
                        `Hele wiki "${wiki.title}" publiceren naar ${publishTarget}?`,
                        { confirmLabel: "Publiceer" }
                      );
                      if (!ok) return;
                      setPublishMsg(null);
                      run(async () => {
                        const result = await publishWikiAction(wiki.slug);
                        if (result.ok) setPublishMsg(`Gepubliceerd: ${result.published} items`);
                        return result;
                      });
                    }}
                    className="rounded border border-accent px-2 py-0.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
                    title="POST alle items van deze wiki naar de content-API van het doel"
                  >
                    Publiceer → {publishTarget}
                  </button>
                )}
              </>
            )}
            {(selectedPage || selectedFolder) && (
              <button
                type="button"
                onClick={remove}
                className="rounded border border-red-400/40 px-2 py-0.5 text-xs text-red-400 hover:bg-red-400/10"
              >
                Verwijder
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || pending}
              className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-background disabled:opacity-40"
            >
              {pending ? "Bezig…" : "Save"}
            </button>
          </span>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {publishMsg && <p className="mb-3 text-sm text-accent">{publishMsg}</p>}

        <div className="space-y-3">
          <label className="block">
            <span className={labelCls}>Titel</span>
            <input
              className={`${inputCls} mt-1`}
              value={String(data.title ?? "")}
              onChange={(e) => setField("title", e.target.value)}
            />
          </label>

          {!selected && (
            <>
              <label className="block">
                <span className={labelCls}>Beschrijving</span>
                <textarea
                  className={`${inputCls} mt-1 min-h-24`}
                  value={String(data.description ?? "")}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Zichtbaarheid</span>
                <select
                  className={`${inputCls} mt-1 w-56`}
                  value={String(data.visibility ?? "public")}
                  onChange={(e) => setField("visibility", e.target.value)}
                >
                  <option value="public">public — iedereen</option>
                  <option value="members">members — alleen ingelogd</option>
                </select>
              </label>
            </>
          )}

          {selectedFolder && (
            <label className="block">
              <span className={labelCls}>In folder</span>
              <select
                className={`${inputCls} mt-1 w-72`}
                value={String(data.parent ?? "")}
                onChange={(e) => setField("parent", e.target.value)}
              >
                <option value="">— bovenin de wiki —</option>
                {folderOptions.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedPage && (
            <>
              <label className="block">
                <span className={labelCls}>In folder</span>
                <select
                  className={`${inputCls} mt-1 w-72`}
                  value={String(data.folder ?? "")}
                  onChange={(e) => setField("folder", e.target.value)}
                >
                  {folders.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="block">
                <span className={labelCls}>Tekst</span>
                <div className="mt-1">
                  <MarkdownEditor
                    key={selectedPage.slug}
                    value={String(data.body ?? "")}
                    onChange={(v) => setField("body", v)}
                  />
                </div>
              </div>
            </>
          )}

          <label className="block">
            <span className={labelCls}>Volgorde</span>
            <input
              type="number"
              className={`${inputCls} mt-1 w-28`}
              value={Number(data.order ?? 0)}
              onChange={(e) => setField("order", Number(e.target.value))}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

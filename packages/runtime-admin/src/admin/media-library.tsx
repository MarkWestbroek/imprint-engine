"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AssetRecord, ExifPolicy, Taglist } from "@imprint/content-core";
import { displayUrl, fileAccess, thumbUrl } from "../media/access";
import { confirmDialog, promptDialog } from "./dialog";
import type { MediaActions } from "./types";

/**
 * The media library (design/beeldbibliotheek.md): folders and filters on the
 * left (a file lives in one folder, like a file system; tags from tag lists
 * refine), a grid in the middle — files of one group (§12.3) as one card —
 * and the selected file's details on the right. Upload by button or by
 * dropping files on the grid; they land in the folder that is open.
 */

export type LibraryAsset = { slug: string; lang: string; data: AssetRecord; changed: string };

const EXIF_KEY = "imprint-exif-policy";
const EXIF_LABELS: Record<ExifPolicy, string> = {
  all: "Keep all EXIF (incl. location)",
  "no-location": "Keep camera data, drop location",
  none: "Strip all EXIF",
};
const KIND_LABELS: Record<string, string> = { image: "Images", svg: "SVG", document: "PDF", audio: "Audio", data: "Data (MIDI, JSON)" };

const inputCls =
  "w-full rounded-md border border-line bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-muted";
const sectionCls = "px-2 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted/80";

const ancestors = (folder: string) => folder.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"));

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function exposureLabel(s?: number): string | undefined {
  if (s === undefined) return undefined;
  return s < 1 ? `1/${Math.round(1 / s)}` : `${s}s`;
}

function durationLabel(s?: number): string | undefined {
  if (s === undefined) return undefined;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s - m * 60)).padStart(2, "0")}`;
}

/** The label to show for a stored tag: "onderwerp/portret" → "Portret" (from its list), else the tag itself. */
function tagLabel(tag: string, lists: Taglist[]): string {
  const [list, name] = tag.includes("/") ? tag.split("/") : [null, tag];
  const found = lists.find((l) => l.slug === list)?.tags.find((t) => t.slug === name);
  return found?.label ?? name;
}

/** A short glyph for files without a picture. */
function KindGlyph({ asset }: { asset: AssetRecord }) {
  const k = asset.file.kind;
  const text = k === "audio" ? "♪ WAV" : k === "data" ? (asset.data?.format === "midi" ? "MIDI" : "JSON") : k === "document" ? "PDF" : k.toUpperCase();
  return <span className="font-mono text-sm text-muted">{text}</span>;
}

type Card = { key: string; group?: string; members: LibraryAsset[] };

export function MediaLibrary({
  assets,
  taglists,
  uploadUrl,
  actions,
}: {
  assets: LibraryAsset[];
  taglists: Taglist[];
  uploadUrl: string;
  actions: MediaActions;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [folder, setFolder] = useState<string | null>(null); // null = all media
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [kind, setKind] = useState("");
  const [camera, setCamera] = useState("");
  const [lens, setLens] = useState("");
  const [located, setLocated] = useState(false);
  const [asGroup, setAsGroup] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(params.get("open"));
  const [policy, setPolicy] = useState<ExifPolicy>("no-location");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  // The EXIF choice is personal: remembered in this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXIF_KEY);
      if (saved === "all" || saved === "no-location" || saved === "none") setPolicy(saved);
    } catch {}
  }, []);
  const choosePolicy = (p: ExifPolicy) => {
    setPolicy(p);
    try {
      localStorage.setItem(EXIF_KEY, p);
    } catch {}
  };

  const folders = useMemo(() => {
    const all = new Set<string>();
    for (const a of assets) if (a.data.folder) ancestors(a.data.folder).forEach((f) => all.add(f));
    for (const f of extraFolders) ancestors(f).forEach((x) => all.add(x));
    return [...all].sort();
  }, [assets, extraFolders]);
  const countIn = (f: string) => assets.filter((a) => a.data.folder === f || a.data.folder.startsWith(`${f}/`)).length;

  const listed = new Set(taglists.flatMap((l) => l.tags.map((t) => `${l.slug}/${t.slug}`)));
  const freeTags = [...new Set(assets.flatMap((a) => a.data.tags).filter((t) => !listed.has(t)))].sort();
  const cameras = [...new Set(assets.map((a) => a.data.photo?.camera).filter((v): v is string => !!v))].sort();
  const lenses = [...new Set(assets.map((a) => a.data.photo?.lens).filter((v): v is string => !!v))].sort();
  const kinds = [...new Set(assets.map((a) => a.data.file.kind))].sort();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      const d = a.data;
      if (folder !== null && d.folder !== folder) return false;
      if (tagFilter.some((t) => !d.tags.includes(t))) return false;
      if (kind && d.file.kind !== kind) return false;
      if (camera && d.photo?.camera !== camera) return false;
      if (lens && d.photo?.lens !== lens) return false;
      if (located && !d.gps) return false;
      if (!q) return true;
      return [d.title, d.alt, d.file.filename, d.caption, d.credit, d.group, d.photo?.camera, d.photo?.lens, ...d.tags]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [assets, folder, query, tagFilter, kind, camera, lens, located]);

  // Files of one group become one card, at the place of its newest member.
  const cards = useMemo(() => {
    const out: Card[] = [];
    const byGroup = new Map<string, Card>();
    for (const a of visible) {
      const g = a.data.group;
      if (!g) {
        out.push({ key: a.slug, members: [a] });
        continue;
      }
      let card = byGroup.get(g);
      if (!card) {
        card = { key: `group:${g}`, group: g, members: [] };
        byGroup.set(g, card);
        out.push(card);
      }
      card.members.push(a);
    }
    return out;
  }, [visible]);

  const current = assets.find((a) => a.slug === selected) ?? null;
  const groupOf = (a: LibraryAsset) => (a.data.group ? assets.filter((x) => x.data.group === a.data.group) : [a]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setMessages([]);
    const fd = new FormData();
    for (const f of list) fd.append("file", f);
    fd.set("folder", folder ?? "");
    fd.set("exif", policy);
    for (const t of tagFilter) fd.append("tags", t); // uploading while filtered on a tag = tag it
    // Several files that belong together (a recording, RAW + JPEG): one group, named after the first file.
    if (asGroup && list.length > 1) fd.set("group", `${list[0].name.replace(/\..*$/, "")}-${Date.now().toString(36)}`);
    try {
      const res = await fetch(uploadUrl, { method: "POST", body: fd });
      const body = (await res.json()) as { error?: string; results?: { name: string; ok: boolean; slug?: string; error?: string }[] };
      if (!res.ok) {
        setMessages([body.error ?? `Upload failed (${res.status})`]);
      } else {
        const results = body.results ?? [];
        setMessages(results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error}`));
        const first = results.find((r) => r.ok)?.slug;
        if (first) setSelected(first);
      }
    } catch (err) {
      setMessages([err instanceof Error ? err.message : String(err)]);
    } finally {
      setUploading(false);
      router.refresh();
    }
  }

  async function newFolder() {
    const name = await promptDialog("New folder", { placeholder: "e.g. schetsen", initial: folder ? `${folder}/` : "", confirmLabel: "Create" });
    const clean = name?.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!clean) return;
    setExtraFolders((f) => [...f, clean]);
    setFolder(clean);
  }

  async function newTaglist() {
    const name = await promptDialog("New tag list", { placeholder: "e.g. Onderwerp", confirmLabel: "Create" });
    if (!name?.trim()) return;
    startTransition(async () => {
      const r = await actions.saveTaglist(null, { name: name.trim(), open: true, tags: [] });
      if (!r.ok) setMessages([r.error ?? "Could not create the tag list"]);
      router.refresh();
    });
  }

  async function addTagTo(list: Taglist) {
    const label = await promptDialog(`New tag in "${list.name}"`, { confirmLabel: "Add" });
    if (!label?.trim()) return;
    startTransition(async () => {
      const r = await actions.saveTaglist(list.slug, { tags: [...list.tags, { label: label.trim() }] });
      if (!r.ok) setMessages([r.error ?? "Could not add the tag"]);
      router.refresh();
    });
  }

  const usedBy = (tag: string) => assets.filter((a) => a.data.tags.includes(tag)).length;
  const files = (n: number) => (n === 1 ? "1 file" : `${n} files`);

  /** Run a tag-list change and show what it did (or why not). */
  const change = (run: () => Promise<{ ok: boolean; error?: string; affected?: number }>, done?: (affected: number) => string) =>
    startTransition(async () => {
      const r = await run();
      setMessages(r.ok ? [] : [r.error ?? "The change failed"]);
      if (r.ok && done) setNotice(done(r.affected ?? 0));
      router.refresh();
    });

  async function renameTag(list: Taglist, tag: { slug: string; label: string }) {
    const label = await promptDialog(`Rename tag "${tag.label}" (renaming onto an existing tag merges them)`, { initial: tag.label, confirmLabel: "Rename" });
    if (!label?.trim() || label.trim() === tag.label) return;
    change(() => actions.editTag(list.slug, tag.slug, { label: label.trim() }), (n) => `Tag renamed; ${files(n)} updated.`);
  }

  async function removeTag(list: Taglist, tag: { slug: string; label: string }) {
    const n = usedBy(`${list.slug}/${tag.slug}`);
    if (!(await confirmDialog(`Remove tag "${tag.label}"?${n ? ` It is taken off ${files(n)}.` : ""}`, { danger: true, confirmLabel: "Remove" }))) return;
    setTagFilter((f) => f.filter((x) => x !== `${list.slug}/${tag.slug}`));
    change(() => actions.editTag(list.slug, tag.slug, { remove: true }), (m) => `Tag removed; ${files(m)} updated.`);
  }

  async function renameList(list: Taglist) {
    const name = await promptDialog(`Rename tag list "${list.name}"`, { initial: list.name, confirmLabel: "Rename" });
    if (!name?.trim() || name.trim() === list.name) return;
    change(() => actions.saveTaglist(list.slug, { name: name.trim() }));
  }

  async function removeList(list: Taglist) {
    const n = assets.filter((a) => a.data.tags.some((t) => t.startsWith(`${list.slug}/`))).length;
    if (!(await confirmDialog(`Delete tag list "${list.name}" and its ${list.tags.length} tags?${n ? ` They are taken off ${files(n)}.` : ""}`, { danger: true, confirmLabel: "Delete" }))) return;
    setTagFilter((f) => f.filter((x) => !x.startsWith(`${list.slug}/`)));
    setEditingList(null);
    change(() => actions.deleteTaglist(list.slug), (m) => `Tag list deleted; ${files(m)} updated.`);
  }

  const toggleTag = (t: string) => setTagFilter((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]));

  const folderBtn = (active: boolean) =>
    `flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm ${
      active ? "bg-accent/15 text-foreground" : "text-muted hover:bg-foreground/[.06] hover:text-foreground"
    }`;
  const chip = (active: boolean) =>
    `rounded-full border px-2 py-0.5 text-xs ${active ? "border-accent bg-accent/15 text-foreground" : "border-line text-muted hover:border-accent hover:text-foreground"}`;

  return (
    <div data-wide="" className="flex min-h-[70vh] gap-4">
      {/* folders and filters */}
      <div className="w-56 shrink-0">
        <nav aria-label="Folders" className="space-y-0.5">
          <button type="button" className={folderBtn(folder === null)} onClick={() => setFolder(null)}>
            <span>All media</span>
            <span className="text-xs">{assets.length}</span>
          </button>
          <button type="button" className={folderBtn(folder === "")} onClick={() => setFolder("")}>
            <span>/ (root)</span>
            <span className="text-xs">{assets.filter((a) => !a.data.folder).length}</span>
          </button>
          {folders.map((f) => (
            <button
              key={f}
              type="button"
              className={folderBtn(folder === f)}
              style={{ paddingLeft: `${0.5 + (f.split("/").length - 1) * 0.9}rem` }}
              onClick={() => setFolder(f)}
            >
              <span className="truncate">📁 {f.split("/").at(-1)}</span>
              <span className="text-xs">{countIn(f)}</span>
            </button>
          ))}
          <button type="button" onClick={newFolder} className="mt-1 px-2 text-sm text-muted hover:text-accent">
            ＋ Folder
          </button>
        </nav>

        <section aria-label="Tags">
          <p className={sectionCls}>Tags</p>
          {taglists.map((l) => (
            <div key={l.slug} className="px-2 pb-2">
              <div className="mb-1 flex items-center gap-1">
                <p className="mr-auto text-xs font-medium">{l.name}</p>
                {editingList === l.slug && (
                  <>
                    <button type="button" onClick={() => renameList(l)} className="text-[11px] text-muted hover:text-accent">
                      rename
                    </button>
                    <button type="button" onClick={() => removeList(l)} className="text-[11px] text-red-400 hover:underline">
                      delete
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setEditingList((e) => (e === l.slug ? null : l.slug))}
                  className={`px-1 text-xs ${editingList === l.slug ? "text-accent" : "text-muted hover:text-accent"}`}
                  aria-label={editingList === l.slug ? `Done editing ${l.name}` : `Edit ${l.name}`}
                  aria-pressed={editingList === l.slug}
                  title={editingList === l.slug ? "Done" : "Rename or remove tags"}
                >
                  {editingList === l.slug ? "✓" : "✎"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {l.tags.map((t) => {
                  const tag = `${l.slug}/${t.slug}`;
                  if (editingList === l.slug) {
                    return (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-xs">
                        <button type="button" onClick={() => renameTag(l, t)} aria-label={`Rename tag ${t.label}`} className="hover:text-accent">
                          {t.label}
                        </button>
                        <button type="button" onClick={() => removeTag(l, t)} aria-label={`Remove tag ${t.label}`} className="text-muted hover:text-red-400">
                          ×
                        </button>
                      </span>
                    );
                  }
                  return (
                    <button key={tag} type="button" className={chip(tagFilter.includes(tag))} onClick={() => toggleTag(tag)} aria-pressed={tagFilter.includes(tag)}>
                      {t.label}
                    </button>
                  );
                })}
                {l.open && (
                  <button type="button" className="px-1 text-xs text-muted hover:text-accent" onClick={() => addTagTo(l)} title={`Add a tag to ${l.name}`} aria-label={`Add a tag to ${l.name}`}>
                    ＋
                  </button>
                )}
              </div>
            </div>
          ))}
          {freeTags.length > 0 && (
            <div className="px-2 pb-2">
              <p className="mb-1 text-xs font-medium">Other</p>
              <div className="flex flex-wrap gap-1">
                {freeTags.map((t) => (
                  <button key={t} type="button" className={chip(tagFilter.includes(t))} onClick={() => toggleTag(t)} aria-pressed={tagFilter.includes(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={newTaglist} className="px-2 text-sm text-muted hover:text-accent">
            ＋ Tag list
          </button>
        </section>

        <section aria-label="Filters" className="space-y-2 px-2">
          <p className={`${sectionCls} px-0`}>Filter</p>
          {kinds.length > 1 && (
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
              <option value="">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k] ?? k}
                </option>
              ))}
            </select>
          )}
          {cameras.length > 0 && (
            <select className={inputCls} value={camera} onChange={(e) => setCamera(e.target.value)} aria-label="Camera">
              <option value="">Any camera</option>
              {cameras.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          {lenses.length > 0 && (
            <select className={inputCls} value={lens} onChange={(e) => setLens(e.target.value)} aria-label="Lens">
              <option value="">Any lens</option>
              {lenses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          {assets.some((a) => a.data.gps) && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={located} onChange={(e) => setLocated(e.target.checked)} /> With location
            </label>
          )}
        </section>
      </div>

      {/* grid */}
      <section
        className={`min-w-0 flex-1 rounded-xl border p-4 ${dragging ? "border-accent bg-accent/5" : "border-line"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-semibold tracking-tight">
            Media{folder ? <span className="text-muted"> / {folder}</span> : folder === "" ? <span className="text-muted"> / (root)</span> : null}
          </h1>
          <input
            type="search"
            placeholder="Search title, alt, lens, tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputCls} w-56`}
            aria-label="Search media"
          />
          <select
            value={policy}
            onChange={(e) => choosePolicy(e.target.value as ExifPolicy)}
            className={`${inputCls} w-auto`}
            aria-label="EXIF in web versions"
            title="What the web versions keep of the photo's EXIF. The original always keeps everything."
          >
            {(Object.keys(EXIF_LABELS) as ExifPolicy[]).map((p) => (
              <option key={p} value={p}>
                {EXIF_LABELS[p]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted" title="Files uploaded together become one group (e.g. a recording's wav, mid and patch)">
            <input type="checkbox" checked={asGroup} onChange={(e) => setAsGroup(e.target.checked)} /> as one group
          </label>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,.svg,.pdf,.wav,.mid,.midi,.json"
            className="hidden"
            data-testid="media-upload"
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {notice && (
          <p role="status" className="mb-3 flex justify-between rounded-md border border-line p-2 text-sm text-emerald-400">
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="text-muted hover:text-foreground" aria-label="Dismiss">
              ×
            </button>
          </p>
        )}
        {messages.length > 0 && (
          <ul className="mb-3 space-y-1 rounded-md border border-red-400/50 p-2 text-sm text-red-400">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}

        {cards.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            {assets.length === 0 ? "No media yet. Drop files here or use Upload." : "Nothing here. Drop files to upload them into this folder."}
          </p>
        ) : (
          <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}>
            {cards.map((card) => {
              // A group shows its picture if it has one, else its sound, else its first file.
              const lead =
                card.members.find((m) => m.data.file.kind === "image" || m.data.file.kind === "svg") ??
                card.members.find((m) => m.data.file.kind === "audio") ??
                card.members[0];
              const active = card.members.some((m) => m.slug === selected);
              const name = card.group ?? (lead.data.title || lead.data.file.filename);
              return (
                <li key={card.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(lead.slug)}
                    className={`block w-full overflow-hidden rounded-lg border text-left ${active ? "border-accent ring-1 ring-accent" : "border-line hover:border-accent"}`}
                    title={name}
                  >
                    <span className="relative grid aspect-square place-items-center bg-background">
                      {lead.data.file.kind === "image" || lead.data.file.kind === "svg" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- library files, any size
                        <img src={thumbUrl(lead.data)} alt={lead.data.alt} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <KindGlyph asset={lead.data} />
                      )}
                      {card.group && (
                        <span className="absolute right-1.5 top-1.5 rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background">
                          {card.members.length} files
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1.5 text-xs">
                      <span className="truncate">{name}</span>
                      {lead.data.access === "restricted" && <span title="Restricted">🔒</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* details */}
      <aside className="w-80 shrink-0">
        {current ? (
          <AssetDetails
            key={current.slug}
            asset={current}
            group={groupOf(current)}
            folders={folders}
            taglists={taglists}
            actions={actions}
            onSelect={setSelected}
            onDeleted={() => setSelected(null)}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Select an item to see and edit its details.</p>
        )}
      </aside>
    </div>
  );
}

function Preview({ d }: { d: AssetRecord }) {
  const k = d.file.kind;
  if (k === "image" || k === "svg") {
    // eslint-disable-next-line @next/next/no-img-element -- library files, any size
    return <img src={displayUrl(d)} alt={d.alt} className="max-h-64 w-full object-contain" />;
  }
  if (k === "audio") {
    return (
      <div className="p-3">
        <audio controls preload="metadata" src={d.file.original} className="w-full" />
      </div>
    );
  }
  return (
    <a href={d.file.original} target="_blank" rel="noreferrer" className="grid place-items-center gap-1 p-6 text-center text-sm text-accent">
      <KindGlyph asset={d} />
      Open ↗
    </a>
  );
}

function AssetDetails({
  asset,
  group,
  folders,
  taglists,
  actions,
  onSelect,
  onDeleted,
}: {
  asset: LibraryAsset;
  group: LibraryAsset[];
  folders: string[];
  taglists: Taglist[];
  actions: MediaActions;
  onSelect: (slug: string) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const d = asset.data;
  const fields = (r: AssetRecord) => ({
    title: r.title,
    alt: r.alt,
    caption: r.caption ?? "",
    credit: r.credit ?? "",
    licence: r.licence ?? "",
    source: r.source ?? "",
    folder: r.folder,
    access: r.access,
    publicMaxWidth: r.publicMaxWidth ? String(r.publicMaxWidth) : "",
  });
  const [meta, setMeta] = useState(() => fields(d));
  const [tags, setTags] = useState<string[]>(d.tags);
  // The record changed on the server (a save, a renamed tag, a moved group):
  // start again from it, or a later Save would write the old values back.
  useEffect(() => {
    setMeta(fields(asset.data));
    setTags(asset.data.tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `changed` is the record's version
  }, [asset.changed]);
  const [freeTag, setFreeTag] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const set = (key: keyof typeof meta) => (e: { target: { value: string } }) => setMeta((m) => ({ ...m, [key]: e.target.value }));
  const addTag = (t: string) => t && setTags((all) => (all.includes(t) ? all : [...all, t]));

  const save = () =>
    startTransition(async () => {
      const result = await actions.saveAsset(asset.slug, {
        ...meta,
        tags,
        publicMaxWidth: meta.publicMaxWidth ? Number(meta.publicMaxWidth) : "",
        focus: d.focus,
      });
      setStatus(result.ok ? { ok: true, text: "Saved ✓" } : { ok: false, text: result.error ?? "Save failed" });
      if (result.ok) router.refresh();
    });

  const remove = async (whole: boolean) => {
    const what = whole ? `the whole group "${d.group}" (${group.length} files)` : `"${d.title || d.file.filename}"`;
    if (!(await confirmDialog(`Delete ${what}? It stays in History.`, { danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const result = await actions.deleteAsset(asset.slug, { group: whole });
      if (result.ok) {
        onDeleted();
        router.refresh();
      } else setStatus({ ok: false, text: result.error ?? "Delete failed" });
    });
  };

  const p = d.photo;
  const photoLine = p
    ? [p.camera, p.lens, p.focalLength && `${p.focalLength} mm`, p.fNumber && `f/${p.fNumber}`, exposureLabel(p.exposure), p.iso && `ISO ${p.iso}`]
        .filter(Boolean)
        .join(" · ")
    : "";
  const audioLine = d.audio
    ? [
        durationLabel(d.audio.duration),
        d.audio.sampleRate && `${d.audio.sampleRate / 1000} kHz`,
        d.audio.bitDepth && `${d.audio.bitDepth}-bit`,
        d.audio.channels && (d.audio.channels === 1 ? "mono" : d.audio.channels === 2 ? "stereo" : `${d.audio.channels} ch`),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const dataLine = d.data
    ? d.data.format === "midi"
      ? ["MIDI", d.data.midiFormat !== undefined && `format ${d.data.midiFormat}`, d.data.tracks !== undefined && `${d.data.tracks} tracks`, d.data.ppq && `${d.data.ppq} ppq`]
          .filter(Boolean)
          .join(" · ")
      : ["JSON", d.data.type].filter(Boolean).join(" · ")
    : "";
  const widths = [...new Set([...d.file.variants.map((v) => v.width), ...(d.publicMaxWidth ? [d.publicMaxWidth] : [])])].sort((a, b) => a - b);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      {d.group && (
        <div className="rounded-lg border border-line bg-background p-2">
          <p className="text-xs text-muted">
            Group <span className="font-mono text-foreground">{d.group}</span> · {group.length} files
          </p>
          <ul className="mt-1 space-y-0.5">
            {group.map((m) => (
              <li key={m.slug}>
                <button
                  type="button"
                  onClick={() => onSelect(m.slug)}
                  className={`w-full truncate text-left text-sm ${m.slug === asset.slug ? "font-semibold text-foreground" : "text-muted hover:text-accent"}`}
                >
                  {m.data.file.filename}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-background">
        <Preview d={d} />
      </div>

      <p className="break-all text-xs text-muted">
        {d.file.filename} · {d.file.width && d.file.height ? `${d.file.width}×${d.file.height} · ` : ""}
        {formatBytes(d.file.size)}
      </p>
      {photoLine && <p className="text-xs text-foreground">{photoLine}</p>}
      {audioLine && <p className="text-xs text-foreground">{audioLine}</p>}
      {dataLine && <p className="text-xs text-foreground">{dataLine}</p>}
      {p?.taken && <p className="text-xs text-muted">Taken {p.taken.slice(0, 16).replace("T", " ")}</p>}
      {d.gps && (
        <p className="text-xs">
          <a
            href={`https://www.openstreetmap.org/?mlat=${d.gps.lat}&mlon=${d.gps.lon}#map=15/${d.gps.lat}/${d.gps.lon}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            📍 {d.gps.lat.toFixed(5)}, {d.gps.lon.toFixed(5)} ↗
          </a>
        </p>
      )}

      <label className="block">
        <span className={labelCls}>Title</span>
        <input className={`${inputCls} mt-1`} value={meta.title} onChange={set("title")} />
      </label>
      {(d.file.kind === "image" || d.file.kind === "svg") && (
        <label className="block">
          <span className={labelCls}>Alt text</span>
          <textarea className={`${inputCls} mt-1 min-h-16`} value={meta.alt} onChange={set("alt")} placeholder="What the image shows, for screen readers" />
        </label>
      )}
      <label className="block">
        <span className={labelCls}>Caption</span>
        <input className={`${inputCls} mt-1`} value={meta.caption} onChange={set("caption")} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Credit</span>
          <input className={`${inputCls} mt-1`} value={meta.credit} onChange={set("credit")} />
        </label>
        <label className="block">
          <span className={labelCls}>Licence</span>
          <input className={`${inputCls} mt-1`} value={meta.licence} onChange={set("licence")} placeholder="e.g. CC BY 4.0" />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Source</span>
        <input className={`${inputCls} mt-1`} value={meta.source} onChange={set("source")} placeholder="Where it came from (URL)" />
      </label>
      <div>
        <label className="block">
          <span className={labelCls}>Folder</span>
          <input
            className={`${inputCls} mt-1`}
            value={meta.folder}
            onChange={set("folder")}
            list={`folders-${asset.slug}`}
            placeholder="/ (root)"
            aria-describedby={d.group && group.length > 1 ? `folder-hint-${asset.slug}` : undefined}
          />
        </label>
        <datalist id={`folders-${asset.slug}`}>
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        {d.group && group.length > 1 && (
          <span id={`folder-hint-${asset.slug}`} className="mt-0.5 block text-[11px] text-muted">
            Moving moves the whole group.
          </span>
        )}
      </div>

      <div>
        <span className={labelCls}>Tags</span>
        <div className="mt-1 flex flex-wrap gap-1" aria-label="Tags of this file">
          {tags.length === 0 && <span className="text-xs text-muted">none</span>}
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs">
              {tagLabel(t, taglists)}
              <button
                type="button"
                onClick={() => setTags((all) => all.filter((x) => x !== t))}
                aria-label={`Remove tag ${tagLabel(t, taglists)}`}
                className="text-muted hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {taglists.map((l) => {
            const free = l.tags.filter((t) => !tags.includes(`${l.slug}/${t.slug}`));
            if (free.length === 0) return null;
            return (
              <select key={l.slug} className={inputCls} value="" onChange={(e) => addTag(e.target.value)} aria-label={`Add from ${l.name}`}>
                <option value="">＋ {l.name}…</option>
                {free.map((t) => (
                  <option key={t.slug} value={`${l.slug}/${t.slug}`}>
                    {t.label}
                  </option>
                ))}
              </select>
            );
          })}
          <input
            className={inputCls}
            value={freeTag}
            onChange={(e) => setFreeTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(freeTag.trim().toLowerCase());
                setFreeTag("");
              }
            }}
            placeholder="Free tag + Enter"
            aria-label="Free tag"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Access</span>
          <select className={`${inputCls} mt-1`} value={meta.access} onChange={set("access")}>
            <option value="public">public</option>
            <option value="restricted">restricted</option>
          </select>
        </label>
        {d.file.variants.length > 0 && (
          <label className="block">
            <span className={labelCls}>Public up to</span>
            <select className={`${inputCls} mt-1`} value={meta.publicMaxWidth} onChange={set("publicMaxWidth")}>
              <option value="">every size</option>
              {widths.map((w) => (
                <option key={w} value={String(w)}>
                  {w} px
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {d.file.variants.length > 0 ? (
        <div>
          <span className={labelCls}>Formats</span>
          <ul className="mt-1 space-y-0.5 text-xs">
            {d.file.variants.map((v) => {
              const who = fileAccess(d, v.url);
              return (
                <li key={v.url} className="flex justify-between">
                  <a href={v.url} target="_blank" rel="noreferrer" className="text-muted hover:text-accent">
                    {v.width}×{v.height} WebP
                  </a>
                  <span className={who === "public" ? "text-emerald-400" : "text-muted"}>
                    {who === "public" ? "public" : who === "reader" ? "signed in" : "editors only"}
                  </span>
                </li>
              );
            })}
            <li className="text-muted">Web versions: {EXIF_LABELS[d.file.exif].toLowerCase()}</li>
            <li className="flex justify-between">
              <a href={d.file.original} target="_blank" rel="noreferrer" className="text-muted hover:text-accent">
                original ({d.file.mime.replace("image/", "")}, untouched)
              </a>
              <span className="text-muted">editors only</span>
            </li>
          </ul>
        </div>
      ) : (
        <p className="text-xs">
          <a href={d.file.original} target="_blank" rel="noreferrer" className="text-muted hover:text-accent">
            Download ({d.file.mime}) ↓
          </a>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:bg-accent-strong disabled:opacity-50"
        >
          Save
        </button>
        <a href={`/admin/asset/history/${asset.slug}`} className="text-sm text-muted hover:text-foreground">
          History
        </a>
        <span className="ml-auto flex gap-3">
          {d.group && group.length > 1 && (
            <button type="button" onClick={() => remove(true)} disabled={busy} className="text-sm text-red-400 hover:underline">
              Delete group
            </button>
          )}
          <button type="button" onClick={() => remove(false)} disabled={busy} className="text-sm text-red-400 hover:underline">
            Delete
          </button>
        </span>
      </div>
      {status && <p className={`text-sm ${status.ok ? "text-emerald-400" : "text-red-400"}`}>{status.text}</p>}
    </div>
  );
}

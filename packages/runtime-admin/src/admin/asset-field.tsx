"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * The asset picker (design/beeldbibliotheek.md §3): any image or file field in
 * a generated form or a widget editor. It stores `asset:<slug>` for a library
 * asset, or a plain URL (the way out: an external image, or content from
 * before the library). The library index comes from the admin's upload route
 * (GET), loaded once per page and shared by every picker on it.
 */

export const ASSET_PREFIX = "asset:";
const INDEX_URL = "/admin/upload";

export type LibraryEntry = {
  slug: string;
  title: string;
  alt: string;
  kind: string;
  folder: string;
  tags: string[];
  filename: string;
  thumb: string;
  display: string;
};

/* ---------- the shared index: one fetch per page, refreshable ---------- */

let entries: LibraryEntry[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = fetch(INDEX_URL, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { assets: [] }))
    .then((body: { assets?: LibraryEntry[] }) => {
      entries = body.assets ?? [];
      listeners.forEach((l) => l());
    })
    .catch(() => {
      entries = [];
      listeners.forEach((l) => l());
    });
  return loading;
}

/** The library index, or null while it loads. */
export function useLibrary(): { entries: LibraryEntry[] | null; refresh: () => Promise<void> } {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  const snapshot = useSyncExternalStore(subscribe, () => entries, () => null);
  useEffect(() => {
    void load();
  }, []);
  return { entries: snapshot, refresh: () => load(true) };
}

/** The URL to preview a field value with: the library's display URL for `asset:`, the value itself otherwise. */
export function useAssetPreview(value: string): { url: string; entry: LibraryEntry | null; missing: boolean } {
  const { entries: all } = useLibrary();
  if (!value.startsWith(ASSET_PREFIX)) return { url: value, entry: null, missing: false };
  const entry = all?.find((e) => e.slug === value.slice(ASSET_PREFIX.length)) ?? null;
  return { url: entry?.display ?? "", entry, missing: all !== null && !entry };
}

const inputCls =
  "w-full rounded-md border border-line bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none";

function Thumb({ entry, url }: { entry: LibraryEntry | null; url: string }) {
  const kind = entry?.kind ?? (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url) ? "image" : "file");
  if (kind === "image" || kind === "svg") {
    // eslint-disable-next-line @next/next/no-img-element -- library files, any size
    return <img src={entry?.thumb ?? url} alt="" className="h-full w-full object-cover" />;
  }
  return <span className="font-mono text-[10px] text-muted">{kind === "audio" ? "♪" : kind === "document" ? "PDF" : "FILE"}</span>;
}

/** One image/file field: preview, "Choose from library", or a pasted URL. */
export function AssetField({
  label,
  value,
  onChange,
  kinds = ["image", "svg"],
}: {
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
  kinds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const { url, entry, missing } = useAssetPreview(value);
  const isRef = value.startsWith(ASSET_PREFIX);

  return (
    <div className="block" role="group" aria-label={label}>
      <span className="block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-background">
          {value ? <Thumb entry={entry} url={url} /> : <span className="text-xs text-muted">—</span>}
        </span>
        <div className="min-w-0 flex-1">
          {isRef ? (
            <p className={`truncate text-sm ${missing ? "text-red-400" : ""}`} title={value}>
              {missing ? `Missing: ${value}` : entry ? entry.title || entry.filename : "…"}
            </p>
          ) : (
            <input
              className={inputCls}
              value={value}
              onChange={(e) => onChange(e.target.value || undefined)}
              placeholder="URL, or choose from the library"
              aria-label={`${label} URL`}
            />
          )}
          <div className="mt-1 flex gap-3 text-xs">
            <button type="button" onClick={() => setOpen(true)} className="text-accent hover:underline">
              Choose from library
            </button>
            {value && (
              <button type="button" onClick={() => onChange(undefined)} className="text-muted hover:text-red-400">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <AssetPicker
          kinds={kinds}
          onPick={(slug) => {
            onChange(ASSET_PREFIX + slug);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** A list of image fields (e.g. a product's media). */
export function AssetListField({
  label,
  value,
  onChange,
  kinds,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  kinds?: string[];
}) {
  return (
    <div className="block space-y-2">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {value.map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <AssetField
              label={`${label} ${i + 1}`}
              value={v}
              kinds={kinds}
              onChange={(next) => onChange(next ? value.map((x, j) => (j === i ? next : x)) : value.filter((_, j) => j !== i))}
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, ""])} className="text-xs text-accent hover:underline">
        ＋ Add
      </button>
    </div>
  );
}

/** The modal: search, folder, a grid of what fits `kinds`, and upload. */
function AssetPicker({ kinds, onPick, onClose }: { kinds: string[]; onPick: (slug: string) => void; onClose: () => void }) {
  const { entries: all, refresh } = useLibrary();
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fitting = useMemo(() => (all ?? []).filter((e) => kinds.includes(e.kind)), [all, kinds]);
  const folders = useMemo(() => [...new Set(fitting.map((e) => e.folder).filter(Boolean))].sort(), [fitting]);
  const shown = fitting.filter((e) => {
    if (folder !== null && e.folder !== folder) return false;
    const q = query.trim().toLowerCase();
    return !q || [e.title, e.alt, e.filename, ...e.tags].some((s) => s.toLowerCase().includes(q));
  });

  async function upload(files: FileList) {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("file", f);
    if (folder) fd.set("folder", folder);
    try {
      const res = await fetch(INDEX_URL, { method: "POST", body: fd });
      const body = (await res.json()) as { error?: string; results?: { ok: boolean; slug?: string; name: string; error?: string }[] };
      const first = body.results?.find((r) => r.ok)?.slug;
      const failed = body.results?.find((r) => !r.ok);
      if (!res.ok || failed) setError(body.error ?? `${failed?.name}: ${failed?.error}`);
      await refresh();
      if (first && !failed) onPick(first);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal
        aria-label="Choose from the media library"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-surface p-4 shadow-xl focus:outline-none"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold">Media library</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search the library"
            className={`${inputCls} w-48`}
          />
          <select value={folder ?? ""} onChange={(e) => setFolder(e.target.value || null)} aria-label="Folder" className={`${inputCls} w-auto`}>
            <option value="">All folders</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="rounded-md border border-line px-2 py-1 text-sm hover:border-accent disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload new"}
          </button>
          <input ref={fileInput} type="file" className="hidden" data-testid="picker-upload" onChange={(e) => e.target.files && upload(e.target.files)} />
          <button type="button" onClick={onClose} className="px-1 text-muted hover:text-foreground" aria-label="Close">
            ×
          </button>
        </div>
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {all === null ? (
            <p className="p-6 text-center text-sm text-muted">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">Nothing that fits here yet. Upload something.</p>
          ) : (
            <ul className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))" }}>
              {shown.map((e) => (
                <li key={e.slug}>
                  <button
                    type="button"
                    onClick={() => onPick(e.slug)}
                    className="block w-full overflow-hidden rounded-lg border border-line text-left hover:border-accent"
                    title={e.filename}
                  >
                    <span className="grid aspect-square place-items-center bg-background">
                      <Thumb entry={e} url={e.thumb} />
                    </span>
                    <span className="block truncate px-2 py-1 text-xs">{e.title || e.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

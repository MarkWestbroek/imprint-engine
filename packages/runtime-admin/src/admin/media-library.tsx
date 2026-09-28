"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AssetRecord, ExifPolicy } from "@imprint/content-core";
import { displayUrl, fileAccess, thumbUrl } from "../media/access";
import { confirmDialog, promptDialog } from "./dialog";
import type { MediaActions } from "./types";

/**
 * The media library (design/beeldbibliotheek.md): folders on the left (one
 * place per asset, like a file system), a grid in the middle, the selected
 * asset's details on the right. Upload by button or by dropping files on the
 * grid; they land in the folder that is open. Tags and tag lists come in the
 * next step.
 */

export type LibraryAsset = { slug: string; lang: string; data: AssetRecord; changed: string };

const EXIF_KEY = "imprint-exif-policy";
const EXIF_LABELS: Record<ExifPolicy, string> = {
  all: "Keep all EXIF (incl. location)",
  "no-location": "Keep camera data, drop location",
  none: "Strip all EXIF",
};

const inputCls =
  "w-full rounded-md border border-line bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-muted";

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

export function MediaLibrary({
  assets,
  uploadUrl,
  actions,
}: {
  assets: LibraryAsset[];
  uploadUrl: string;
  actions: MediaActions;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [folder, setFolder] = useState<string | null>(null); // null = all media
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("open"));
  const [policy, setPolicy] = useState<ExifPolicy>("no-location");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (folder !== null && a.data.folder !== folder) return false;
      if (!q) return true;
      const d = a.data;
      return [d.title, d.alt, d.file.filename, d.caption, d.credit, d.photo?.camera, d.photo?.lens, ...d.tags]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [assets, folder, query]);

  const current = assets.find((a) => a.slug === selected) ?? null;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setMessages([]);
    const fd = new FormData();
    for (const f of list) fd.append("file", f);
    fd.set("folder", folder ?? "");
    fd.set("exif", policy);
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
    const name = await promptDialog("New folder", {
      placeholder: "e.g. schetsen",
      initial: folder ? `${folder}/` : "",
      confirmLabel: "Create",
    });
    const clean = name?.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!clean) return;
    setExtraFolders((f) => [...f, clean]);
    setFolder(clean);
  }

  const folderBtn = (active: boolean) =>
    `flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm ${
      active ? "bg-accent/15 text-foreground" : "text-muted hover:bg-foreground/[.06] hover:text-foreground"
    }`;

  return (
    <div data-wide="" className="flex min-h-[70vh] gap-4">
      {/* folders */}
      <nav aria-label="Folders" className="w-52 shrink-0 space-y-0.5">
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
        <button type="button" onClick={newFolder} className="mt-2 px-2 text-sm text-muted hover:text-accent">
          ＋ Folder
        </button>
      </nav>

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
            accept="image/*,.svg,.pdf"
            className="hidden"
            data-testid="media-upload"
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {messages.length > 0 && (
          <ul className="mb-3 space-y-1 rounded-md border border-red-400/50 p-2 text-sm text-red-400">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}

        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            {assets.length === 0 ? "No media yet. Drop files here or use Upload." : "Nothing here. Drop files to upload them into this folder."}
          </p>
        ) : (
          <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}>
            {visible.map((a) => (
              <li key={a.slug}>
                <button
                  type="button"
                  onClick={() => setSelected(a.slug)}
                  className={`block w-full overflow-hidden rounded-lg border text-left ${
                    a.slug === selected ? "border-accent ring-1 ring-accent" : "border-line hover:border-accent"
                  }`}
                  title={a.data.title || a.data.file.filename}
                >
                  <span className="grid aspect-square place-items-center bg-background">
                    {a.data.file.kind === "document" ? (
                      <span className="font-mono text-sm text-muted">PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- library files, any size
                      <img src={thumbUrl(a.data)} alt={a.data.alt} loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1.5 text-xs">
                    <span className="truncate">{a.data.title || a.data.file.filename}</span>
                    {a.data.access === "restricted" && <span title="Restricted">🔒</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* details */}
      <aside className="w-80 shrink-0">
        {current ? (
          <AssetDetails
            key={current.slug}
            asset={current}
            folders={folders}
            actions={actions}
            onDeleted={() => setSelected(null)}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
            Select an item to see and edit its details.
          </p>
        )}
      </aside>
    </div>
  );
}

function AssetDetails({
  asset,
  folders,
  actions,
  onDeleted,
}: {
  asset: LibraryAsset;
  folders: string[];
  actions: MediaActions;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const d = asset.data;
  const [meta, setMeta] = useState({
    title: d.title,
    alt: d.alt,
    caption: d.caption ?? "",
    credit: d.credit ?? "",
    licence: d.licence ?? "",
    source: d.source ?? "",
    folder: d.folder,
    tags: d.tags.join(", "),
    access: d.access,
    publicMaxWidth: d.publicMaxWidth ? String(d.publicMaxWidth) : "",
  });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const set = (key: keyof typeof meta) => (e: { target: { value: string } }) => setMeta((m) => ({ ...m, [key]: e.target.value }));

  const save = () =>
    startTransition(async () => {
      const result = await actions.saveAsset(asset.slug, {
        ...meta,
        tags: meta.tags.split(",").map((t) => t.trim()).filter(Boolean),
        publicMaxWidth: meta.publicMaxWidth ? Number(meta.publicMaxWidth) : "",
        focus: d.focus,
      });
      setStatus(result.ok ? { ok: true, text: "Saved ✓" } : { ok: false, text: result.error ?? "Save failed" });
      if (result.ok) router.refresh();
    });

  const remove = async () => {
    if (!(await confirmDialog(`Delete "${d.title || d.file.filename}"? It stays in History.`, { danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const result = await actions.deleteAsset(asset.slug);
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
  const widths = [...new Set([...d.file.variants.map((v) => v.width), ...(d.publicMaxWidth ? [d.publicMaxWidth] : [])])].sort((a, b) => a - b);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="overflow-hidden rounded-lg border border-line bg-background">
        {d.file.kind === "document" ? (
          <a href={d.file.original} target="_blank" rel="noreferrer" className="block p-6 text-center text-sm text-accent">
            Open PDF ↗
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- library files, any size
          <img src={displayUrl(d)} alt={d.alt} className="max-h-64 w-full object-contain" />
        )}
      </div>

      <p className="break-all text-xs text-muted">
        {d.file.filename} · {d.file.width && d.file.height ? `${d.file.width}×${d.file.height} · ` : ""}
        {formatBytes(d.file.size)}
      </p>
      {photoLine && <p className="text-xs text-foreground">{photoLine}</p>}
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
      <label className="block">
        <span className={labelCls}>Alt text</span>
        <textarea className={`${inputCls} mt-1 min-h-16`} value={meta.alt} onChange={set("alt")} placeholder="What the image shows, for screen readers" />
      </label>
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
      <label className="block">
        <span className={labelCls}>Folder</span>
        <input className={`${inputCls} mt-1`} value={meta.folder} onChange={set("folder")} list={`folders-${asset.slug}`} placeholder="/ (root)" />
        <datalist id={`folders-${asset.slug}`}>
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className={labelCls}>Tags</span>
        <input className={`${inputCls} mt-1`} value={meta.tags} onChange={set("tags")} placeholder="comma separated" />
      </label>
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

      {d.file.variants.length > 0 && (
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
      )}

      <div className="flex items-center gap-2 pt-1">
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
        <button type="button" onClick={remove} disabled={busy} className="ml-auto text-sm text-red-400 hover:underline">
          Delete
        </button>
      </div>
      {status && <p className={`text-sm ${status.ok ? "text-emerald-400" : "text-red-400"}`}>{status.text}</p>}
    </div>
  );
}

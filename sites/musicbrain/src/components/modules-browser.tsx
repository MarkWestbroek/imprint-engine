"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MODULE_FAMILIES, tagLabel } from "@/lib/modules";

export type ModuleCard = { slug: string; name: string; description: string; version: string; image?: string; family: string; tags: string[] };

/**
 * /modules: grouped by family (or one A–Z list), with tag chips (several = all
 * of them) and a search on name and description. The filter lives in the
 * query string (?family=, ?tag=a,b, ?q=, ?view=az), so a module page can link
 * to "this family" and a filtered view can be shared; the page itself stays
 * prerendered, the URL is read after hydration.
 */
export function ModulesBrowser({ modules }: { modules: ModuleCard[] }) {
  const [tags, setTags] = useState<string[]>([]);
  const [family, setFamily] = useState("");
  const [q, setQ] = useState("");
  const [az, setAz] = useState(false);
  const [ready, setReady] = useState(false);

  // The filter from the address bar, once: the prerendered page cannot know it.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL once after hydration */
    setTags((p.get("tag") ?? "").split(",").filter(Boolean));
    setFamily(p.get("family") ?? "");
    setQ(p.get("q") ?? "");
    setAz(p.get("view") === "az");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams();
    if (family) p.set("family", family);
    if (tags.length) p.set("tag", tags.join(","));
    if (q) p.set("q", q);
    if (az) p.set("view", "az");
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}`);
  }, [ready, tags, family, q, az]);

  const allTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of modules) for (const t of m.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [modules]);

  const needle = q.trim().toLowerCase();
  const shown = modules.filter(
    (m) =>
      (!family || m.family === family) &&
      tags.every((t) => m.tags.includes(t)) &&
      (!needle || m.name.toLowerCase().includes(needle) || m.description.toLowerCase().includes(needle))
  );

  const byName = (a: ModuleCard, b: ModuleCard) => a.name.localeCompare(b.name);
  const rank = (f: string) => (MODULE_FAMILIES.includes(f) ? MODULE_FAMILIES.indexOf(f) : MODULE_FAMILIES.length);
  const groups: { family: string; modules: ModuleCard[] }[] = az
    ? [{ family: "", modules: [...shown].sort(byName) }]
    : [...new Set(shown.map((m) => m.family))]
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
        .map((f) => ({ family: f, modules: shown.filter((m) => m.family === f).sort(byName) }));

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-accent bg-accent text-background" : "border-line text-muted hover:text-foreground"}`;
  const filtered = family || tags.length > 0 || needle;

  return (
    <div className="mt-8 space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search modules…"
            aria-label="Search modules"
            className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
          />
          <div className="flex gap-1" role="group" aria-label="Order">
            <button type="button" className={chip(!az)} onClick={() => setAz(false)} aria-pressed={!az}>
              By family
            </button>
            <button type="button" className={chip(az)} onClick={() => setAz(true)} aria-pressed={az}>
              A–Z
            </button>
          </div>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tags">
            {allTags.map(([t, n]) => (
              <button key={t} type="button" className={chip(tags.includes(t))} onClick={() => toggleTag(t)} aria-pressed={tags.includes(t)}>
                {tagLabel(t)} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
        {filtered && (
          <p className="text-sm text-muted">
            {shown.length} of {modules.length} modules
            {family && (
              <>
                {" "}
                in <strong className="text-foreground">{family}</strong>
              </>
            )}
            {" · "}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => {
                setTags([]);
                setFamily("");
                setQ("");
              }}
            >
              Show all
            </button>
          </p>
        )}
      </div>

      {groups.map((g) => (
        <section key={g.family || "all"}>
          {!az && <h2 className="mb-3 text-xl font-semibold tracking-tight">{g.family || "Other"}</h2>}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {g.modules.map((m) => (
              <Link
                key={m.slug}
                href={`/components/${m.slug}`}
                className="group flex flex-col rounded-xl border border-line bg-surface p-3 transition-colors hover:border-accent"
              >
                {m.image && (
                  <div className="mb-3 flex h-56 items-center justify-center">
                    {/* Panels are narrow and tall; contain keeps each one whole. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image} alt={`${m.name} panel`} className="max-h-full max-w-full object-contain" loading="lazy" />
                  </div>
                )}
                <h3 className="font-semibold group-hover:text-accent">{m.name}</h3>
                {m.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{m.description}</p>}
                <p className="mt-auto pt-2 font-mono text-xs text-muted">{m.version}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {shown.length === 0 && <p className="text-muted">No modules match.</p>}
    </div>
  );
}

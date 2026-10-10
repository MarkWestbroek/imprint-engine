import Link from "next/link";
import { assetRefUrl, Markdown, type PluginScreenProps } from "@imprint/runtime-admin";
import { patchHref } from "./href";
import { ModerateButtons } from "./moderate-buttons";
import { listPatches, takeAssets } from "./patches";
import { Demo, type PatchesOptions } from "./public";
import { LICENSE_LABELS, POOL_LABELS, type Patch, type Pool } from "./schemas";

/**
 * `/admin/patches[/<pool>]`: the pool as the moderator sees it. Proposals
 * first; per patch its front, the demo to listen to (the site's take
 * widget), what it needs, the downloads, and the buttons to move it on.
 * Details (title, tags, text) stay in the generic form, one click away.
 */
const TABS: { pool: Pool; label: string }[] = [
  { pool: "voorstel", label: "Voorstellen" },
  { pool: "vraag", label: "Vragen" },
  { pool: "experimenteel", label: "Lab" },
  { pool: "centraal", label: "Centraal" },
];

export function patchesScreen(opts: PatchesOptions) {
  return async ({ admin, path, call }: PluginScreenProps) => {
    const pool = (TABS.find((t) => t.pool === path[0])?.pool ?? (path.length === 0 ? "voorstel" : null)) as Pool | null;
    if (!pool) return null;
    const store = admin.imprint.writableStore;
    const session = await admin.auth.editingSession();
    if (!store || !session) return <p className="text-sm text-muted">Alleen voor de redactie, met een database.</p>;
    const all = await listPatches(store);
    const counts = Object.fromEntries(TABS.map((t) => [t.pool, all.filter((p) => p.pool === t.pool).length]));
    const patches = all.filter((p) => p.pool === pool).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">Patches beoordelen</h1>
          <Link href="/admin/patch" className="text-sm text-muted hover:underline">
            Alle patches als lijst →
          </Link>
        </div>
        <nav className="flex flex-wrap gap-6 border-b border-line" aria-label="Pools">
          {TABS.map((t) => (
            <Link
              key={t.pool}
              href={t.pool === "voorstel" ? "/admin/patches" : `/admin/patches/${t.pool}`}
              className={`border-b-2 px-1 pb-2 text-sm ${t.pool === pool ? "border-accent font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {t.label} <span className="text-muted">({counts[t.pool]})</span>
            </Link>
          ))}
        </nav>
        {patches.length === 0 ? (
          <p className="text-sm text-muted">{pool === "voorstel" ? "Geen voorstellen om te beoordelen." : "Leeg."}</p>
        ) : (
          <ul className="space-y-6">
            {patches.map((p) => (
              <li key={p.slug}>
                <Card patch={p} opts={opts} call={call} me={session.name} store={store} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
}

async function Card({ patch, opts, call, me, store }: { patch: Patch; opts: PatchesOptions; call: PluginScreenProps["call"]; me: string; store: Parameters<typeof takeAssets>[0] }) {
  const front = patch.front ? assetRefUrl(patch.front) : null;
  const file = assetRefUrl(patch.file);
  const syx = patch.syx ? assetRefUrl(patch.syx) : null;
  const demos = await Promise.all(patch.takes.map(async (group) => ({ group, assets: await takeAssets(store, group) })));
  const link = "text-sm text-accent hover:underline";
  return (
    <article className="grid gap-5 rounded-xl border border-line bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0 space-y-3">
        <p className="text-xs text-muted">
          {POOL_LABELS[patch.pool]} · {patch.author || "onbekend"}
          {patch.publishedAt && ` · ${patch.publishedAt}`} · {LICENSE_LABELS[patch.license]}
          {patch.pool === "vraag" && patch.answered && " · beantwoord"}
        </p>
        <h2 className="text-xl font-semibold">{patch.title}</h2>
        {patch.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {patch.tags.map((t) => (
              <li key={t} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                {t.includes("/") ? t.split("/")[1] : t}
              </li>
            ))}
          </ul>
        )}
        {patch.pool === "vraag" && patch.question && (
          <div className="rounded-md border border-line bg-background p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">De vraag</p>
            <div className="markdown">
              <Markdown>{patch.question}</Markdown>
            </div>
          </div>
        )}
        {patch.description && (
          <div className="markdown max-h-48 overflow-y-auto text-sm">
            <Markdown>{patch.description}</Markdown>
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-muted">Editor</dt>
          <dd>{patch.requires.editorVersion}</dd>
          <dt className="text-muted">Firmware</dt>
          <dd>{patch.requires.firmwareContract}</dd>
          <dt className="text-muted">Modules</dt>
          <dd>{patch.requires.moduleTypes.join(", ") || "—"}</dd>
        </dl>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {opts.editorUrl && (
            <a href={`${opts.editorUrl}?patch=${encodeURIComponent(patch.slug)}`} target="_blank" rel="noreferrer" className={link}>
              Open in de editor
            </a>
          )}
          {file && (
            <a href={file} download className={link}>
              .patch.json
            </a>
          )}
          {syx && (
            <a href={syx} download className={link}>
              .syx
            </a>
          )}
          <Link href={`/admin/patch/edit/${patch.slug}`} className={link}>
            Gegevens bewerken
          </Link>
          {patch.pool !== "voorstel" && patch.pool !== "prive" && (
            <a href={patchHref(patch.slug)} target="_blank" rel="noreferrer" className={link}>
              Op de site
            </a>
          )}
        </p>
        <ModerateButtons slug={patch.slug} pool={patch.pool} license={patch.license} own={patch.author === me} answered={patch.answered} call={call} />
      </div>
      <div className="min-w-0 space-y-4">
        {front && (
          // eslint-disable-next-line @next/next/no-img-element -- a library SVG, sized by CSS
          <img src={front} alt={`Front van ${patch.title}`} className="w-full rounded-lg border border-line bg-background" />
        )}
        {demos.length > 0 ? (
          demos.map((d) => <Demo key={d.group} group={d.group} assets={d.assets} opts={opts} />)
        ) : (
          <p className="text-sm text-muted">Geen demo bij deze patch.</p>
        )}
      </div>
    </article>
  );
}

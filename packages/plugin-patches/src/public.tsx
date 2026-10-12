import type { ReactNode } from "react";
import Link from "next/link";
import { ANONYMOUS, contentResource, permit, userSubject, type AssetRecord } from "@imprint/content-core";
import { assetRefUrl, Markdown, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import { labHref, PATCHES_PREFIX, patchHref, patchesHref, questionsHref, RESERVED } from "./href";
import { derivedPatches, getPatch, listPatches, takeAssets } from "./patches";
import { LICENSE_LABELS, type Patch, type Pool } from "./schemas";

/**
 * The pool's pages (doc/plans/patch-pool.md §5): `/patches` (centraal),
 * `/patches/lab`, `/patches/vragen`, `/patches/<slug>`. Lists are
 * prerendered from the public view; a proposal is private, so its page goes
 * through /members, where the PDP decides for the session (its author and
 * the staff see it). The demo is the site's take widget, handed in through
 * `demo`; without it a plain audio element plays the wav.
 */
export type PatchesOptions = {
  /** The editor that opens a patch: `<editorUrl>?patch=<slug>&mode=play|edit`. */
  editorUrl?: string;
  /** The component page of a module type (`ladder` → `sw-ladder`); a module with a page gets a link under "Requires". */
  moduleComponent?: (moduleType: string) => string;
  /** Render a take group's demo (the site's take widget); receives the audio asset and its group. */
  demo?: (audio: AssetRecord, group: string) => ReactNode | Promise<ReactNode>;
};

/** The public pages are in English (MusicBrain); the admin's moderation screen keeps POOL_LABELS. */
const POOL_LABELS_EN: Record<Pool, string> = { prive: "private", voorstel: "proposal", experimenteel: "lab", centraal: "standard set", vraag: "question", afgewezen: "rejected" };

const LISTS: { pool: Pool; href: () => string; title: string; intro: string }[] = [
  { pool: "centraal", href: patchesHref, title: "Patches", intro: "The standard set that comes with the editor: listen, download, or open it in the editor." },
  { pool: "experimenteel", href: labHref, title: "Lab", intro: "Fun, works, but no promises: patches by makers, for anyone who wants to try." },
  { pool: "vraag", href: questionsHref, title: "Questions", intro: "“I am trying this and it does not work — who can help?” With the patch attached." },
];

function Nav({ current }: { current: Pool | null }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Pools">
      {LISTS.map((l) => (
        <Link key={l.pool} href={l.href()} className={`rounded-full border px-3 py-1 ${current === l.pool ? "border-accent bg-accent text-background" : "border-line text-muted hover:text-foreground"}`}>
          {l.title}
        </Link>
      ))}
    </nav>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
      {tags.map((t) => (
        <li key={t} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
          {t.includes("/") ? t.split("/")[1] : t}
        </li>
      ))}
    </ul>
  );
}

function ListView({ pool, patches }: { pool: Pool; patches: Patch[] }) {
  const list = LISTS.find((l) => l.pool === pool)!;
  return (
    <article className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight">{list.title}</h1>
      <p className="mt-2 text-muted">{list.intro}</p>
      <div className="mt-6">
        <Nav current={pool} />
      </div>
      {patches.length === 0 ? (
        <p className="text-muted">Nothing here yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {patches.map((p) => (
            <li key={p.slug} className="rounded-lg border border-line bg-surface p-4">
              {p.front && assetRefUrl(p.front) && (
                <Link href={patchHref(p.slug)}>
                  <img src={assetRefUrl(p.front) ?? undefined} alt="" className="mb-3 w-full rounded-md border border-line" />
                </Link>
              )}
              <h2 className="font-semibold">
                <Link href={patchHref(p.slug)} className="hover:underline">
                  {p.title}
                </Link>
                {pool === "vraag" && p.answered && <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs text-muted">answered</span>}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {p.author}
                {p.publishedAt && ` · ${p.publishedAt}`}
                {p.takes.length > 0 && ` · ${p.takes.length === 1 ? "demo" : `${p.takes.length} demos`}`}
              </p>
              {(p.description || p.question) && <p className="mt-2 line-clamp-3 text-sm">{(p.question ?? p.description).slice(0, 240)}</p>}
              <div className="mt-3">
                <Tags tags={p.tags} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export async function Demo({ group, assets, opts }: { group: string; assets: AssetRecord[]; opts: PatchesOptions }) {
  const audio = assets.find((a) => a.file.kind === "audio");
  if (!audio) return <p className="text-sm text-muted">Demo “{group}”: no recording found (or not visible to you).</p>;
  if (opts.demo) return <>{await opts.demo(audio, group)}</>;
  return (
    <div>
      <audio controls preload="none" src={assetRefUrl(`asset:${audio.slug}`) ?? undefined} className="w-full" />
      <p className="mt-1 text-xs text-muted">{audio.title || group}</p>
    </div>
  );
}

async function PatchView({ patch, parent, children, demos, modules, opts }: { patch: Patch; parent: Patch | null; children: Patch[]; demos: { group: string; assets: AssetRecord[] }[]; modules: { type: string; href: string | null; name: string }[]; opts: PatchesOptions }) {
  const back = LISTS.find((l) => l.pool === patch.pool) ?? LISTS[0]!;
  const file = assetRefUrl(patch.file);
  const syx = patch.syx ? assetRefUrl(patch.syx) : null;
  const front = patch.front ? assetRefUrl(patch.front) : null;
  return (
    <article className="max-w-3xl">
      <Link href={back.href()} className="text-sm text-muted hover:underline">
        ← {back.title}
      </Link>
      <p className="mt-4 text-xs text-muted">
        Patch · {POOL_LABELS_EN[patch.pool]}
        {patch.author && ` · ${patch.author}`}
        {patch.publishedAt && ` · ${patch.publishedAt}`} · {LICENSE_LABELS[patch.license]}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{patch.title}</h1>
      <div className="mt-3">
        <Tags tags={patch.tags} />
      </div>
      {front && (
        <figure className="mt-6">
          {/* Het front: de speelkant van de patch zoals de editor hem tekent (patch-front §7). */}
          <img src={front} alt={`Front of ${patch.title}: the main knobs and jacks`} className="w-full max-w-xl rounded-lg border border-line" />
          <figcaption className="mt-1 text-xs text-muted">The front: what you see in the editor without the cables.</figcaption>
        </figure>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {opts.editorUrl && (
          <>
            {/* The editor's deep link: ?patch=<slug>, &mode=play opens it ready to play (EDITOR-UI, 2026-10-12). */}
            <a href={`${opts.editorUrl}?patch=${encodeURIComponent(patch.slug)}&mode=play`} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong">
              ▶ Play
            </a>
            <a href={`${opts.editorUrl}?patch=${encodeURIComponent(patch.slug)}&mode=edit`} className="rounded-md border border-line px-4 py-2 text-sm hover:bg-surface">
              Open in the editor
            </a>
          </>
        )}
        {file && (
          <a href={file} download className="rounded-md border border-line px-4 py-2 text-sm hover:bg-surface">
            Download .patch.json
          </a>
        )}
        {syx && (
          <a href={syx} download className="rounded-md border border-line px-4 py-2 text-sm hover:bg-surface">
            Download .syx
          </a>
        )}
      </div>
      {patch.pool === "vraag" && patch.question && (
        <section className="mt-8 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">The question{patch.answered && " · answered"}</h2>
          <div className="markdown mt-2">
            <Markdown>{patch.question}</Markdown>
          </div>
        </section>
      )}
      {patch.description && (
        <div className="markdown mt-6" data-annotation-field="body">
          <Markdown>{patch.description}</Markdown>
        </div>
      )}
      {demos.length > 0 && (
        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Demo</h2>
          {demos.map((d) => (
            <Demo key={d.group} group={d.group} assets={d.assets} opts={opts} />
          ))}
        </section>
      )}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Requires</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Editor</dt>
          <dd>
            {patch.requires.editorVersion}
            {patch.requires.editorBuild && <span className="text-muted"> ({patch.requires.editorBuild})</span>}
          </dd>
          <dt className="text-muted">Firmware contract</dt>
          <dd>{patch.requires.firmwareContract}</dd>
          <dt className="text-muted">Modules</dt>
          <dd>
            {modules.length > 0
              ? modules.map((m, i) => (
                  <span key={m.type}>
                    {i > 0 && ", "}
                    {m.href ? (
                      <Link href={m.href} className="underline">
                        {m.name}
                      </Link>
                    ) : (
                      m.type
                    )}
                  </span>
                ))
              : "—"}
          </dd>
        </dl>
      </section>
      {(parent || children.length > 0) && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Family tree</h2>
          {parent && (
            <p className="mt-2 text-sm">
              Derived from{" "}
              <Link href={patchHref(parent.slug)} className="underline">
                {parent.title}
              </Link>
            </p>
          )}
          {children.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {children.map((c) => (
                <li key={c.slug}>
                  <Link href={patchHref(c.slug)} className="underline">
                    {c.title}
                  </Link>{" "}
                  <span className="text-muted">({POOL_LABELS_EN[c.pool]})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}

export function patchesPublicRoute(opts: PatchesOptions = {}) {
  return async ({ imprint, slug, members, session, subject: given }: PublicRouteContext): Promise<PublicRouteResult | null> => {
    if (slug[0] !== PATCHES_PREFIX || slug.length > 2) return null;
    const subject = given ?? (session ? userSubject(session.name, session.role) : ANONYMOUS);
    const reader = imprint.storeFor(subject);
    if (slug.length === 1 || RESERVED.has(slug[1]!)) {
      const pool: Pool = slug.length === 1 ? "centraal" : slug[1] === "lab" ? "experimenteel" : "vraag";
      const list = LISTS.find((l) => l.pool === pool)!;
      return { render: <ListView pool={pool} patches={await listPatches(reader, { pool })} />, metadata: { title: list.title, description: list.intro } };
    }
    const store = imprint.writableStore;
    if (!store) return null;
    const patch = await getPatch(store, slug[1]!);
    if (!patch) return null;
    if (patch.access !== "public") {
      if (!members) return { redirect: `/members/${slug.join("/")}` };
      if (!(await permit(imprint.pdp, subject, "read", contentResource("patch", patch.slug, patch)))) return null;
    }
    const parent = patch.derivedFrom ? await getPatch(reader, patch.derivedFrom) : null;
    const children = await derivedPatches(reader, patch.slug);
    const demos = await Promise.all(patch.takes.map(async (group) => ({ group, assets: await takeAssets(reader, group) })));
    const modules = await Promise.all(
      patch.requires.moduleTypes.map(async (type) => {
        const slug = opts.moduleComponent?.(type);
        const component = slug ? await imprint.store.getComponent(slug) : null;
        return { type, href: component ? `/components/${component.slug}` : null, name: component?.name ?? type };
      })
    );
    return {
      render: <PatchView patch={patch} parent={parent} children={children} demos={demos} modules={modules} opts={opts} />,
      metadata: { title: patch.title, description: (patch.description || patch.question || "").slice(0, 160) },
      item: { type: "patch", slug: patch.slug },
    };
  };
}

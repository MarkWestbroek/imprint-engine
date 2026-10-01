import type { ReactNode } from "react";
import Link from "next/link";
import { ANONYMOUS, contentResource, permit, userSubject, type AssetRecord } from "@imprint/content-core";
import { assetRefUrl, Markdown, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import { labHref, PATCHES_PREFIX, patchHref, patchesHref, questionsHref, RESERVED } from "./href";
import { derivedPatches, getPatch, listPatches, takeAssets } from "./patches";
import { LICENSE_LABELS, POOL_LABELS, type Patch, type Pool } from "./schemas";

/**
 * The pool's pages (doc/plans/patch-pool.md §5): `/patches` (centraal),
 * `/patches/lab`, `/patches/vragen`, `/patches/<slug>`. Lists are
 * prerendered from the public view; a proposal is private, so its page goes
 * through /members, where the PDP decides for the session (its author and
 * the staff see it). The demo is the site's take widget, handed in through
 * `demo`; without it a plain audio element plays the wav.
 */
export type PatchesOptions = {
  /** The editor that opens a patch: `<editorUrl>?patch=<slug>`. */
  editorUrl?: string;
  /** Render a take group's demo (the site's take widget); receives the audio asset and its group. */
  demo?: (audio: AssetRecord, group: string) => ReactNode | Promise<ReactNode>;
};

const LISTS: { pool: Pool; href: () => string; title: string; intro: string }[] = [
  { pool: "centraal", href: patchesHref, title: "Patches", intro: "De basisset die bij de editor hoort: beluister, download, of open hem in de editor." },
  { pool: "experimenteel", href: labHref, title: "Lab", intro: "Leuk, werkt, maar geen belofte: patches van makers, voor wie wil proberen." },
  { pool: "vraag", href: questionsHref, title: "Vragen", intro: "“Ik probeer dit, lukt niet — wie helpt?” Met de patch erbij." },
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
        <p className="text-muted">Nog niets hier.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {patches.map((p) => (
            <li key={p.slug} className="rounded-lg border border-line bg-surface p-4">
              <h2 className="font-semibold">
                <Link href={patchHref(p.slug)} className="hover:underline">
                  {p.title}
                </Link>
                {pool === "vraag" && p.answered && <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs text-muted">beantwoord</span>}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {p.author}
                {p.publishedAt && ` · ${p.publishedAt}`}
                {p.takes.length > 0 && ` · ${p.takes.length === 1 ? "demo" : `${p.takes.length} demo's`}`}
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

async function Demo({ group, assets, opts }: { group: string; assets: AssetRecord[]; opts: PatchesOptions }) {
  const audio = assets.find((a) => a.file.kind === "audio");
  if (!audio) return <p className="text-sm text-muted">Demo “{group}”: geen opname gevonden (of niet voor jou zichtbaar).</p>;
  if (opts.demo) return <>{await opts.demo(audio, group)}</>;
  return (
    <div>
      <audio controls preload="none" src={assetRefUrl(`asset:${audio.slug}`) ?? undefined} className="w-full" />
      <p className="mt-1 text-xs text-muted">{audio.title || group}</p>
    </div>
  );
}

async function PatchView({ patch, parent, children, demos, opts }: { patch: Patch; parent: Patch | null; children: Patch[]; demos: { group: string; assets: AssetRecord[] }[]; opts: PatchesOptions }) {
  const back = LISTS.find((l) => l.pool === patch.pool) ?? LISTS[0]!;
  const file = assetRefUrl(patch.file);
  const syx = patch.syx ? assetRefUrl(patch.syx) : null;
  return (
    <article className="max-w-3xl">
      <Link href={back.href()} className="text-sm text-muted hover:underline">
        ← {back.title}
      </Link>
      <p className="mt-4 text-xs text-muted">
        Patch · {POOL_LABELS[patch.pool]}
        {patch.author && ` · ${patch.author}`}
        {patch.publishedAt && ` · ${patch.publishedAt}`} · {LICENSE_LABELS[patch.license]}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{patch.title}</h1>
      <div className="mt-3">
        <Tags tags={patch.tags} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {opts.editorUrl && (
          <a href={`${opts.editorUrl}?patch=${encodeURIComponent(patch.slug)}`} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong">
            Open in de editor
          </a>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">De vraag{patch.answered && " · beantwoord"}</h2>
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
        <h2 className="text-xl font-semibold">Vereist</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Editor</dt>
          <dd>
            {patch.requires.editorVersion}
            {patch.requires.editorBuild && <span className="text-muted"> ({patch.requires.editorBuild})</span>}
          </dd>
          <dt className="text-muted">Firmwarecontract</dt>
          <dd>{patch.requires.firmwareContract}</dd>
          <dt className="text-muted">Modules</dt>
          <dd>{patch.requires.moduleTypes.length > 0 ? patch.requires.moduleTypes.join(", ") : "—"}</dd>
        </dl>
      </section>
      {(parent || children.length > 0) && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Stamboom</h2>
          {parent && (
            <p className="mt-2 text-sm">
              Afgeleid van{" "}
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
                  <span className="text-muted">({POOL_LABELS[c.pool]})</span>
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
    return {
      render: <PatchView patch={patch} parent={parent} children={children} demos={demos} opts={opts} />,
      metadata: { title: patch.title, description: (patch.description || patch.question || "").slice(0, 160) },
      item: { type: "patch", slug: patch.slug },
    };
  };
}

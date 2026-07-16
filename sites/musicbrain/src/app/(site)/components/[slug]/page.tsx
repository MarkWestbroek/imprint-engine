import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { store, writableStore } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { Markdown } from "@/components/markdown";
import { BoardSpecView } from "@/components/board-spec-view";
import { DefaultView } from "@/components/default-view";
import { displayVersion } from "@/lib/format";

/**
 * Default view for a component (option B: one route per content type). Shows
 * the component, its sub-components (links), and the board-spec of each
 * version — the end of the product → release → component → board chain.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const components = await store.listComponents();
  return components.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const component = await store.getComponent(slug);
  if (!component) return {};
  return { title: component.name, description: component.description };
}

export default async function ComponentPage({ params }: Props) {
  const { slug } = await params;
  const opts = await readOpts();
  const component = await store.getComponent(slug, opts);
  if (!component) notFound();

  const specs: { version: string; spec: Awaited<ReturnType<typeof store.getBoardSpec>> }[] = [];
  for (const v of component.versions) {
    const spec = await store.getBoardSpec(v.spec ?? `${component.slug}@${v.number}`, opts);
    if (spec) specs.push({ version: v.number, spec });
  }

  // Reverse navigation: a component can sit in several products/releases.
  const products = writableStore
    ? (await writableStore.listItems("product")).filter((p) =>
        ((p.data as { components?: string[] }).components ?? []).includes(slug)
      )
    : [];
  const releases = writableStore
    ? (await writableStore.listItems("release")).filter((r) =>
        ((r.data as { components?: { component: string }[] }).components ?? []).some(
          (c) => c.component === slug
        )
      )
    : [];

  // Which version does "the site" consider current? The one pinned by the
  // newest release, with channel weighting: stable beats beta beats dev
  // (MMB-testcase assert 4 / vraag 4). Unpinned components keep the flat list.
  const channelRank: Record<string, number> = { stable: 0, beta: 1, dev: 2 };
  const pins = releases
    .map((r) => {
      const data = r.data as {
        project?: string;
        version?: string;
        date?: string;
        channel?: string;
        components?: { component: string; version: string }[];
      };
      const pin = (data.components ?? []).find((c) => c.component === slug);
      return pin
        ? {
            version: pin.version,
            channel: data.channel ?? "stable",
            date: data.date ?? "",
            project: data.project ?? r.slug,
            releaseVersion: data.version ?? "",
            releaseSlug: r.slug,
          }
        : null;
    })
    .filter((p) => p !== null);
  const bestPin = pins.sort(
    (a, b) =>
      (channelRank[a.channel] ?? 9) - (channelRank[b.channel] ?? 9) ||
      b.date.localeCompare(a.date)
  )[0];
  const pinnedSpec = bestPin ? specs.find((s) => s.version === bestPin.version) : undefined;
  const otherSpecs = pinnedSpec ? specs.filter((s) => s !== pinnedSpec) : specs;

  const fallback = (
    <article className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm text-muted">Component</p>
        <h1 className="text-3xl font-semibold tracking-tight">{component.name}</h1>
        {component.versions.length > 0 && (
          <p className="mt-1 font-mono text-sm text-muted">
            {component.versions.map((v, i) => (
              <span key={v.number}>
                {i > 0 && ", "}
                {bestPin?.version === v.number ? (
                  <strong className="text-accent">{v.number}</strong>
                ) : (
                  v.number
                )}
              </span>
            ))}
          </p>
        )}
      </header>

      {component.description && <Markdown>{component.description}</Markdown>}

      {(products.length > 0 || releases.length > 0) && (
        <section className="rounded-xl border border-line bg-surface p-4 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Used in
          </h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {products.length > 0 && (
              <div>
                <span className="text-muted">Products: </span>
                {products.map((p, i) => (
                  <span key={p.slug}>
                    {i > 0 && ", "}
                    <Link href={`/products/${p.slug}`} className="text-accent hover:underline">
                      {String((p.data as { name?: string }).name ?? p.slug)}
                    </Link>
                  </span>
                ))}
              </div>
            )}
            {releases.length > 0 && (
              <div>
                <span className="text-muted">Releases: </span>
                {releases.map((r, i) => (
                  <span key={r.slug}>
                    {i > 0 && ", "}
                    <Link href={`/releases/${r.slug}`} className="font-mono text-accent hover:underline">
                      {String((r.data as { project?: string }).project ?? r.slug)}{" "}
                      {displayVersion(String((r.data as { version?: string }).version ?? ""))}
                    </Link>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {component.children.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Sub-components</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {component.children.map((child) => (
              <li key={child}>
                <Link href={`/components/${child}`} className="text-accent hover:underline">
                  {child}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pinnedSpec?.spec && bestPin && (
        <section>
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Board {pinnedSpec.version}</h2>
            <Link
              href={`/releases/${bestPin.releaseSlug}`}
              className="rounded-full border border-accent px-2.5 py-0.5 font-mono text-xs text-accent hover:bg-accent/10"
            >
              pinned by {bestPin.project} {displayVersion(bestPin.releaseVersion)} ·{" "}
              {bestPin.channel}
            </Link>
          </header>
          <div className="mt-4">
            <BoardSpecView spec={pinnedSpec.spec} />
          </div>
        </section>
      )}

      {otherSpecs.length > 0 &&
        (pinnedSpec ? (
          <details className="group">
            <summary className="cursor-pointer text-xl font-semibold tracking-tight text-muted transition-colors hover:text-foreground">
              Other versions ({otherSpecs.length})
              <span className="ml-2 font-mono text-sm">
                {otherSpecs.map((s) => s.version).join(", ")}
              </span>
            </summary>
            <div className="mt-4 space-y-8">
              {otherSpecs.map(({ version, spec }) =>
                spec ? (
                  <section key={version}>
                    <h3 className="text-lg font-semibold tracking-tight">Board {version}</h3>
                    <div className="mt-4">
                      <BoardSpecView spec={spec} />
                    </div>
                  </section>
                ) : null
              )}
            </div>
          </details>
        ) : (
          otherSpecs.map(({ version, spec }) =>
            spec ? (
              <section key={version}>
                <h2 className="text-xl font-semibold tracking-tight">Board {version}</h2>
                <div className="mt-4">
                  <BoardSpecView spec={spec} />
                </div>
              </section>
            ) : null
          )
        ))}
    </article>
  );

  return (
    <DefaultView type="component" subject={component} title={component.name} fallback={fallback} />
  );
}

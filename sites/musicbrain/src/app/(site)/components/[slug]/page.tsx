import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { store, writableStore } from "@/lib/content";
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
  const component = await store.getComponent(slug);
  if (!component) notFound();

  const specs: { version: string; spec: Awaited<ReturnType<typeof store.getBoardSpec>> }[] = [];
  for (const v of component.versions) {
    const spec = await store.getBoardSpec(v.spec ?? `${component.slug}@${v.number}`);
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

  const fallback = (
    <article className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm text-muted">Component</p>
        <h1 className="text-3xl font-semibold tracking-tight">{component.name}</h1>
        {component.versions.length > 0 && (
          <p className="mt-1 font-mono text-sm text-muted">
            {component.versions.map((v) => v.number).join(", ")}
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

      {specs.map(({ version, spec }) =>
        spec ? (
          <section key={version}>
            <h2 className="text-xl font-semibold tracking-tight">Board {version}</h2>
            <div className="mt-4">
              <BoardSpecView spec={spec} />
            </div>
          </section>
        ) : null
      )}
    </article>
  );

  return (
    <DefaultView type="component" subject={component} title={component.name} fallback={fallback} />
  );
}

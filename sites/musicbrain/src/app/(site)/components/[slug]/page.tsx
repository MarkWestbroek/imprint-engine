import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import { BoardSpecView } from "@/components/board-spec-view";

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

  return (
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
}

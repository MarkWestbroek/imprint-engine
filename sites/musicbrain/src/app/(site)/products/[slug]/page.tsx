import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { BoardSpec, Component } from "@imprint/content-core";
import { store, writableStore } from "@/lib/content";
import { StatusBadge } from "@/components/status-badge";
import { Markdown } from "@/components/markdown";
import { BoardSpecView } from "@/components/board-spec-view";

type Props = { params: Promise<{ slug: string }> };

/** A component plus any board-specs found for its versions. */
async function loadComponent(
  slug: string
): Promise<{ component: Component; specs: { version: string; spec: BoardSpec }[] } | null> {
  const component = await store.getComponent(slug);
  if (!component) return null;
  const specs: { version: string; spec: BoardSpec }[] = [];
  for (const v of component.versions) {
    const spec = await store.getBoardSpec(v.spec ?? `${component.slug}@${v.number}`);
    if (spec) specs.push({ version: v.number, spec });
  }
  return { component, specs };
}

export async function generateStaticParams() {
  const products = await store.listProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await store.getProduct(slug);
  if (!product) return {};
  return { title: product.name, description: product.tagline };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await store.getProduct(slug);
  if (!product) notFound();

  // Releases of this product, with their slugs (to link to /releases/<slug>).
  const releases = writableStore
    ? (await writableStore.listItems("release"))
        .filter((r) => (r.data as { product?: string }).product === product.slug)
        .map((r) => ({ slug: r.slug, data: r.data as { version: string; date: string; channel: string } }))
    : [];
  const components = (
    await Promise.all(product.components.map(loadComponent))
  ).filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <article className="max-w-3xl space-y-10">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
          <StatusBadge status={product.status} />
        </div>
        <p className="mt-2 text-lg text-muted">{product.tagline}</p>
      </header>

      {product.description && <Markdown>{product.description}</Markdown>}

      {product.specs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Specs</h2>
          <table className="mt-4 w-full border-collapse text-sm">
            <tbody>
              {product.specs.map((spec) => (
                <tr key={spec.label} className="border-b border-line">
                  <th className="w-40 py-2.5 pr-4 text-left align-top font-medium text-muted">
                    {spec.label}
                  </th>
                  <td className="py-2.5">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {components.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Components</h2>
          <div className="mt-4 space-y-4">
            {components.map(({ component, specs }) => (
              <div key={component.slug} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    <Link href={`/components/${component.slug}`} className="hover:text-accent">
                      {component.name}
                    </Link>
                  </h3>
                  {component.versions.length > 0 && (
                    <span className="font-mono text-xs text-muted">
                      {component.versions.map((v) => v.number).join(", ")}
                    </span>
                  )}
                </div>
                {component.description && (
                  <p className="mt-1 text-sm text-muted">{component.description}</p>
                )}
                {specs.map(({ version, spec }) => (
                  <details key={version} className="mt-3">
                    <summary className="cursor-pointer text-sm text-accent">
                      Board {version}
                    </summary>
                    <div className="mt-3">
                      <BoardSpecView spec={spec} compact />
                    </div>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {releases.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Releases</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {releases.map((r) => (
              <li key={r.slug}>
                <Link href={`/releases/${r.slug}`} className="font-mono text-accent hover:underline">
                  v{r.data.version}
                </Link>
                <span className="text-muted"> · {r.data.date} · {r.data.channel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

import Link from "next/link";
import type { BoardSpec, Component, Product, ReadOptions } from "@imprint/content-core";
import { store, writableStore } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import { BoardSpecView } from "@/components/board-spec-view";
import { displayVersion, kindLabel } from "@/lib/format";

/**
 * The product page's sections as shared server components: the hand-coded
 * fallback page AND the subject-widgets (subjectheader, spectable,
 * components, releases-in-product-mode) render through these — so an
 * editable _view/product looks identical to the built-in page by
 * construction, not by copy-paste.
 */

/** Header: audience eyebrow, name + status badge, tagline, description. */
export function ProductHeader({
  product,
  title,
  showStatus = true,
  showTagline = true,
  showDescription = true,
}: {
  product: Product;
  title?: string;
  showStatus?: boolean;
  showTagline?: boolean;
  showDescription?: boolean;
}) {
  return (
    <div className="max-w-3xl space-y-10">
      <header>
        {product.audience && <p className="eyebrow mb-1">{product.audience}</p>}
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{title || product.name}</h1>
          {showStatus && product.status && <StatusBadge status={product.status} />}
        </div>
        {showTagline && product.tagline && (
          <p className="mt-2 text-lg text-muted">{product.tagline}</p>
        )}
      </header>
      {showDescription && product.description && <Markdown>{product.description}</Markdown>}
    </div>
  );
}

/** Specs as a label/value table; renders nothing when there are no specs. */
export function ProductSpecs({ product, title = "Specs" }: { product: Product; title?: string }) {
  if ((product.specs ?? []).length === 0) return null;
  return (
    <section className="max-w-3xl">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
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
  );
}

/** A component plus any board-specs found for its versions. */
export async function loadComponent(
  slug: string,
  opts?: ReadOptions
): Promise<{ component: Component; specs: { version: string; spec: BoardSpec }[] } | null> {
  const component = await store.getComponent(slug, opts);
  if (!component) return null;
  const specs: { version: string; spec: BoardSpec }[] = [];
  for (const v of component.versions) {
    const spec = await store.getBoardSpec(v.spec ?? `${component.slug}@${v.number}`, opts);
    if (spec) specs.push({ version: v.number, spec });
  }
  return { component, specs };
}

/** The product's components, board-specs collapsed. Loads its own data. */
export async function ProductComponents({
  product,
  title = "Components",
  showBoards = true,
  opts,
}: {
  product: Product;
  title?: string;
  showBoards?: boolean;
  opts?: ReadOptions;
}) {
  const components = (
    await Promise.all((product.components ?? []).map((c) => loadComponent(c, opts)))
  ).filter((c): c is NonNullable<typeof c> => c !== null);
  if (components.length === 0) return null;

  return (
    <section className="max-w-3xl">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
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
            {showBoards &&
              specs.map(({ version, spec }) => (
                <details key={version} className="mt-3">
                  <summary className="cursor-pointer text-sm text-accent">
                    {kindLabel(spec.kind ?? component.kind)} {version}
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
  );
}

/** The product's releases, newest first, linking to their detail pages. */
export async function ProductReleases({
  product,
  title = "Releases",
}: {
  product: Product | { slug: string };
  title?: string;
}) {
  const releases = writableStore
    ? (await writableStore.listItems("release"))
        .filter((r) => (r.data as { product?: string }).product === product.slug)
        .map((r) => ({
          slug: r.slug,
          data: r.data as { project: string; version: string; date: string; channel: string },
        }))
        // Newest first (listItems is unsorted; the /releases page & widget already sort).
        .sort((a, b) => b.data.date.localeCompare(a.data.date))
    : [];
  if (releases.length === 0) return null;

  return (
    <section className="max-w-3xl">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {releases.map((r) => (
          <li key={r.slug}>
            {/* Project erbij (MMB-vraag 3): twee projecten kunnen hetzelfde
                versienummer voeren — zonder projectnaam is dat onleesbaar. */}
            <Link href={`/releases/${r.slug}`} className="font-mono text-accent hover:underline">
              {r.data.project} {displayVersion(r.data.version)}
            </Link>
            <span className="text-muted"> · {r.data.date} · {r.data.channel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

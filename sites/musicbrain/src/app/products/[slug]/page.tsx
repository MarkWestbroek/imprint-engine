import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { store } from "@/lib/content";
import { StatusBadge } from "@/components/status-badge";
import { Markdown } from "@/components/markdown";

type Props = { params: Promise<{ slug: string }> };

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

  const releases = await store.listReleases({ project: product.slug });

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

      {releases.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Releases</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {releases.map((r) => (
              <li key={r.version} className="font-mono">
                v{r.version} · {r.date} · {r.channel}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

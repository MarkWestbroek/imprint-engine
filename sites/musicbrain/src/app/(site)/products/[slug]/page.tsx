import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { DefaultView } from "@/components/default-view";
import {
  ProductComponents,
  ProductHeader,
  ProductReleases,
  ProductSpecs,
} from "@/components/product-sections";
import { Gallery } from "@/widgets/media-islands";

/**
 * Product page. The sections live in components/product-sections.tsx, shared
 * with the subject-widgets — so a studio-built _view/product reproduces this
 * page exactly, and edits there replace this fallback.
 */

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
  const opts = await readOpts();
  const product = await store.getProduct(slug, opts);
  if (!product) notFound();

  const fallback = (
    <article className="space-y-10">
      <ProductHeader product={product} />

      {product.media.length > 0 && (
        <section className="max-w-3xl">
          {/* W3: product photos/video — media[] rendered as a gallery. */}
          <Gallery images={product.media.map((src) => ({ src, alt: product.name }))} columns={3} />
        </section>
      )}

      <ProductSpecs product={product} />
      <ProductComponents product={product} opts={opts} />
      <ProductReleases product={product} />
    </article>
  );

  return (
    <DefaultView type="product" subject={product} title={product.name} fallback={fallback} />
  );
}

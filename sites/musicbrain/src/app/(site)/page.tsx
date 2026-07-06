import Link from "next/link";
import { store } from "@/lib/content";
import { StatusBadge } from "@/components/status-badge";

export default async function Home() {
  const [site, products, releases] = await Promise.all([
    store.getSiteConfig(),
    store.listProducts(),
    store.listReleases(),
  ]);
  const latest = releases[0];

  return (
    <div className="space-y-16">
      <section className="pt-8">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Open-source <span className="text-accent">brains</span> for your
          music rig.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          One family of MIDI hardware that routes, switches and controls
          everything on your board — with open firmware and a free editor &
          simulator.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/#products"
            className="rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-background hover:bg-accent"
          >
            Meet the family
          </Link>
          {site.links.github && (
            <a
              href={site.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-accent"
            >
              View on GitHub
            </a>
          )}
        </div>
      </section>

      <section id="products" className="scroll-mt-20">
        <h2 className="text-2xl font-semibold tracking-tight">The family</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <StatusBadge status={product.status} />
              </div>
              <p className="mt-2 text-sm text-muted">{product.tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      {latest && (
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Latest release</h2>
          <div className="mt-4 rounded-xl border border-line bg-surface p-5">
            <p className="font-mono text-sm text-accent">
              {latest.project} v{latest.version} · {latest.date}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted">
              {latest.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <Link
              href="/releases"
              className="mt-3 inline-block text-sm text-accent underline underline-offset-4"
            >
              All releases
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-xl font-semibold tracking-tight">Stay in the loop</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Newsletter signup (double opt-in) is coming with the first beta. For
          now, follow the repo on GitHub to get release notifications.
        </p>
      </section>
    </div>
  );
}

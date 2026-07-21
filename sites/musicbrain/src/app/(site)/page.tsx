import Link from "next/link";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { StatusBadge } from "@/components/status-badge";
import { displayVersion } from "@/lib/format";

export default async function Home() {
  const opts = await readOpts();
  const [site, products, releases] = await Promise.all([
    store.getSiteConfig(),
    store.listProducts(opts),
    store.listReleases(opts),
  ]);
  const latest = releases[0];

  return (
    <div className="space-y-16">
      <section className="pt-8">
        <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tighter sm:text-5xl">
          The open brain for your <span className="text-accent">analog</span>{" "}
          rig.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Pedalboards, amp racks and modular synths have one thing in common:{" "}
          <strong className="font-semibold text-foreground">they forget.</strong>{" "}
          Every setting, every routing, every patch — gone the moment you touch
          it. MusicBrain gives them memory. Your audio stays 100% analog; the
          brain speaks only relays, CV and gate.
        </p>
      </section>

      <section id="products" className="scroll-mt-20">
        {/* Scope-trace divider (gate/CV step-line) between hero and family. */}
        <svg
          viewBox="0 0 780 46"
          preserveAspectRatio="none"
          className="mb-8 h-10 w-full text-accent-2"
          aria-hidden
        >
          <line x1="0" y1="23" x2="780" y2="23" className="stroke-line" strokeWidth="1" />
          <path
            d="M0 36 H90 V10 H210 V36 H330 V10 H400 V36 H560 V18 H660 V36 H780"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.9"
          />
        </svg>
        <p className="eyebrow">One platform · three machines</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
            >
              <h3 className="text-lg font-bold tracking-tight">
                {product.audience && (
                  <span className="mb-1 block font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted">
                    {product.audience}
                  </span>
                )}
                {product.name}
              </h3>
              <p className="flex-1 text-sm text-muted">{product.tagline}</p>
              <StatusBadge status={product.status} />
            </Link>
          ))}
        </div>
      </section>

      {latest && (
        <section>
          <p className="eyebrow">Fresh from the bench</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Latest release</h2>
          <div className="mt-4 rounded-xl border border-line bg-surface p-5">
            <p className="font-mono text-sm text-accent">
              {latest.project} {displayVersion(latest.version)} · {latest.date}
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

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Try it before it exists.
          </h2>
          <p className="mt-2 text-sm text-muted">
            The{" "}
            <strong className="font-semibold text-foreground">
              free browser editor
            </strong>{" "}
            patches modules, turns knobs live and shows every CV on a built-in
            scope. No hardware yet? The{" "}
            <strong className="font-semibold text-foreground">simulator</strong>{" "}
            runs the exact same firmware core on your laptop.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Open, top to bottom.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Firmware, editor, schematics and protocols are{" "}
            <strong className="font-semibold text-foreground">
              MIT-licensed
            </strong>
            . No lock-in, no orphaned gear — extend it, port to it, fix it at 2
            a.m.{" "}
            {site.links.github && (
              <a
                href={site.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4"
              >
                Everything on GitHub
              </a>
            )}
            .
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-xl font-semibold tracking-tight">Stay in the loop</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Newsletter signup (double opt-in) is coming with the first beta. For
          now, watch the releases page — every update lands there first.
        </p>
      </section>
    </div>
  );
}

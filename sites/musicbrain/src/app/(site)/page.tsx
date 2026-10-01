import Link from "next/link";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { StatusBadge } from "@/components/status-badge";
import { displayVersion } from "@/lib/format";

export default async function Home() {
  const opts = await readOpts();
  const [site, products, releases] = await Promise.all([
    store.getSiteConfig(opts),
    store.listProducts(opts),
    store.listReleases(opts),
  ]);
  const latest = releases[0];

  return (
    <div className="space-y-16">
      <section className="pt-8">
        <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tighter sm:text-5xl">
          Playable instruments, <span className="text-accent">recallable</span>{" "}
          patches.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          MusicBrain is an open platform for playable instruments, recallable
          patches and musical control. Build and play modular patches in your
          browser, run shared DSP on a Teensy, and connect supported hardware
          through MIDI, CV, gates and relays.
        </p>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Keep external audio paths analog where your setup allows it, or
          combine them with digital synthesis, sampling and effects. Recall
          depends on the parameters and connections your hardware can control.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={site.links.editor ?? "/editor"}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong"
          >
            Open the editor
          </a>
          <Link
            href="/get-started"
            className="rounded-md border border-line px-5 py-2.5 text-sm font-semibold transition-colors hover:border-accent"
          >
            Get started
          </Link>
        </div>
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
        <p className="eyebrow">One platform · three directions</p>
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
          <Link
            href={`/releases/${latest.project}-${latest.version}`}
            className="mt-4 block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
          >
            <p className="font-mono text-sm text-accent">
              {latest.project} {displayVersion(latest.version)} · {latest.date}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted">
              {latest.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </Link>
          <Link
            href="/releases"
            className="mt-3 inline-block text-sm text-accent underline underline-offset-4"
          >
            All releases →
          </Link>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/editor"
          className="block rounded-xl border border-line bg-surface p-6 transition-colors hover:border-accent"
        >
          <h2 className="text-xl font-semibold tracking-tight">
            Play it in your browser.
          </h2>
          <p className="mt-2 text-sm text-muted">
            The{" "}
            <strong className="font-semibold text-foreground">
              editor &amp; simulator
            </strong>{" "}
            is usable today: assemble a rack, patch instruments and effects,
            and play — no hardware or account needed. The simulator runs the
            Teensy firmware&apos;s own DSP code as WebAssembly, so a patch
            sounds nearly the same when you move it to a Teensy.
          </p>
          <span className="mt-3 inline-block text-sm text-accent underline underline-offset-4">
            About the editor →
          </span>
        </Link>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Open, top to bottom.
          </h2>
          <p className="mt-2 text-sm text-muted">
            MusicBrain&apos;s own firmware, editor, schematics and protocols are{" "}
            <strong className="font-semibold text-foreground">
              MIT-licensed
            </strong>
            ; third-party libraries and assets keep their own licenses. No
            lock-in — extend it, port to it, fix it at 2 a.m.{" "}
            {site.links.github && (
              <a
                href={site.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4"
              >
                Source on GitHub
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

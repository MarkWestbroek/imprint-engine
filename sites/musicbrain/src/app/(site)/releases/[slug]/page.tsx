import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReleaseSchema, type ReadOptions, type Release } from "@imprint/content-core";
import { store, writableStore } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { Markdown } from "@/components/markdown";
import { DefaultView } from "@/components/default-view";
import { displayVersion } from "@/lib/format";

/**
 * Default view for a release. Links up to its product and down to each
 * component it ships (with the version), continuing the navigation chain.
 */

type Props = { params: Promise<{ slug: string }> };

/**
 * Releases are keyed by their stored slug; look it up directly in DB mode.
 * With `asOf` set (preview) the list-based path is used instead — getItem
 * only knows "current", listReleases can time travel.
 */
async function getRelease(slug: string, opts?: ReadOptions): Promise<Release | null> {
  if (writableStore && !opts?.asOf) {
    const item = await writableStore.getItem("release", slug);
    // Parse (not cast) so schema defaults fill fields older rows may lack.
    return item ? ReleaseSchema.parse(item.data) : null;
  }
  const all = await store.listReleases(opts);
  return all.find((r) => `${r.project}-${r.version}` === slug) ?? null;
}

export async function generateStaticParams() {
  if (!writableStore) return [];
  const items = await writableStore.listItems("release");
  return items.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const release = await getRelease(slug);
  if (!release) return {};
  return { title: `${release.project} ${displayVersion(release.version)}` };
}

export default async function ReleasePage({ params }: Props) {
  const { slug } = await params;
  const release = await getRelease(slug, await readOpts());
  if (!release) notFound();

  const fallback = (
    <article className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm text-muted">Release</p>
        <h1 className="font-mono text-3xl font-semibold tracking-tight">
          {release.project} {displayVersion(release.version)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {release.date} · {release.channel}
          {release.product && (
            <>
              {" · "}
              <Link href={`/products/${release.product}`} className="text-accent hover:underline">
                {release.product}
              </Link>
            </>
          )}
        </p>
      </header>

      {release.highlights.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {release.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      {release.body && <Markdown>{release.body}</Markdown>}

      {release.components.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Components</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {release.components.map((c) => (
              <li key={c.component} className="flex items-baseline gap-2">
                <Link href={`/components/${c.component}`} className="text-accent hover:underline">
                  {c.component}
                </Link>
                <span className="font-mono text-xs text-muted">{c.version}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );

  return (
    <DefaultView
      type="release"
      subject={release}
      title={`${release.project} ${displayVersion(release.version)}`}
      fallback={fallback}
    />
  );
}

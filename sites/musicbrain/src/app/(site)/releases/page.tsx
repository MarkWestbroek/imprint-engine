import type { Metadata } from "next";
import Link from "next/link";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { Markdown } from "@/components/markdown";
import { displayVersion } from "@/lib/format";

export const metadata: Metadata = {
  title: "Releases",
  description: "Firmware, editor and simulator releases.",
};

export default async function ReleasesPage() {
  const releases = await store.listReleases(await readOpts());

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Releases</h1>
      <p className="mt-2 text-muted">
        Every release of the firmware, editor and simulator. Fed from GitHub —
        this list never goes stale.
      </p>

      <div className="mt-8 space-y-6">
        {releases.map((release) => (
          <article
            key={`${release.project}-${release.version}`}
            className="rounded-xl border border-line bg-surface p-5"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-lg font-semibold text-accent">
                <Link
                  href={`/releases/${release.project}-${release.version}`}
                  className="hover:underline"
                >
                  {release.project} {displayVersion(release.version)}
                </Link>
              </h2>
              <p className="text-sm text-muted">
                {release.date} · {release.channel}
              </p>
            </header>
            {release.highlights.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm">
                {release.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            {release.body && (
              <div className="mt-3 text-sm text-muted">
                <Markdown>{release.body}</Markdown>
              </div>
            )}
            {release.downloads.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {release.downloads.map((d) => (
                  <li key={d.url}>
                    <a href={d.url} className="text-accent underline underline-offset-4">
                      {d.label}
                    </a>
                    {d.checksumSha256 && (
                      <span className="ml-2 font-mono text-xs text-muted">
                        sha256:{d.checksumSha256.slice(0, 12)}…
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {release.sourceUrl && (
              <a
                href={release.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-muted underline underline-offset-4 hover:text-foreground"
              >
                View on GitHub
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

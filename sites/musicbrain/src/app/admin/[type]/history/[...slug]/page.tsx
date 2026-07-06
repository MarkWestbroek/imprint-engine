import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContentType } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { restoreVersionAction } from "../../../actions";

const CONTENT_TYPES: ContentType[] = ["site", "product", "release", "page", "menu"];

type Props = {
  params: Promise<{ type: string; slug: string[] }>;
  searchParams: Promise<{ lang?: string }>;
};

function fmt(date: Date | null): string {
  return date ? date.toISOString().slice(0, 19).replace("T", " ") : "—";
}

/** The bitemporal payoff (S4): every assertion ever made, roll back freely. */
export default async function AdminHistory({ params, searchParams }: Props) {
  const { type, slug: slugParts } = await params;
  const { lang } = await searchParams;
  if (!CONTENT_TYPES.includes(type as ContentType)) notFound();
  const slug = slugParts.map(decodeURIComponent).join("/");
  const versions = await writableStore!.listVersions(
    type as ContentType,
    slug,
    lang ?? "en"
  );
  if (versions.length === 0) notFound();

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-muted">
        <Link href={`/admin/${type}`} className="hover:text-foreground">
          ← {type}s
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        History: <span className="font-mono">{slug}</span>
      </h1>
      <p className="mt-1 text-sm text-muted">
        Newest first. Restore asserts the content of that version again as a
        new version — history itself is never rewritten.
      </p>

      <div className="mt-6 space-y-4">
        {versions.map((v) => {
          const current = v.txTo === null;
          return (
            <article
              key={v.id}
              className={`rounded-xl border p-4 ${
                current ? "border-accent bg-surface" : "border-line"
              }`}
            >
              <header className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {current ? (
                    <span className="mr-2 rounded-full border border-accent px-2 py-0.5 text-xs text-accent">
                      current
                    </span>
                  ) : (
                    <span className="mr-2 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                      superseded {fmt(v.txTo)}
                    </span>
                  )}
                  <span className="text-muted">
                    asserted {fmt(v.txFrom)} by {v.createdBy ?? "?"} · valid{" "}
                    {fmt(v.validFrom)} → {v.validTo ? fmt(v.validTo) : "∞"}
                  </span>
                </span>
                {!current && (
                  <form action={restoreVersionAction}>
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="lang" value={v.lang} />
                    <input type="hidden" name="id" value={v.id} />
                    <button className="rounded border border-line px-2 py-1 text-sm hover:border-accent">
                      Restore
                    </button>
                  </form>
                )}
              </header>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted">Data</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-background p-3 font-mono text-xs">
                  {JSON.stringify(v.data, null, 2)}
                </pre>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}

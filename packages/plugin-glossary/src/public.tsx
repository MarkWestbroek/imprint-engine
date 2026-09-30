import Link from "next/link";
import { ANONYMOUS, contentResource, permit, userSubject } from "@imprint/content-core";
import { Markdown, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import { getTerm } from "./glossary";
import { TERM_PREFIX, termSummary } from "./href";
import type { Term } from "./schemas";

function TermView({ term, indexHref }: { term: Term; indexHref?: string }) {
  return (
    <article className="max-w-3xl">
      {indexHref && (
        <Link href={indexHref} className="text-sm text-muted hover:underline">
          ← Alle termen
        </Link>
      )}
      <p className="mt-4 text-xs text-muted">Term</p>
      <h1 className="text-3xl font-semibold tracking-tight">{term.title}</h1>
      <div className="markdown mt-6">
        <Markdown>{term.body || term.summary}</Markdown>
      </div>
      {term.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
          {term.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-line px-3 py-0.5 text-sm text-muted">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * The page of a term: `/terms/<slug>`. Public terms render in the prerendered
 * catch-all; a restricted term goes to /members, where the PDP decides for
 * the session at hand (as the wiki does, design/fase-3 §4.3).
 */
export function glossaryPublicRoute(indexHref?: string) {
  return async ({ imprint, slug, members, session }: PublicRouteContext): Promise<PublicRouteResult | null> => {
    const store = imprint.writableStore;
    if (!store || slug.length !== 2 || slug[0] !== TERM_PREFIX) return null;
    const term = await getTerm(store, slug[1]!);
    if (!term) return null;
    if (term.access !== "public") {
      if (!members) return { redirect: `/members/${slug.join("/")}` };
      const subject = session ? userSubject(session.name, session.role) : ANONYMOUS;
      if (!(await permit(imprint.pdp, subject, "read", contentResource("term", term.slug, term)))) return null;
    }
    return {
      render: <TermView term={term} indexHref={indexHref} />,
      metadata: { title: term.title, description: termSummary(term, 160) },
    };
  };
}

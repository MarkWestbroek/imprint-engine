import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

/**
 * "Een website laten bouwen met Imprint": what Imprint can and cannot do, for
 * people who want a site and for the AI assistant that helps them write the
 * requirements. One source: public/voor-opdrachtgevers.md, served as-is at
 * /voor-opdrachtgevers.md (for a Claude project) and rendered here.
 */

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Een website laten bouwen — Imprint",
  description: "Wat Imprint kan en niet kan, met een sjabloon voor de eisen: voor opdrachtgevers en hun AI-assistent.",
};

const FILE = "/voor-opdrachtgevers.md";
/** The same document in three languages; the AI assistant answers in its user's language anyway. */
const DOWNLOADS = [
  { href: FILE, lang: "nl", label: "Nederlands" },
  { href: "/voor-opdrachtgevers.en.md", lang: "en", label: "English" },
  { href: "/voor-opdrachtgevers.pl.md", lang: "pl", label: "Polski" },
];

export default function VoorOpdrachtgeversPage() {
  const source = readFileSync(path.join(process.cwd(), "public", FILE), "utf8");
  // The title and intro line come from the page hero; the rest from the file.
  const body = source.replace(/^# .*\n+(\*[^\n]*\n[^\n]*\*\n+)?/, "");
  return (
    <>
      <SiteHeader />
      <main className="page-main">
        <section className="page-hero">
          <div className="hero-grid" aria-hidden="true" />
          <p className="kicker">Voor opdrachtgevers</p>
          <h1>Een website laten bouwen met Imprint.</h1>
          <p>
            Wat er kan, wat maatwerk is en wat niet kan, met een sjabloon voor je eisen. Geschreven voor jou én voor de
            AI-assistent die je helpt.
          </p>
        </section>
        <div className="content-page">
          <aside className="assistant-note">
            <p>
              <strong>Werk je met Claude?</strong> Download dit document en zet het in een <em>Project</em> bij de
              projectkennis. Dan kent elk gesprek in dat project de mogelijkheden van Imprint, en helpt Claude je het
              sjabloon onderaan in te vullen. Met een andere assistent: plak het document aan het begin van het gesprek. Ook in het Engels en Pools.
            </p>
            <div className="assistant-downloads">
              {DOWNLOADS.map((d) => (
                <a key={d.href} className="button button-dark" href={d.href} download hrefLang={d.lang}>
                  <Download size={16} /> {d.label}
                </a>
              ))}
            </div>
          </aside>
          <article className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

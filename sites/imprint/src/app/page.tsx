import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-stamp" aria-hidden="true">
            <BrandMark />
          </div>
          <p className="kicker reveal">Publiceren zonder eenheidsworst</p>
          <h1 className="reveal reveal-delay-1">Eén motor voor sites met een <em>eigen gezicht.</em></h1>
          <p className="hero-copy reveal reveal-delay-2">
            Imprint geeft zelfstandige merk- en productsites een gedeelde basis
            voor content, vormgeving en historie, zonder ze op elkaar te laten lijken.
          </p>
          <div className="hero-actions reveal reveal-delay-3">
            <Link className="button button-primary" href="/mogelijkheden">
              Ontdek Imprint <ArrowRight size={17} />
            </Link>
            <a className="text-link" href="https://musicbrain.nl">
              Bekijk eerste imprint <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="hero-proof reveal reveal-delay-3">
            <span><Check size={15} /> Visuele studio</span>
            <span><Check size={15} /> Volledige historie</span>
            <span><Check size={15} /> API-first</span>
          </div>
        </section>

        <section className="route-cards" aria-label="Ontdek Imprint">
          <Link href="/mogelijkheden"><span>01</span><h2>Wat kan Imprint?</h2><p>Van visuele paginaopbouw tot versiehistorie en API.</p><ArrowRight /></Link>
          <Link href="/praktijk"><span>02</span><h2>Hoe werkt het echt?</h2><p>MusicBrain als eerste draaiende imprint.</p><ArrowRight /></Link>
          <Link href="/merk"><span>03</span><h2>Het merk</h2><p>Logo, kleuren en de twee alternatieve richtingen.</p><ArrowRight /></Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { BrandMark, ColophonMark, MultiplicityMark } from "@/components/brand-mark";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = { title: "Merkvoorstellen — Imprint" };

export default function MerkPage() {
  return <><SiteHeader /><main className="page-main">
    <section className="page-hero"><div className="hero-grid" aria-hidden="true" /><p className="kicker">Het merk</p><h1>Een afdruk die ruimte laat.</h1><p>Imprint is de drager, niet de huisstijl van iedere site. Het merk moet herkenbaar zijn zonder zijn imprints te overschreeuwen.</p></section>
    <section className="brand-proposals"><div className="section-intro"><p className="kicker">Logo-onderzoek</p><h2>Drie manieren om een afdruk achter te laten.</h2><p>Registerdruk is op deze site toegepast. De andere twee blijven zichtbaar als ontwerpalternatieven.</p></div><div className="proposal-grid">
      <article className="proposal selected"><div className="proposal-mark"><BrandMark /></div><div className="proposal-meta"><span>A · voorkeur</span><b>Registerdruk</b></div><p>Twee verschoven afdrukken vormen samen een scherpe I. Herhaalbaar, gelaagd en herkenbaar op klein formaat.</p></article>
      <article className="proposal"><div className="proposal-mark"><ColophonMark /></div><div className="proposal-meta"><span>B</span><b>Colofon</b></div><p>Een compact uitgeverszegel. Gezaghebbend en redactioneel, met een iets klassiekere uitstraling.</p></article>
      <article className="proposal"><div className="proposal-mark"><MultiplicityMark /></div><div className="proposal-meta"><span>C</span><b>Veelvoud</b></div><p>Dezelfde drager in meerdere posities. Vertelt het multi-siteverhaal direct, maar is drukker als favicon.</p></article>
    </div></section>
    <section className="closing"><BrandMark className="closing-mark" /><p className="kicker">Imprint is in ontwikkeling</p><h2>Registerdruk is het voorstel om verder uit te werken.</h2><a className="button button-primary" href="https://github.com/MarkWestbroek/imprint-engine/tree/main/sites/imprint/public/brand">Bekijk de SVG&apos;s <ArrowUpRight size={17} /></a></section>
  </main><SiteFooter /></>;
}

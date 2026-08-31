import type { Metadata } from "next";
import { ArrowUpRight, CalendarClock, GitBranch, Palette, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = { title: "In de praktijk — Imprint" };

export default function PraktijkPage() {
  return <><SiteHeader /><main className="page-main">
    <section className="page-hero"><div className="hero-grid" aria-hidden="true" /><p className="kicker">In de praktijk</p><h1>Gebouwd vanuit een echt product.</h1><p>MusicBrain is geen demo-content, maar de eerste site die dagelijks op Imprint draait.</p></section>
    <section className="practice">
      <div className="practice-copy"><p className="kicker">Eerste imprint · live</p><h2>MusicBrain publiceert het product én zijn onderliggende systeem.</h2><p>Hardwarecomponenten, releases, borddocumentatie en 3D-modellen komen samen in één site. Producttools leveren data aan; redacteuren maken er een begrijpelijk verhaal van.</p><a className="button button-dark" href="https://musicbrain.nl">Bezoek musicbrain.nl <ArrowUpRight size={17} /></a></div>
      <div className="practice-visual" aria-hidden="true"><div className="release-chip"><CalendarClock size={18} /> release 0.10</div><div className="system-map"><span className="node core">MusicBrain</span><span className="node node-a">Cortex</span><span className="node node-b">ADC8</span><span className="node node-c">Matrix</span><span className="node node-d">Editor</span><svg viewBox="0 0 480 330"><path d="M240 165L100 75M240 165L375 70M240 165L390 250M240 165L90 255" /></svg></div></div>
    </section>
    <section className="principles"><p className="kicker">Ontwerpprincipes</p><div className="principle-grid"><article><ShieldCheck /><h3>Betrouwbaar</h3><p>Validatie, relaties en historie zijn onderdeel van de motor, niet van goede bedoelingen.</p></article><article><Palette /><h3>Eigenzinnig</h3><p>Iedere imprint heeft een eigen catalogus, thema en presentatie. De motor dicteert geen huisstijl.</p></article><article><GitBranch /><h3>Uitwisselbaar</h3><p>Sites en externe projecten praten via een helder contentcontract met dezelfde bron.</p></article></div></section>
  </main><SiteFooter /></>;
}

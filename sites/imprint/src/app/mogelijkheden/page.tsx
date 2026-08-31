import type { Metadata } from "next";
import { Blocks, GitBranch, History, LayoutDashboard, Palette, PanelsTopLeft, Sparkles, Workflow } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = { title: "Mogelijkheden — Imprint" };

const capabilities = [
  { icon: PanelsTopLeft, number: "01", title: "Bouwen in de echte pagina", copy: "Redacteuren combineren rijen, vakken en widgets in een visuele studio. Geen abstract formulier, maar direct het resultaat." },
  { icon: Workflow, number: "02", title: "Inhoud die samenhangt", copy: "Producten, componenten, releases, wiki's en pagina's delen één gevalideerd contentmodel en weten naar elkaar te verwijzen." },
  { icon: History, number: "03", title: "Elke versie blijft bestaan", copy: "Iedere save schrijft geschiedenis. Bekijk de site op een ander moment, plan vooruit of herstel een eerdere versie." },
  { icon: GitBranch, number: "04", title: "Open voor andere systemen", copy: "Projecten kunnen hun eigen releases en documentatie publiceren via de API, zonder de redactie buitenspel te zetten." },
];

export default function MogelijkhedenPage() {
  return <><SiteHeader /><main className="page-main">
    <section className="page-hero"><div className="hero-grid" aria-hidden="true" /><p className="kicker">Mogelijkheden</p><h1>De pagina is de werkplek.</h1><p>Imprint brengt visuele redactie, gestructureerde content en betrouwbare historie samen.</p></section>
    <section className="studio-band compact-band">
      <div className="section-intro light"><p className="kicker">Dit is geen klassiek CMS</p><h2>Werk direct in het resultaat.</h2><p>Een team bouwt betekenisvolle pagina&apos;s uit echte content, precies in de vormgeving waarin bezoekers die straks zien.</p></div>
      <div className="studio-scene" aria-label="Conceptuele weergave van de Imprint-studio">
        <aside className="studio-rail"><div className="rail-dot active"><LayoutDashboard size={18} /></div><div className="rail-dot"><Blocks size={18} /></div><div className="rail-dot"><Palette size={18} /></div></aside>
        <div className="studio-panel"><div className="panel-top"><span>Paginaopbouw</span><Sparkles size={16} /></div><div className="field-label">Geselecteerde widget</div><div className="field-value">Producten</div><div className="field-label">Weergave</div><div className="segmented"><span className="selected">Raster</span><span>Lijst</span></div><div className="field-label">Aantal</div><div className="range"><span /></div><button type="button">Wijzigingen opslaan</button></div>
        <div className="studio-canvas"><div className="canvas-browser"><i /><i /><i /><span>ateliernoord.nl / collectie</span></div><div className="canvas-page"><p>Nieuwe collectie</p><h3>Objecten met een verhaal.</h3><div className="canvas-products"><div><span>01</span><b>Fold chair</b></div><div><span>02</span><b>Arc lamp</b></div><div><span>03</span><b>Line table</b></div></div></div><div className="selection-label">Products · raster</div></div>
      </div>
    </section>
    <section className="capabilities"><div className="section-intro"><p className="kicker">Eén samenhangend systeem</p><h2>Meer dan pagina&apos;s vullen.</h2></div><div className="capability-list">{capabilities.map(({ icon: Icon, number, title, copy }) => <article key={number}><span className="cap-number">{number}</span><Icon className="cap-icon" size={25} strokeWidth={1.7} /><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
  </main><SiteFooter /></>;
}

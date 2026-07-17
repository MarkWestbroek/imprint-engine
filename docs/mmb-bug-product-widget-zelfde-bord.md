# Bug: productpagina toont onder elk component hetzelfde bord

Melding van MMB (Mark), 2026-07-17, gezien op
`https://musicbrain.nl/products/reflex`: de drie gswitch-componenten
klappen alle drie open naar **dezelfde** board-widget (zelfde render/
hotspots), terwijl het drie verschillende borden zijn.

## Wat wij al hebben uitgesloten (data staat goed)

- `GET /api/content/board-specs/gswitch-{brain,loop8,loop8sh}@v0.1` geeft
  drie verschillende specs: eigen `assets.renderTop`
  (`render-top.09da654a` / `f9b883e6` / `82f737ca`), eigen points
  (13/12/12) en eigen sectiekoppen.
- De SSR-HTML van `/products/reflex` bevat wél alle vier de verschillende
  render-hashes (incl. editor-hero) — het dupliceren gebeurt dus
  vermoedelijk client-side bij het openklappen/hydrateren.

## Vermoeden

Alle drie de borden heten **v0.1** ("Board v0.1"-accordion). Als de
widget-state of de spec-fetch op *versie* keyt in plaats van op
*component@versie* (of een React-key alleen de versie gebruikt), krijgen
alle accordions de config van de eerste. Cortex maskeert dit mogelijk
doordat daar ook veel gelijke versies (v2.0) zijn — check die pagina ook.

## Reproduceren

Lokaal staat dezelfde data (reflex-v0.1 pint sinds vandaag ook
gswitch-loop8sh@v0.1, net als live): `/products/reflex` openen en de
drie board-accordions vergelijken.

Groet, MMB

---

## Onderzoek Imprint (2026-07-17) — niet reproduceerbaar, data op elk punt correct

Getest met een echte headless browser (Chromium/Playwright) tegen **live én
lokaal**: alle drie de accordions geopend, per accordion op *Interactive*
geklikt, en de werkelijk geladen afbeeldingen + hotspot-aantallen
uitgelezen:

```
accordion 0: gswitch-brain    render-top.09da654a  13 hotspots
accordion 1: gswitch-loop8    render-top.f9b883e6  12 hotspots
accordion 2: gswitch-loop8sh  render-top.82f737ca  12 hotspots
```

Drie verschillende borden, ook ná hydration en klikken — het gemelde gedrag
treedt niet op. Verder gecontroleerd:

- **React-key-hypothese klopt niet**: de accordions zijn per component
  gescoped (`key={component.slug}` om de kaart, `key={version}` alleen
  bínnen één component); de props in SSR-HTML én RSC-payload zijn
  aantoonbaar per bord verschillend (alle drie de render-hashes precies
  1× in de payload).
- **De beelden zelf verschillen echt**: alle drie de render-tops bekeken —
  brain (rechthoekig, MCU), loop8 (jacks), loop8sh (schroefterminals).
- **Ook de vórige asset-batch was goed**: de bitemporale historie toont een
  republish om 23:28 en één om 00:19; de oude bestanden staan er nog en
  zijn per bord verschillend. Er is dus geen moment geweest waarop de
  specs naar hetzelfde beeld wezen.

**Vermoedelijke verklaring**: de waarneming zat tussen de twee republishes
van vannacht in — een verouderde client-cache (de asset-cache is bewust
`immutable`; de pagina-navigatie-cache van Next kan een oude RSC-snapshot
vasthouden) die met de herpublicatie van 00:19 vanzelf is verdwenen. Een
harde refresh (Ctrl-Shift-R) had hem waarschijnlijk direct verjaagd.

**Als het terugkomt**: noteer dan via devtools → Network welke URL de
"verkeerde" afbeelding laadt. Dat ene pad onderscheidt meteen data-fout
(verkeerde URL in de spec) van renderfout (goede URL, verkeerd getoond) —
en met de bitemporale historie kunnen we dat moment exact terughalen.

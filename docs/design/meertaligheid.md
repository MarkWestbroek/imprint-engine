# Ontwerp — meertaligheid (W5/S9): vooral hóe te beheren

Status: **denkstuk**, juli 2026. Nog niet gebouwd; backlog §5. Dit stuk gaat
over de beheerkant — het fundament (elk item heeft `lang`, EN-fallback in
beide stores, `?lang=` op de API) bestaat al.

## Uitgangspunten

1. **Een vertaling is een eigen content-item**: zelfde `type` + `slug`, ander
   `lang`. Dat model bestaat al en blijft — het geeft vertalingen gratis hun
   eigen bitemporale historie.
2. **EN is de bronwaarheid**; NL (en later meer) zijn afgeleiden. Ontbreekt
   een vertaling, dan valt de site terug op EN (doet hij al).
3. Technische velden (component-`versions`, board-`connectors`, `assets`,
   kleurtokens) zijn taal-onafhankelijk; alleen proza verschilt per taal.

## Beheer in de admin (de kern)

**a. Taalschakelaar in de item-editor.** Tabs `EN | NL` boven het formulier.
De NL-tab toont de vertaling als die bestaat, anders één knop:

> **"Vertaling maken"** — kopieert de actuele EN-data naar een nieuw record
> (`lang: nl`) en opent de editor. De redacteur vertaalt het proza en laat de
> technische velden staan.

**b. Vertaaldekking zichtbaar.** In de admin-lijsten per type een kolom
`NL: ✓ / —`; op het dashboard een teller ("14 van 23 items vertaald"). Geen
aparte tooling, gewoon een tweede `listItems`-query gegroepeerd op slug.

**c. Verouderde vertalingen — de bitemporale bonus.** Een vertaling is
*stale* als de EN-versie een nieuwere `txFrom` heeft dan de NL. Dat is één
vergelijking op data die we al opslaan. In de lijst: `NL: ⚠ verouderd`, in de
editor een diff-link ("EN is gewijzigd sinds deze vertaling: bekijk verschil"
— `listVersions` levert de oude EN waar de vertaling op gebaseerd is).
Dit is het punt waarop ons model iets kan dat de meeste CMS'en niet kunnen.

**d. Machine-content (MMB).** De ingest-API kan nu al `lang` meesturen; een
consumer die `sections` in twee talen genereert post gewoon twee keer. Geen
extra werk, wel documenteren in de ingest-gids.

**e. Wat bewust niet (nu):** veld-niveau-vertaling (item-per-taal is
simpeler en bestaat al) en automatische vertaling. Een knop "voorvertaal
(LLM)" past later netjes op de "Vertaling maken"-flow, maar is een eigen
beslissing (kosten, kwaliteit, wie controleert).

## Site-kant

- **URL-strategie: pad-prefix.** `/nl/...` voor NL, EN blijft zonder prefix
  (bestaande URL's veranderen niet, ook die op de silk-opdruk). Technisch:
  een optioneel `[lang]`-segment of een rewrite in `middleware`, dat
  `readOpts()` (bestaat al voor de as-of-preview) een `lang` meegeeft.
  Cookie-gebaseerde taalkeuze is uit den boze voor SEO — geen aparte URL's,
  geen `hreflang`.
- **Taal-switcher** in de header naast de themaswitcher; onthoudt niets
  (de URL ís de keuze).
- **SEO**: `hreflang`-alternates per pagina; alleen renderen als de vertaling
  echt bestaat (fallback-pagina's niet als NL aanmelden).
- **Menu's en thema's** zijn content, dus vertalen mee via hetzelfde
  mechanisme (thema's hoeven waarschijnlijk nooit).

## Fasering (voorstel)

| Fase | Wat | Maat |
|---|---|---|
| 1 | Admin: taaltabs + "Vertaling maken" + dekking-kolom | M |
| 2 | Site: `/nl/`-prefix + switcher + hreflang | M |
| 3 | Stale-detectie + diff-link (bitemporale bonus) | S |
| 4 | (optie) LLM-voorvertaling | apart besluit |

Fase 1 en 2 zijn onafhankelijk uitrolbaar; fase 1 eerst geeft redacteuren
alvast de flow terwijl de site nog EN-only toont.

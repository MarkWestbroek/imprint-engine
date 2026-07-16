# Changelog

Alle noemenswaardige wijzigingen aan de Imprint-engine. Formaat volgt losjes
[Keep a Changelog](https://keepachangelog.com/); versies volgen semver
(pre-1.0: **minor** = nieuwe capability, **patch** = fix). Zie
[docs/releasing.md](docs/releasing.md) voor het release-ritueel.

## [Unreleased]
- Lightroom-shares in de `album`-widget werken nu écht: de provider loopt de
  publieke share-API af (space → resources → album → renditions) en toont de
  volledige fotoset i.p.v. alleen een linkkaart. Geverifieerd met een echte
  share (11 foto's).
- Map-editor: coördinaten met decimalen zijn nu gewoon te typen (punt of
  komma); de controlled input at voorheen de punt op bij elke toetsaanslag.
- Carousel toont de hele foto (object-contain, letterboxed) i.p.v. een
  bijgesneden doorsnede.

## [0.8.0] - 2026-07-14
- Changelog + release-ritueel: `npm run release -- <versie>` (bumpt versies,
  verplaatst changelog-notities, commit + tag); zie `docs/releasing.md`.
- README: expliciete "Lokaal draaien (from scratch)"-sectie met vereisten
  (Node ≥ 20, draaiende Docker), de twee env-bestanden en de db:up → migrate →
  seed-volgorde uitgelegd.
- Db-container krijgt een healthcheck en `db:up` gebruikt `--wait`, zodat
  `db:migrate` er direct achteraan kan zonder opstart-race.
- Backlog (`docs/backlog.md`): open punten uit de README, de requirements en de
  bouwsessies op één plek.
- Zes nieuwe widgets: **gallery** (fotoraster met lightbox, kan de media van de
  pagina-subject meenemen), **carousel** (met auto-advance), **album** (view op
  een externe foto-repo: JSON-API of een Lightroom-share als best-effort/link-
  kaart), **map** (interactieve OpenStreetMap/Leaflet met markers en markdown-
  popups), **kanban** (kolommen met kaarten) en **itinerary** (de reis van
  componenten door de releases van een product).
- Custom editors voor de nieuwe widgets: fotorijen (gallery/carousel), markers
  (map) en een bord-editor (kanban, kaarten verplaatsen met pijltjes).
- Productpagina toont `product.media` als galerij (W3-foto's).

## [0.7.1] - 2026-07-14
- Asset-bestandsnamen krijgen een content-hash (`render-top.<sha8>.png`), zodat
  her-publiceren met nieuwe bytes een nieuwe URL geeft — de lange
  `immutable`-cache blijft correct én toont verse renders.
- Engine-versietags (v0.1.0–v0.7.0) retroactief gezet; package-versies
  gelijkgetrokken met de git-tags.

## [0.7.0] - 2026-07-14
- Navigatie: per-type pagina's (`/products`, `/components`, `/releases`) die het
  item als subject renderen; de keten product → release → component → board is
  klikbaar (en terug via "Used in" op de componentpagina).
- `template`-widget (Mustache merge fields) en `list`-widget (volgt de
  content-graaf) — de bouwstenen voor default-views.
- Studio-bewerkbare default-views per contenttype (`_view/<type>`-pagina's) met
  een "preview als"-keuze; hand-gecodeerde weergave blijft de fallback.
- Hybride board-view (statisch overzicht ↔ interactieve hotspots) met
  inklapbare connectors/pinouts.

## [0.6.0] - 2026-07-13
- `board-spec` end-to-end: eigen contenttype (connectors, nets, assets,
  secties), per ComponentVersion; multipart-ingest met de **AssetStore**
  (file-backend, MinIO/S3-klaar) en serveerroute; `BoardSpecView` +
  `boardspec`-widget; afleiding van een board-widget uit de spec.
- MMB-ingest-handleiding voor de consument.

## [0.5.0] - 2026-07-13
- Product/component/release-domein: componenten als herbruikbaar contenttype,
  releases met component-versies, afgeleide component-itinerary.
- Write-API voor product-projecten (token-geauth POST, los + bundle).
- Referentie-integriteit tussen contenttypen met een beheerscherm.
- `VersionNumber` als zelf-validerend datatype; widget-versie + help in het
  contract; inline-code in de editor.

## [0.4.0] - 2026-07-13
- Read-only content-API over dezelfde ContentStore.
- Widgetbibliotheek uitgebreid (table met grid-editor, image, callout/CTA,
  embed, board-annotations) en markdown-editor met live preview.
- Sticky studio-sidebar.

## [0.3.0] - 2026-07-12
- WYSIWYG-achtige studio: het canvas ís de pagina (echte viewers, echte
  omlijsting), sidebar per widget, serverside draft met direct effect.
- Vakken-layout (Pleio-stijl): rijen → cellen → widgets.
- Menu-editor.

## [0.2.0] - 2026-07-07
- v1: MariaDB met bitemporal-light opslag (versiehistorie + rollback),
  admin-UI met widget-composer, formulieren uit de zod-schema's, Plesk-deploy
  (Passenger `server.js`), drizzle-migraties en seed.

## [0.1.0] - 2026-07-07
- v0: de eerste echte motor — content-in, statische site-uit, met het
  zod-gevalideerde contentmodel, de `ContentStore`-interface (file-backed) en
  composeerbare widget-pagina's. Eerste imprint: MusicBrain.

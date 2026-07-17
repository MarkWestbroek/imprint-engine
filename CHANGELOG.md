# Changelog

Alle noemenswaardige wijzigingen aan de Imprint-engine. Formaat volgt losjes
[Keep a Changelog](https://keepachangelog.com/); versies volgen semver
(pre-1.0: **minor** = nieuwe capability, **patch** = fix). Zie
[docs/releasing.md](docs/releasing.md) voor het release-ritueel.

## [Unreleased]
- 3D-tab: het 3D-vlak neemt nu de vorm van het bord aan (vierkantig bord →
  vierkanter vlak, lang bord → breed vlak; verhouding op een wrapper, want
  model-viewers interne styling won van `aspect-ratio` op het element zelf —
  dáárom was het vlak ~5:1) en de camera-afstand rekent met perspectief
  (near-face-fit: op bordschaal-afstand loomt de voorrand anders het kader
  uit). Screenshot-geverifieerd op brain (vierkantig), busboard (breed) en
  jack8 (lang): alle drie vullend én binnen kader.

## [0.10.1] - 2026-07-17
- 3D-tab: het bord vult nu de beginstand. De camera-afstand wordt bij het
  laden berekend uit de echte modelafmetingen (model-viewers %-framing kadert
  op de omsluitende bol — bij een plat bord dus veel te ver weg), en de lange
  as van het bord ligt horizontaal in het (16:9-)beeld. Geverifieerd met
  screenshots op busboard (breed), jack8 (lang/smal) en gswitch-loop8sh.

## [0.10.0] - 2026-07-17
- **3D-tab op bordweergaves** (MMB-request): een board-spec kan een GLB-model
  meesturen (`assets.model3d`, versioned zoals de renders, of `view3d.src`);
  de bordweergave krijgt dan naast Overview/Interactive een **3D**-knop —
  vrij draaien/zoomen via een zelf-gehoste `<model-viewer>`. Dubbel lazy: de
  viewer-bundel én de GLB laden pas bij de eerste klik; tot die tijd staat de
  poster (`view3d.poster`, anders de render). Specs zonder model veranderen
  niet.
- **Component-soort `kind`** (MMB-FR): open stringveld op component (default
  `board`) en optioneel per spec; de versiekop op component- en productpagina
  volgt het ("Software v0.5.48" i.p.v. "Board …" voor de browser-editors).
  Bestaande content ongewijzigd — geen migratie.
- **Time travel (as-of-preview)**: op het admin-dashboard kies je een moment
  en bladert de publieke site zoals hij tóen was (of, met geplande content,
  wordt) — banner + Exit bovenaan, alleen zichtbaar in je eigen browser.
  Onder water reist `DbContentStore.currentRows` nu op beide bitemporale
  assen (tx- én valid-time), dus verleden-previews tonen echt de oude
  versies. Bekende beperking: widgets die zelf content ophalen kijken nog
  naar "nu".
- **Componentpagina toont de gepinde versie prominent** (MMB-vraag 4): de
  versie die de nieuwste release pint (stable weegt zwaarder dan beta/dev) is
  de hoofdweergave met een "pinned by"-badge; overige versies ingeklapt onder
  "Other versions". Zonder release-pins blijft de vlakke lijst.
- **/boards**: index van alle board-specs (kaarten met render, component,
  versie), tot nu toe alleen via hun component bereikbaar.
- **CI**: GitHub Actions draait typecheck + lint + build (file-store, geen
  database) bij elke push en PR.
- Ontwerpnotities toegevoegd: meertaligheid-beheer (docs/design/
  meertaligheid.md) en de embedded editor-demo W9 (docs/design/
  editor-demo.md).
- **URL-aliases** per contenttype (MMB-vraag 1): `aliases` in de site-config
  (bijv. `{"hw": "components"}`) redirect `/hw/adc8` permanent naar
  `/components/adc8` — voor de silk-opdruk `musicbrain.nl/hw/<naam>` op de
  borden. Beheerbaar via /admin → Site.
- Productpagina toont bij releases nu ook het **project** (MMB-vraag 3):
  twee projecten met hetzelfde versienummer zijn niet langer onleesbaar.
- Ingest-response meldt **`pinned_by`** (MMB-vraag 6): welke releases de
  zojuist gepubliceerde componentversie pinnen, met een waarschuwing als dat
  er nul zijn (dan verschijnt hij nergens op productpagina's).
- MMB-testcase "oude releases blijven benaderbaar" als herhaalbaar script:
  `npm run testcase:bitemporal -- <url> <component>@<versie>`.
- Write-API kan nu **terugtrekken**: `DELETE /api/content/<type>/<slug>`
  (Bearer-token) zet een bitemporale tombstone — het item verdwijnt direct
  uit alle publieke lijsten, de historie blijft en is via admin History →
  Restore terug te halen. Voor het MMB-scenario "verkeerd genummerde release"
  (terugtrekken + onder de juiste slug opnieuw posten); recept in de
  ingest-gids.
- `npm run db:seed -- --only=<types>` seedt een subset (bijv. `--only=themes`
  om de thema's aan een bestaande database toe te voegen zonder bewerkte
  content te overschrijven).
- `npm run smoke -- <url>`: read-only post-deploy-check (home, admin, API,
  write-API-dicht, thema's) — voor na elke Plesk-update.

## [0.9.0] - 2026-07-16
- **Gebruikersbeheer**: `/admin/users` — admins voegen gebruikers toe, wijzigen
  rollen, resetten wachtwoorden (gegenereerd, één keer getoond) en verwijderen
  accounts; iedereen die is ingelogd wijzigt er zijn eigen wachtwoord (huidige
  vereist). De laatste admin kan zichzelf niet degraderen of verwijderen.
  Buitengesloten? `npm run user -- passwd <naam>` op de server is de weg terug
  — een reset-mail is er bewust niet; `npm run user` doet ook
  list/add/role/delete. Wachtwoordregels en hashing
  staan nu één keer in `content-core` (`passwords.ts` + `DbUserStore`), gedeeld
  door admin, seed en CLI. Let op: een sessiecookie blijft na een reset tot 12u
  geldig in een browser die al openstond.
- **Theming**: een thema is nu content (`type: "theme"`, kleurtokens + fonts),
  bewerkbaar in de admin met kleurpickers en live palet-preview. De site
  rendert thema's als CSS-vars op `[data-theme]`; een gebruikers-switcher in
  de header (IDE-stijl) wisselt direct en onthoudt de keuze (no-flash script).
  Meegeleverd: **dark, light en neon**. Zie architecture.md §3c.
- Zes nieuwe widgets: **hero** (kop + CTA), **video** (YouTube/Vimeo
  privacy-embed of bestand), **accordion**/FAQ (zonder JS), **divider**,
  **downloads** (release-downloads met versie + checksum, W7) en **posts**
  (devlog-feed, W6-deel).
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

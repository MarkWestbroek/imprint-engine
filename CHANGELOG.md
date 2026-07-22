# Changelog

Alle noemenswaardige wijzigingen aan de Imprint-engine. Formaat volgt losjes
[Keep a Changelog](https://keepachangelog.com/); versies volgen semver
(pre-1.0: **minor** = nieuwe capability, **patch** = fix). Zie
[docs/releasing.md](docs/releasing.md) voor het release-ritueel.

## [Unreleased]
- **Wiki-fundament + PEP** (stap 1–2 van design/wiki.md): drie nieuwe
  contenttypen — `wiki` (met `visibility: public|members`), `wiki-folder`
  (nestbaar via parent) en `wiki-page` (verplaatsen = folder-veld wijzigen)
  — met enforced relatieregels (page→folder→wiki) en volledig beheer in de
  admin (Content → Wiki, formulieren uit de zod-schema's, History werkt
  zoals overal). Autorisatie loopt nu door één centraal **PEP**
  (`authorize()`, lib/authorize.ts) met een inplugbaar
  `PolicyDecisionPoint`-interface (AuthZEN-snijvlak): vandaag de vaste
  regelset (`staticPdp`), later policies-als-content of een ODRL-gebaseerde
  policytaal — zonder dat call-sites veranderen. `canEdit()` is een dunne
  wrapper over het PEP geworden. Na deploy: `db:seed -- --only=relations`
  voor de nieuwe regels.
- **Wiki publiek** (stap 3): `/<wiki>/…` rendert de wiki met navigatieboom
  links en pagina rechts. URL's zijn `/<wiki>/<folderpad>/<pagina>`, maar
  opgelost wordt op de paginaslug — een verplaatste pagina breekt geen oude
  links. `visibility: members` loopt door het PEP en rendert dynamisch;
  publieke wiki's blijven cachebaar. Architectuur: §3d kreeg een
  mermaid-sequencediagram van de PEP→PDP-flow (het inplugbare
  AuthZEN-snijvlak).
- Wiki: **folder verwijderen cascadeert** (compositie — Wiki ◆— Folder ◆—
  Page): subfolders en pagina's gaan mee, met vooraf een waarschuwing die
  de echte aantallen noemt; alles tombstones, dus herstelbaar via History.
  De publiceer-knop verschijnt bovendien alleen nog waar publiceren is
  ingericht (PUBLISH_URL/PUBLISH_TOKEN) en toont het doel in het label —
  live heeft hem dus niet meer. Admin-rail kreeg een **?-Help-knop** naar
  de Help-wiki.
- Wiki-studio: **inline hernoemen** (dubbelklik op een boom-item; Enter/blur
  bewaart, Escape annuleert). Hernoemen wijzigt alléén de titel — de slug
  blijft stabiel, dus interne verwijzingen en URL's breken niet.
- Wiki: **Publiceer → live** — knop in de studio die de hele wiki (wiki →
  folders, ouders eerst → pagina's) naar de live content-API POST met het
  INGEST_TOKEN van het doel (`PUBLISH_URL`/`PUBLISH_TOKEN` in de lokale
  `.env.local`; zie .env.example). Nogmaals publiceren = nieuwe versies op
  live. De wiki-typen zijn daarvoor INGESTABLE geworden op de API.
- **Gedogfood**: de redacteurshandleiding leeft nu als **Help-wiki**
  (`/help`) — vier folders (Aan de slag, Content bewerken, Vormgeving,
  Gevorderd) met de secties als pagina's. `docs/handleiding.md` blijft
  voorlopig als reservekopie (met verwijzing bovenin).
- Wiki-studio: **volgorde slepen** — tijdens het slepen verschijnen
  invoeg-streepjes tussen pagina's en folders; droppen voegt in op die
  positie en hernummert de broertjes server-side (computeMove-stijl, zoals
  het planbord: alleen gewijzigde items krijgen een nieuwe versie).
  Cykel-bescherming zit ook client-side, dus onmogelijke posities lichten
  niet op.
- **Wiki-studio** (wiki.md §4b): /admin/wiki is nu een echt wiki-overzicht
  (aanmaken op titel; slug volgt) en /admin/wiki/[slug] de studio — boom
  links (slepen verplaatst: alleen het folder/parent-veld wijzigt, met
  cykel-bescherming), eigenschappen + markdown-editor rechts; niets
  geselecteerd = de wiki zelf. Slugs worden per wiki gescopet en uit de
  titel gegenereerd; folders verwijderen alleen als ze leeg zijn
  (tombstone, herstelbaar). Structuur → inhoud, links naar rechts —
  Marks leesrichting-principe.
- Wiki-fixes uit de eerste testronde: een met **lang=nl** aangemaakte wiki
  404'te (de lookup zocht hard op "en"; nu taal-tolerant tot echte
  meertaligheid er is), en in de **Visueel-tab** van markdown-velden in
  schema-formulieren sprong de focus steeds uit het schrijfvlak (het veld
  zat in een `<label>`, die elke klik doorstuurde naar de eerste knop).
  Ontwerp bijgewerkt met de **wiki-studio**-richting (boom links, inhoud
  rechts; slugs per wiki scopen) en een **publiceer-knop** (lokale wiki →
  live via bundle-POST op de content-API) — beide op de backlog.
- Docs: handleiding legt nu **vaste pagina's vs. content-pagina's** uit
  (welke routes code zijn en welke je in de studio bewerkt); nieuw
  ontwerpdoc **wiki + PBAC-lite-autorisatie** (docs/design/wiki.md) met
  bijbehorend backlog-item.
- **Meer doorklikbaar**: de "Latest release"-tegel op de home en de
  release-titels op `/releases` linken nu naar de release-detailpagina
  (`/releases/<project>-<versie>`); het "Try it before it exists"-blok op de
  home is een link naar `/editor`. Explore-testpagina verwijderd (uit het menu
  + seed geparkeerd naar `content/_parked/`).
- **Editor-landingspagina** (`/editor`, eis A1): hero + scope-divider + specs +
  CTA naar de live MusicBrain browser-editor/simulator op
  `editor.musicbrain.nl` (aparte statische Vite-SPA, eigen repo/deploy). "Editor"
  toegevoegd aan het hoofdmenu.
- Productpagina: releases staan nu **nieuwste eerst** (de lijst ging via
  `listItems` en was ongesorteerd; `/releases` en de widget waren dat al).
- **"Open brain"-copy & branding**: de mockup-teksten overgenomen — verhalend
  vanuit de gebruiker ("they forget…") in hero en product-taglines; nieuw
  `audience`-veld op Product ("for modular synths" als kapiteel-regel op
  kaarten en productpagina); patch-brain-logo in de header met de klemtoon op
  **Brain** (accent) en meer lucht rond de naam; site-tagline nu "The open
  brain for your analog rig"; GitHub uit de hoofdnavigatie naar de footer
  (samen met Discord); "Try it before it exists" / "Open, top to
  bottom"-blokken op de home. **Synapse geparkeerd** (seed naar
  `content/_parked/`, tombstone in de DB — herstelbaar via History).
  Fijnslijperij na review: nieuw `motto`-veld op Site ("open hardware ·
  est. NL" onder de wordmark; de tagline blijft voor SEO/feed), logo en
  naam groter in de header, "Meet the family"-knop weg (de familie staat er
  direct onder), en het Amber-thema draagt nu de mockup-fontstacks (Segoe
  UI-systeemstack + Cascadia/JetBrains Mono) via de bestaande
  thema-fontvelden. **Amber is nu het default-thema**: de
  `:root`-tokens in `globals.css` dragen het "open brain"-palet en de
  systeemfont-stacks (volgorde in de switcher: Amber, Dark, Light, Neon;
  Dark en Light behouden Geist via hun eigen fontvelden). Fonts lopen nu
  via een `--sans`/`--mono`-indirectie zodat thema-fontwissels ook
  Tailwinds `font-mono`-utilities raken (voorheen bleven die op Geist
  Mono staan).
- **"Open brain"-designpass** naar het eerder ontworpen MusicBrain-artifact:
  nieuw **Amber-thema** (blauwzwart + amber, cyaan als tweede accent),
  optioneel `accent2`-token in het thema-schema (leeg = valt terug op
  accent), achtergrondtextuur (dot-grid + gloed) afgeleid van de
  thematokens, mono-eyebrows als sectielabels, krappere hoekradius,
  tagline in de header en mono-statusbadges. Widgets: nieuwe **Specs
  strip** (kerncijfers in mono), **Divider-stijl "scope"**
  (oscilloscoop-pulslijn in accent 2) en een vettere **Hero** met
  `*accentwoord*`-markering en een "open" variant zonder paneel.
- Planning-bord: een bord is nu **verwijderbaar** (Delete board op de
  bordpagina — met bevestiging; tombstonet ook de kaarten, herstelbaar via
  History). Nieuwe/bewerkte/verwijderde kaarten verschijnen **direct** (geen
  refresh meer nodig). Een component kiezen **vult een lege kaart-body**
  automatisch met een link naar dat component.
- **Admin met activity-rail** (VS Code-stijl): de lange bovenbalk is vervangen
  door een smalle icon-rail links met vijf werkgebieden — **Overzicht**,
  **Content** (Pages · catalogus · Planning), **Vormgeving** (menus, thema's,
  default views), **Model & config** (content model, relations, site) en
  **Beheer** (users, admin-only). Een secundair paneel toont de items van het
  actieve gebied; het gebied volgt de route. Onderin de rail: bekijk site,
  account en afmelden.
- **Content-model-pagina** in de admin (`/admin/model`): een read-only
  overzicht van alle contenttypen met hun velden (type, verplicht, enum/
  patroon) en de relatieregels — dezelfde bron als `/api/meta`. De types
  zitten in code (zod), dus deze pagina toont, bewerkt niet.
- Seed: `--only=<type>` matcht nu ook enkelvoud consequent (o.a.
  `--only=relations` laadt de relatieregels; die matchte eerder niet).
- **Planning-borden** (kanban als content): twee nieuwe contenttypen —
  `planning` (het bord: hoort bij een product, definieert de fasen) en
  `planning-item` (de kaart: titel, fase, eigenaar-gebruiker, rich-text-body,
  optionele component-link). In de admin (`/admin/planning`) sleep je kaarten
  tussen fasen en klik je ze open om te bewerken; **elke verplaatsing is een
  nieuwe versie**, dus een bord bewaart de volledige geschiedenis van hoe werk
  door de fasen liep (en time-travel toont het bord op elke datum). De
  `planning`-widget toont het bord op de site.
- **Planning-widget als generieke view**: naast bord-modus (planning-items)
  kan dezelfde widget elk contenttype als bord tonen — een aanwijsbaar
  fase-, eigenaar- en titelveld, met de fasen op de widget geconfigureerd.
  Zo rendert hij bv. `component`en gegroepeerd op hun nieuwe (optionele)
  `phase`-veld, dat een project via de API bijwerkt. Generieke modus is
  read-only (verschuiven gaat via het eigen beheer/de API van dat type).
- **GitHub release-webhook** (W2/S7): `POST /api/webhooks/github` maakt van
  elke gepubliceerde GitHub-release een release-item (HMAC-signature-check,
  `GITHUB_WEBHOOK_SECRET`; mapping repo→project/product in de site-config
  onder `releaseSources`; onbekende repos worden genegeerd). Edits
  superseden bitemporaal.
- **RSS-feed** voor de devlog op `/feed.xml` (W6-rest), aangekondigd via
  `rel=alternate`.
- **`GET /api/meta?format=v3`**: het contentmodel als genest **V3Model**
  (het metamodelformaat van het bitemporal/Omnium-project), zodat de
  formuliereditor/ModelPicker daar direct de projectboom uit kan opbouwen.
  Live afgeleid uit de zod-schema's; relatieregels worden V3-relaties (met
  velden óp de relatie, zoals de versie op Release↔Component), zod-enums
  centrale enums, en patronen/veldnamen de datatypes Slug, Versienummer,
  Markdown (richtext), Kleur, AssetUrl (media) en Json. Spec + mapping in
  docs/design/v3-metamodel-spec.md.
- **`GET /api/meta`**: het contentmodel machine-leesbaar — JSON Schema
  (2020-12) per contenttype uit dezelfde zod-schema's die de content
  valideren, plus de actieve relatieregels als referentietypen en de
  afgeleide itinerary. Datakant voor de metamodel-gedreven formuliereditor
  uit het bitemporal/Omnium-spoor.
- **`npm run backup`**: DB (volledige bitemporale historie + users) en
  assets in één gedateerde backup, Node-only (Plesk-Scheduled-Task-klaar),
  retentie 14; zie docs/backups.md.
- **`npm run assets:gc`**: ruimt asset-wezen op (bestanden zonder énkele
  verwijzing in de hele historie); dry-run default, jonger dan een dag
  blijft staan.
- **Time travel compleet**: ook widgets die zelf content ophalen (posts,
  list, releases, downloads, boardspec, itinerary, products) volgen nu de
  as-of-preview.

## [0.10.2] - 2026-07-17
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

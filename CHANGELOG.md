# Changelog

Alle noemenswaardige wijzigingen aan de Imprint-engine. Formaat volgt losjes
[Keep a Changelog](https://keepachangelog.com/); versies volgen semver
(pre-1.0: **minor** = nieuwe capability, **patch** = fix). Zie
[docs/releasing.md](docs/releasing.md) voor het release-ritueel.

## [Unreleased]
- **Studio: meer ruimte voor het canvas.** Het instellingenpaneel klapt in
  (« / ») zodat de pagina op ware breedte te zien is; een klik op een widget
  klapt het weer uit. **View page ↗** in de bovenbalk opent de opgeslagen
  pagina op de site in een nieuw tabblad. De specs-strook (1 · 2 · 8) volgt
  de breedte van zijn vak in plaats van het scherm: in een smal vak stapelen
  de cijfers netjes.
- **Fix: de header van de Imprint-site liep in de studio over de admin heen.**
  De header is `position: absolute` (hij zweeft over de hero); de
  canvas-omlijsting van de site is nu de positionerende ouder met een eigen
  stapelcontext, zodat hij bovenin het canvas blijft.
- **Fase 6, eerste slice (hardening).** Een verkeerd geconfigureerde plugin
  faalt bij het opstarten met een bruikbare fout: ongeldige naam, ontbrekende
  versie, twee keer geconfigureerd, of een contenttype dat al bestaat (de
  fout noemt de plugin). `npm test` begint met een grenscontrole
  (`scripts/check-boundaries.mjs`): geen package importeert uit een site, en
  `content-core`/`extension-api` blijven vrij van React en Next. Het
  admin-dashboard toont onder **Extensions** de actieve plugins met versie,
  contenttypen en wat ze leveren.
- **Fase 5 af — stap 5, de exitproef.** De Imprint-site draait met
  `plugins: []` en kent planning noch wiki: niet in het menu, `/admin/planning`,
  `/admin/wiki` en `/help` zijn 404, het modeloverzicht toont de typen niet
  (Playwright-doorloop tegen de productiebuild, zonder console-errors).
  MusicBrain met beide plugins: 39 browsertests groen in productie en dev.
  Daarmee is het exitcriterium van het revisievoorstel gehaald: een
  capability is volledig plugin en is in een instantie weg te laten zonder
  enginecode te wijzigen.
- **Fase 5, stap 4: de wiki als plugin.** `@imprint/plugin-wiki` bevat de
  drie contenttypen met relatieregels (en de legacy-afbeelding van
  `visibility`), de boomstudio onder `/admin/wiki`, de acties (verplaatsen,
  verwijderen, publiceren naar live) en de publieke route: de derde haak.
  De publieke catch-all en `/members/…` vragen nu eerst de plugins
  (`pluginPublicRoute`): in de statische route antwoordt de wiki met een
  redirect voor beperkte inhoud, onder `/members` beslist hij met de PDP.
  `AdminTypeScreen` in het package kiest per `/admin/<segment>`: een plugin
  die het segment claimt wint (de wiki-studio boven de platte lijst), anders
  de generieke lijst; beide sites hebben dezelfde dunne route, en de
  Imprint-site heeft nu ook de plugin-haken. De kern kent wiki noch
  planning meer: `CoreContentType` telt nog negen typen. Vier browsertests
  voor de wiki (aanmaken, eigen URL, beperkt via /members, 404).
- **Fase 5, stap 2 en 3: het plugincontract, en planning als eerste plugin.**
  `ImprintPluginCore` (extension-api: contenttypen, widgetschema's, menu) en
  `definePlugin`/`ImprintPlugin` (runtime-admin: schermen en actions);
  `plugins: [...]` in `imprint.config.ts` voegt de typen aan het register toe
  en de menu-items aan de admin. Drie vaste haken in de site: de
  `[type]`-routes renderen een pluginscherm als het segment geen contenttype
  is (`PluginScreen`, ook `[type]/[...path]`), één `pluginAction`-dispatcher
  in `actions.ts`, en (stap 4) de publieke catch-all. `@imprint/plugin-
  planning` bevat de twee contenttypen met relatieregels, de bordadmin onder
  `/admin/planning`, de acties, de planning-widget en de pure bordlogica met
  tests; MusicBrain zet hem aan met één regel en componeert alleen nog de
  widget in zijn catalogus. De kern kent planning niet meer. Vijf
  browsertests voor de plugin; alles groen.
- **Fase 5, stap 1: contenttypen als definities.** `ContentTypeDefinition`
  en `ContentTypeRegistry` in `content-core` (schema, label, vlaggen,
  menuplek, domein, relatieregels, startwaarden, sleutel, formulierschema);
  de kern levert zijn veertien typen als definities (`core-content-types.ts`,
  `DEFAULT_RELATION_RULES` is nu afgeleid). De zeven switches op typenaam in
  store, catalogus, formulieren, itemeditor, actions, modeloverzicht en
  V3-export zijn opzoekingen geworden; `ContentType` is een open string
  (besluit Mark), bewaakt door het register: een niet-geregistreerd type
  wordt nooit geschreven. Geen zichtbaar verschil; alle suites groen.
- **Opzet Fase 5** (`docs/design/fase-5-plugins.md`): contenttypedefinities
  en een register in plaats van de zeven switches in de kern, het
  plugincontract (`definePlugin`), drie vaste haken voor schermen, actions en
  publieke routes, en de stappen om planning en wiki als eerste plugins te
  verhuizen. Vier keuzes voor Mark in §6.
- **Fase 4 af — stap 4: de standaard-widgeteditors in de bibliotheek.**
  De rijke editors voor table, gallery/carousel en map staan in
  `@imprint/widgets-standard/editors` (`standardEditors`, plus de helpers
  `omitProps`, `Mini2`, `NumInput`, `editorInputCls` voor site-eigen
  editors). MusicBrain houdt alleen nog board en kanban (366 regels, was
  695) en spreidt de standaardset erbij; de Imprint-site krijgt dezelfde
  editors en heeft het **externe album** in zijn widgetset (besluit Mark).
- **Fase 4, stap 2 en 3: de studio zit in het package en werkt op beide
  sites.** `PageStudioScreen` en de studio-actions (`draftOp`, `resetDraft`,
  `savePageDraft`) in `@imprint/runtime-admin/admin-server`, de
  clientonderdelen (`StudioProvider`, sidebar, toolbars) in `/admin`. Een
  site levert via `AdminContext.studio` zijn viewers, één chrome-component
  om het canvas en optioneel zijn widget-editor; het package bouwt de
  `WidgetContext` voor het canvas zelf (als de redacteur: beperkte items en
  drafts inbegrepen). De Imprint-site bewerkt pagina's nu visueel binnen zijn
  eigen header en footer, met zijn acht widgets; MusicBrain onveranderd (30
  browsertests groen). Exitcriterium van Fase 4 gehaald; wat rest is stap 4,
  de standaard-widgeteditors naar `widgets-standard`.
- **Fase 4, stap 1: draftlogica van de studio naar het package.** De pure
  layoutoperaties (`applyOp`, `PageDraft`, `DraftOp`) staan in
  `@imprint/runtime-admin/studio` (client-safe), de serverside draftopslag in
  `admin-server` (`draftKey`, `getDraft`, …). De draftsleutel bevat nu ook de
  instantie, zodat twee sites in één proces elkaars drafts nooit zien. Test
  verhuist mee.
- **Browsertest voor de studio** (vangnet voor Fase 4): een nieuwe pagina
  componeren (instellingen, rij, hero-widget, aanmaken), live zien, historie,
  tweede versie via de studio. Onderweg twee kleine UX-punten gevonden en
  in de backlog gezet ("Saved ✓" verdwijnt bij aanmaken; snelle klik na
  typen kan sidebar-invoer verliezen). 30 browsertests, productie en dev.
- **Ontwerp Fase 4: chrome-slot in de studio** (besluit Mark). De studio
  krijgt de omlijsting van de site als één component mee en weet er verder
  niets van; de rijkere variant (menu en thema's in het canvas) is een
  vervolgstap. Revisievoorstel, Fase 4; backlog.
- **Fase 3 af — stap 6 en 7: de Imprint-site heeft de admin.** Sessie en
  as-of-preview zijn naar het package verhuisd (`createSessionAuth(imprint)`,
  `readOpts()`, `previewEnter`/`previewExit`), zodat een site alleen nog zijn
  `AdminContext` en dunne routes hoeft te hebben. De Imprint-site
  (Postgres) heeft daarmee `/admin`: inloggen, dashboard, lijsten, bewerken,
  historie, herstel, gebruikers, relaties, modeloverzicht en Time travel —
  in 13 kleine bestanden, zonder eigen admin-code. Pagina's bewerk je daar
  voorlopig met het meta-formulier; de itemeditor laat velden die het
  formulier niet kent (layout, body) nu ongemoeid, zodat een meta-save een
  gecomponeerde pagina niet sloopt. MusicBrain leest sessie en preview uit
  hetzelfde package (`lib/auth.ts` en `lib/preview.ts` zijn doorgeefluiken).
  Eerste gebruiker: `SEED_ADMIN_USER`/`SEED_ADMIN_PASSWORD` +
  `npm run db:seed -- --site=imprint --only=user`; `SESSION_SECRET` in
  `sites/imprint/.env.local`.
- **Fase 3, stap 5 af: de hele admin draait uit het package.** Ook
  gebruikersbeheer, relaties, default views en het modeloverzicht zijn nu
  schermen en actions in `@imprint/runtime-admin/admin-server`
  (`UsersScreen`, `RelationsScreen`, `ViewsScreen`, `ModelScreen`;
  `createUser`, `resetPassword`, `setRole`, `deleteUser`,
  `changeOwnPassword`, `saveRelations`). De site houdt alleen nog dunne
  routebestanden en wrappers; wat er nog in de site staat is de studio
  (Fase 4) en planning en wiki (Fase 5). Welke typen een default view hebben
  is een catalogusvlag (`viewable`); `viewTargetType` kent geen eigen
  typelijst meer. Geen zichtbaar verschil; 27 browsertests groen.
- **Fase 3, stap 5 (eerste helft): de kern van de admin draait uit het
  package.** Login, dashboard, lijst, itemeditor, historie en herstel zijn
  schermen in `@imprint/runtime-admin/admin-server` (`AdminGate`,
  `DashboardScreen`, `ListScreen`, `ItemEditScreen`, `HistoryScreen`) met de
  action-implementaties ernaast (`signIn`, `signOut`, `saveItem`,
  `deleteItem`, `restoreVersion`); alles krijgt de `AdminContext` als
  parameter. In de site blijven dunne routebestanden (samen 122 regels, was
  ~500) en één-regel `"use server"`-wrappers. Het admin-menu wordt gebouwd
  uit de contenttypecatalogus (`CONTENT_TYPES[type].menu`) plus de bijdragen
  van de site (`contributions`: planning, wiki, default views, model,
  relaties); de `AdminShell` zit in het package. Geen zichtbaar verschil; 27
  browsertests groen. Tweede helft volgt: gebruikers, relaties, menu's,
  thema's, modeloverzicht.
- **Fase 3, stap 4: admin-context en de generieke clientcomponenten naar het
  package.** Dialoog, `SchemaForm`, markdown-editor, loginformulier, menu-,
  thema-, gebruikers-, relatie- en itemeditor (~1.400 regels) staan nu in
  `@imprint/runtime-admin/admin` en krijgen hun server action als prop; de
  formulierschema's (`contentFormSchema`, `widgetFormSchemas`) in
  `@imprint/runtime-admin/forms`. Nieuw: `AdminContext`
  (`createAdminContext`): instantie, sessie, formulieren en admin-bijdragen in
  één object, door de site gebouwd in `src/lib/admin.ts`. Geen zichtbaar
  verschil in de admin; de 27 browsertests bewijzen dat.
- **Fase 3, stap 3: het poortje in AuthZEN-vorm, en publiek/beperkt op alle
  inhoud.** `access: public | restricted` op elk inhoudstype (oude wiki's met
  `visibility: members` blijven parseren als beperkt, geen migratie). Het
  poortje is asynchroon en spreekt AuthZEN (`permit()`, `inProcessPdp`,
  `guardReads()` in `content-core/src/access.ts`); de beslisser komt uit de
  instantie (`ImprintConfig.pdp`), nu de vaste regelset in het proces, straks
  de sidecar. `imprint.store` is de bewaakte bezoekerskijk: beperkte items
  vallen uit elke lijst, get, feed, API-antwoord en list-widget. Beperkte
  pagina's en wiki's staan onder `/members/<slug>` (dynamisch, per verzoek
  langs de PDP, anders 404); de statische route stuurt ernaartoe. Publieke
  pagina's blijven statisch. Lost ook de 500 op de members-wiki in productie
  op (cookies in een statische render). Vijf browsertests erbij. Wiki-editor:
  "Zichtbaarheid" heet nu "Toegang".
- **Ontwerp Fase 3: toegang per widget later** (besluit Mark). Stap 3
  handhaaft `publiek`/`beperkt` per pagina en item; een beperkte widget op een
  publieke pagina wordt een eigen stap daarna. De afweging (Partial
  Prerendering of laden in de browser) staat in §4.3 van het ontwerp.
- **`npm run db:copy-to-pg`**: eenmalige verhuizing van een MariaDB-database
  naar Postgres — alle rijen met id's, historie en wachtwoordhashes, in één
  transactie met controle rij voor rij (`--dry-run`, `--replace`). Leest de
  tijden als UTC, zoals drizzle ze schreef. Bedoeld voor MusicBrain; stappen
  in [docs/deploy-vps.md](docs/deploy-vps.md).
- **Fase 3, stap 2 af: browsertests voor de hele bewerkcyclus** — naast
  inloggen en lijsten nu ook: opslaan (en dat de publieke pagina meeverandert),
  een ongeldige waarde die geweigerd wordt, historie (nieuwste eerst, met
  auteur), herstel (een nieuwe versie; de historie blijft), een product
  aanmaken en verwijderen, en gebruikersbeheer (toevoegen, zwak wachtwoord en
  bezette naam geweigerd, rol wijzigen, je eigen adminrol niet afgeven,
  verwijderen; een editor ziet het beheer niet). 22 tests, groen tegen de
  productiebuild en tegen `next dev`. Getoetst: zonder de revalidatie na een
  save faalt de test.
- **Fase 3, stap 2 (eerste helft): browsertests van de admin** — Playwright in
  `sites/musicbrain/e2e/`, `npm run test:e2e`. De run maakt de wegwerpdatabase
  `imprint_e2e` leeg, seedt haar via de store, bouwt de site en test in
  Chromium: inloggen (fout wachtwoord, uitloggen, reader komt er niet in) en
  lijsten (producten, dashboardtellingen, 404 op onbekend type, menu per rol),
  plus een rooktest van de studio. Elke test faalt op een console-error.
  `npm run test:e2e:dev` draait dezelfde specs tegen `next dev` in een eigen
  map (`.next-e2e`, dus naast een draaiende dev-server): alleen daar meldt
  React hydration- en propfouten, zoals de twee die in september opdoken.
  Aparte CI-job met MariaDB-service. Nog te doen: opslaan, historie, herstel
  en gebruikersbeheer.
- **Tests draaien nu ook op Windows**: de testscripts van beide sites gebruikten
  bash-syntax en werden onder cmd.exe stil overgeslagen; de golden-HTML-tests
  struikelden bovendien over CRLF uit `core.autocrlf`. `npm test` draait nu
  overal alle suites.
- **Deploy op de VPS: één container-image per site** — `Dockerfile` in de
  root (build-arg `SITE`, Next `output: "standalone"` via `NEXT_OUTPUT`, dus
  lokale builds blijven ongewijzigd) en `deploy/vps/`: compose met één
  Postgres 17 (database + rol per imprint), `deploy.sh` (git pull/tag →
  migreren → bouwen → herstarten, plus `migrate`/`seed`/`user`), `backup.sh`
  (pg_dump + assets) en het Caddy-blok. De SSG-build leest de database via een
  BuildKit-secret; daarom bouwt de VPS zelf. Lokaal getest voor beide sites,
  MusicBrain daarbij voor het eerst op Postgres. De Imprint-site leest
  `ASSET_ROOT`/`ASSET_BASE_URL` nu ook uit de omgeving; `.gitattributes`
  houdt shell-scripts op LF. Runbook: [docs/deploy-vps.md](docs/deploy-vps.md).
- **Tijdreizen: drie lekken dicht** (ontwerp Fase 3 §8.4). In de
  as-of-preview reizen nu ook mee: de siteconfiguratie (naam, tagline,
  URL-aliassen; `getSiteConfig(opts)` in het storecontract), de thema-CSS in
  de root-layout en de default views (`_view/<type>`). Bestond de site op het
  gekozen moment nog niet, dan geeft de store de huidige siteconfiguratie,
  zodat de pagina (of de 404) blijft renderen. Publieke pagina's blijven
  statisch.
- **Fix: studio gaf een reeks "Only plain objects"-meldingen** — zod 4.4 hangt
  een verborgen `~standard`-object aan elk JSON-schema; de formulierschema's
  gaan nu als kale JSON naar de client (`admin-schemas.ts`).
- **Fix: hydration-melding op `<html>`** — het thema-script zet `data-theme`
  vóór de hydratie (bewust, tegen flitsen); React meldde dat in dev als
  mismatch zodra de browser een opgeslagen thema had. `<html>` heeft nu
  `suppressHydrationWarning`.
- **Lokale databases**: Postgres staat nu op poort **5434** (5433 botste met
  de regressietest van Omnium); beide containers starten vanzelf mee met
  Docker (`restart: unless-stopped`). `npm run test:db` is een Node-script en
  werkt daardoor ook op Windows. Wie al een `.env.local` met 5433 heeft: poort
  aanpassen en `npm run db:up` opnieuw draaien.
- **Fase 3, stap 1: de grond onder de gedeelde admin**. Drie kleine
  wijzigingen zonder zichtbaar gedrag voor MusicBrain:
  - *Gebruikers op Postgres*: het gebruikersbeheer is gesplitst in een
    gedeelde `UserStore` (regels: wachtwoordbeleid, laatste admin blijft
    admin) en per dialect vijf rij-operaties (`DbUserStore`, `PgUserStore`),
    bewezen gelijk door één contractsuite op beide databases.
    `openContentDatabase()` levert nu altijd users; `npm run user` en de seed
    werken op MariaDB en Postgres.
  - *Secrets via de config*: `SESSION_SECRET`, `INGEST_TOKEN`,
    `GITHUB_WEBHOOK_SECRET` en `PUBLISH_*` worden alleen nog in
    `imprint.config.ts` gelezen (`secrets`) en komen via de instantie bij de
    code; ontbreekt er een, dan faalt of zwijgt alleen de functie die hem
    nodig heeft, zoals voorheen.
  - *Contenttypecatalogus*: `CONTENT_TYPES` in `content-core` beschrijft wat
    het model kent (label; lijstbaar, bewerkbaar, via de API aan te leveren,
    op het dashboard); `contentTypes` in `imprint.config.ts` bepaalt welke een
    site gebruikt. De zeven losse typelijsten in admin-routes, server actions,
    dashboard, relatie-editor en `/api/content` zijn vervangen. Zichtbaar
    gevolg: de relatie-editor biedt nu alle actieve typen aan.
- **Ontwerp Fase 3**: `docs/design/fase-3-admin-toegang-tijdreizen.md` legt
  de besluiten vast voor de gedeelde admin (eigen admin, alleen ideeën lenen);
  rechten via het PxP-patroon met twee sidecar-PDP's, aan de voorkant en bij
  gegevenstoegang, binnen AuthZEN NL Gov en FTV; `publiek` of `beperkt` op
  alle content, waarbij publieke content zonder PDP werkt; een browsertest
  voor de admin-flows; formulieren en lijsten volgens Omnium; en de richting
  om het contentmodel te modelleren, er een bitemporeel register uit te
  genereren en daarnaar te migreren, met de voorwaarden die daarvoor nog in
  Omnium open staan. Verder het principe dat inhoud, vormgeving en
  configuratie samen door de tijd te reizen zijn, de gemeten tijdreislekken,
  een richting voor widgetversies, het stappenplan en de open vragen.
- **Fase 2 afgerond: de Imprint-site rendert pagina's uit de database
  (stap 5)**: `sites/imprint` heeft een catch-all-route die pagina's uit de
  contentstore toont (Postgres, of `content/` zonder database) via dezelfde
  engine-renderer als MusicBrain, met een eigen selectie van acht
  standaardwidgets. De huisstijl vult het tokencontract van de
  standaardwidgets met het Imprint-palet; de globale basisregels van de site
  staan nu in Tailwinds base-laag, zodat ze widget-utilities niet
  overschrijven. Een voorbeeldpagina `/techniek` staat in `content/` en in de
  lokale Postgres-database; een test bewaakt de widgetselectie en de
  weergave. MusicBrain ongewijzigd (routetabel identiek).
- **Standaardwidgets als bibliotheek (Fase 2, stap 4)**: de twintig widgets
  zonder domeinkennis (tekst, tabel, afbeelding, galerij, carrousel, album,
  kaart, kanban, hero, video, accordeon, scheiding, specs, posts, template,
  lijst, callout, embed, boomweergave, api) staan nu in het nieuwe package
  `@imprint/widgets-standard`, met schema's en viewers. MusicBrain stelt zijn
  catalogus samen uit die standaardwidgets en zijn tien domeinwidgets, in de
  vertrouwde volgorde; de studio toont exact dezelfde widgets, labels,
  versies en helpteksten (vastgepind in een test). `WidgetFrame` staat nu in
  de engine. Golden HTML en routetabel ongewijzigd; de CSS-dekkingstest ving
  onderweg een ontbrekende Tailwind-bron. Leaflet en mustache verhuisden als
  afhankelijkheid mee, zonder versiewijziging.
- **Viewers krijgen hun content aangereikt (Fase 2, stap 3)**: widget-viewers
  ontvangen een `WidgetContext` (`store`, `writableStore`, `readOptions`) in
  plaats van zelf `@/lib/content` en `next/headers` te importeren. De site
  bouwt die context per verzoek in `src/lib/widget-context.ts`; een lintregel
  verbiedt de oude imports in de viewer-graaf. `DefaultView` verhuisde daardoor
  ook naar `@imprint/runtime-admin`. Golden HTML, CSS en de routetabel
  (statisch/SSG/dynamisch) zijn ongewijzigd. De renderertests hebben geen
  experimentele module-mocks meer nodig.
- **Renderer naar de engine (Fase 2, stap 2)**: `PageRenderer`, `Widget`, de
  layouthelpers (`layoutRows`, `LAYOUT_PRESETS`) en `Markdown` staan nu in het
  nieuwe package `@imprint/runtime-admin`. De renderer kent geen concrete
  widgets meer; MusicBrain bindt hem in `src/components/page-renderer.tsx` aan
  zijn eigen viewers. Golden HTML en gegenereerde CSS zijn aantoonbaar
  ongewijzigd. Tailwind scant het engine-package en slaat de testmap over; een
  nieuwe test bewaakt dat elke gerenderde class CSS krijgt. De site-tests
  draaien met `tsconfig.test.json`, zodat JSX in engine-packages werkt.
- **Fix: `npm run release` hoogt alle workspaces op**: het script had een
  vaste lijst van drie `package.json`-bestanden, waardoor `extension-api` en
  de Imprint-site achterbleven. Het leest nu de `workspaces` uit de root.
- **Renderer vastgelegd vóór de verhuizing (Fase 2, stap 1)**: nieuwe
  karakterisatiesuite in `sites/musicbrain/test/render/` rendert de echte
  `PageRenderer`, alle 30 widget-viewers, `DefaultView` en `SiteChrome` naar
  HTML en vergelijkt met golden files (`UPDATE_GOLDEN=1` om bewust bij te
  werken). Store, `next/headers` en `fetch` worden in de test vervangen, dus
  geen database en geen netwerk nodig. Daarvoor kreeg `content-core` een
  `MemoryContentStore`: dezelfde bitemporal-light semantiek als MariaDB en
  Postgres, door dezelfde contractsuites gehaald. Tests draaien nu per
  workspace (`npm test` roept ze allemaal aan). Geen gedragswijziging.
- **Docs: overdracht bijgewerkt (16 september)** — `docs/overdracht.md` §0:
  MusicBrain is offline sinds 1 september (Quickhost heeft Node/Passenger
  uitgezet), er is een VPS (vps1.paratmos.nl, Omnium draait er al), verhuisplan
  voor MusicBrain in zes stappen, wat er sinds juli op `main` is gekomen, en
  Windows-specifieke aanwijzingen. §3 gemarkeerd als historie.
- **Composition root per site (Fase 1, opdracht C)**: nieuw package
  `@imprint/extension-api` met `defineImprint()`/`createImprint()`. Elke site
  beschrijft zichzelf in `imprint.config.ts` (id, backend-URL + contentmap,
  widgetcatalogus, sessiecookie, assets); `src/lib/content.ts` maakt daar de
  instantie van en `auth.ts`/`assets.ts` halen cookie, users en asset-store
  uit die instantie in plaats van uit losse modules en env-reads. MusicBrain
  en de Imprint-site starten nu vanuit hetzelfde configuratiecontract; gedrag
  ongewijzigd (cookienaam blijft `imprint_session`). `openContentDatabase()`
  levert nu ook de `DbUserStore` (MariaDB), zodat de seed geen tweede pool
  meer opent.
- **Docs: positionering** — `docs/positionering.md` zet Imprint naast Drupal
  en Payload: wat het wel en niet is, waar het iets eigens doet en waar het
  (nog) achterloopt. `docs/design/widget-standaarden.md` kreeg een vervolg
  over Payload-blocks als widgetbron (conclusie: niet zinvol; hergebruik komt
  uit generieke React-bibliotheken als client-eiland).
- **Docs: NL Design System** — `docs/design/nl-design-system.md` inventariseert
  wat Omnium al met NL Design System doet (Utrecht-CSS-klassen en tokens, geen
  React-imports) en hoe het in Imprint past: CSS op eigen markup vanwege
  server-components, een tokenbrug naar de Imprint-thema's en een `form`-widget
  voor S10 op de losgemaakte Omnium-renderer. Het backlogpunt
  "Formulier-renderer als widget" is in stappen opgesplitst.
- **Fix: koude compile van MusicBrain duurde minuten** — Tailwind v4 scande
  ook de `.glb`-3D-modellen en honderden SVG's in `public/` en `.assets/` op
  class-namen (>2 min en >10 GB per compile, Turbopack-timeouts in dev en
  build sinds de 3D-tab van juli). Twee `@source not`-regels in
  `globals.css` slaan die mappen over: de Tailwind-stap gaat van >120 s naar
  ~0,2 s.
- **Postgres als tweede databasebackend (opdracht B)**: de Imprint-productsite
  draait op Postgres (`DATABASE_URL=postgres://…`), MusicBrain ongewijzigd op
  MariaDB. De lees-/schrijfsemantiek van de databasestore is naar één
  abstracte `DbContentStoreBase` gebracht; `DbContentStore` (MariaDB) en het
  nieuwe `PgContentStore` (Postgres, `jsonb`, `timestamptz`) implementeren
  elk alleen zes rij-operaties. Eigen schema en migratiejournal per dialect
  (`db-schema.pg.ts`, `drizzle-pg/`, `drizzle.config.pg.ts`,
  `npm run db:generate:pg` / `db:migrate:pg`); `openContentDatabase(url)` in
  `@imprint/content-core/db` kiest de backend op het URL-schema, gebruikt door
  de composition root van de Imprint-site en door `db:seed`. `docker compose`
  heeft nu ook een Postgres 17-service (poort 5433, maakt `imprint_test` zelf
  aan). Beide backends draaien dezelfde lees- én schrijfcontractsuite
  (`npm run test:db`). Nog MariaDB-only: users/admin-login, backup, assets-gc.
- **Architectuurcontract en karakterisatietests (Fase 0)**:
  `docs/architecture.md` §0 legt de vier lagen vast — engine, bibliotheek,
  backend, site — met hun afhankelijkheidsregels (site → engine, nooit
  andersom; engine kent geen site-naam; backend alleen via `ContentStore`;
  tijd als leesparameter van het contract), de besluiten die zonder Mark
  genomen konden worden en de open vragen. Nieuw: `npm test` (Node's eigen
  testrunner via tsx, ook in CI) met een gedeelde `ContentStore`-contractsuite
  die tegen de file-store en — met `TEST_DATABASE_URL`, `npm run test:db` —
  tegen de MariaDB-store draait, plus tests voor de schrijfkant (versies,
  tijdreizen, tombstone, referentieweigering), het widget-model, relaties,
  itinerary, `layoutRows()`, de studio-ops en de exacte MusicBrain-
  widgetcatalogus. Gedrag is alleen vastgelegd, niet veranderd.
- **Opdrachtbrief voor het lostrekken van de engine**:
  `docs/design/opdracht-engine-bibliotheek-backend-site.md` vertaalt het
  revisievoorstel naar vier lagen — engine, bibliotheek (nieuw begrip),
  backend (nieuw als eigen laag, Postgres eerst, MariaDB blijft) en site — legt
  vast wat al besloten is, wat nog open staat, en geeft de eerste concrete
  opdracht (architectuurcontract + karakterisatietests, Postgres-spike, dan pas
  composition root).
- **Architectuurrevisie ontworpen**: `docs/design/engine-instance-plugin-architectuur.md`
  beschrijft uitgebreid hoe Imprint van de huidige, deels in MusicBrain
  ingebouwde motor naar gedeelde core/runtime/adminpackages en dunne
  site-instanties kan groeien. Het voorstel definieert widgets versus plugins,
  een veilig build-time extensionmodel, package- en deploymentgrenzen,
  teststrategie, zes migratiefasen en de nog te nemen besluiten.
- **Imprint heeft een eigen productsite en merkvoorstel**: `sites/imprint` is
  een tweede Next.js-workspace met een statische, responsieve productsite die
  het platform uitlegt en MusicBrain als praktijkvoorbeeld toont. Het
  toegepaste logo "Registerdruk" verbeeldt versiehistorie als twee verschoven
  afdrukken; "Colofon" en "Veelvoud" blijven als alternatieven zichtbaar en
  zijn samen met exporteerbare SVG's gedocumenteerd in `docs/design/brand.md`.
  Mogelijkheden, praktijk en merk hebben eigen routes in plaats van
  ankersecties; de homepage kreeg een rustigere kop en matrix zonder centrale
  lijn. De siteconfig gebruikt nu de `ContentStore` met een eigen MariaDB-
  database en eigen file-storefallback; pagina-inhoud en admin volgen later.
- **Documentatie heeft een publieke voordeur**: de hoofd-README legt nu eerst
  in gewone taal uit wat Imprint is, wat een team ermee kan en hoe MusicBrain
  het gebruikt. Een nieuw documentatieoverzicht biedt routes voor redacteuren,
  ontwikkelaars en ontwerpbeslissingen; ook de redacteurshandleiding en de
  MusicBrain-workspace verwijzen nieuwe lezers gericht door.
- **Lokale database bijpraten vanaf een draaiende site**:
  `node scripts/sync-from-live.mjs` haalt componenten + board-specs (en de
  assets waar ze naar wijzen) via de publieke read-API op en post ze op het
  doel via de ingest-API — strikt eenrichtingsverkeer (alleen GET's op de
  bron), identieke items worden overgeslagen en items die alleen lokaal
  bestaan blijven staan. Nodig als de KiCad-toolkit lokaal een release post
  die naar componentversies verwijst die alleen live bestaan (404 op
  `/components/<slug>`, missende 3D-tabs). `--dry` toont eerst wat er zou
  gebeuren.
- **Dev-server stoppen/herstarten zonder de terminal te zoeken**:
  `npm run dev:start|dev:stop|dev:restart|dev:status` (script
  `scripts/dev-server.mjs`, praat met de *poort* i.p.v. een proceshandle)
  plus dezelfde drie als VS Code-tasks. Handig na een `npm install` of een
  gewijzigde dependency; `npm run dev` blijft de gewone voorgrond-start.
- **Productpagina is nu écht bewerkbaar** (default views voorbij "geparkeerd"):
  vier subject-widgets — **Subject header** (eyebrow, naam + status, tagline,
  omschrijving), **Specs table**, **Product components** (met ingeklapte
  board-specs) en de **releases**-widget in product-modus (expliciet product
  of het subject; nieuwste eerst) — renderen via dezelfde gedeelde secties als
  de ingebouwde pagina (`product-sections.tsx`), dus een studio-view is per
  constructie identiek. `_view/product` wordt meegeseed en reproduceert de
  pagina 1-op-1; bewerken in Vormgeving → Default views verandert vanaf nu
  écht de productpagina's. Een view met een subjectheader bezit zijn eigen
  h1 (geen dubbele titel); subject-loze gallery's verdwijnen stil i.p.v.
  "No photos yet.".
- **Thema's proberen in de studio**: de canvas-chrome heeft nu de echte
  themaswitcher (alle thema's uit de store, dus ook nieuwe), klikbaar ondanks
  de verder inerte omlijsting. Let op: wisselen zet je eigen themavoorkeur,
  net als op de site.
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
- Admin: **eigen dialoogjes** i.p.v. de ouderwetse window.confirm/prompt —
  een popover in de huisstijl die opklapt bij je muis (waar je net
  klikte), met Enter/Escape, gevaar-variant in rood en een invoerveld voor
  vragen. Overal doorgevoerd: wiki-studio (nieuw/verwijder/publiceer),
  planbord-delete en de link-knop in de markdown-editor (met behoud van de
  tekstselectie).
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

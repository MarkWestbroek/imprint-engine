# Backlog — Imprint

Open punten, bij elkaar geharkt uit de README, de requirements
([website-requirements.md](website-requirements.md), eisnummers `W*`/`S*`) en de
ideeën die onderweg in de bouwsessies langskwamen. Geen planning — een lijst om
uit te kiezen.

Maat: **S** ≈ een uurtje · **M** ≈ een dagdeel · **L** ≈ groter/meerdaags.

---

## 1. Widgets

De catalogus nu: `text`, `table`, `image`, `gallery`, `carousel`, `album`,
`map`, `video`, `hero`, `accordion`, `divider`, `downloads`, `posts`,
`itinerary`, `board`, `boardspec`, `template`, `list`, `callout`, `embed`,
`treeview`, `api`, `releases`, `products`, `kanban`, `planning`.

### Planning-borden (nieuw in 0.11.0)
- [x] ~~**Planning als content**~~ — `planning` + `planning-item` contenttypen,
      admin-bord met drag&drop + edit-drawer, `planning`-widget (board- én
      generieke modus), `component.phase`-veld. Elke move = bitemporale versie.
- [ ] **Fasen-editor** voor de generieke widgetmodus — de `phases`-lijst is nu
      een JSON-box in de widget-config; verdient een rij-editor. _(S)_
- [ ] **Kaart-body echte rich text** — nu markdown-textarea; de WYSIWYG-editor
      (zie §7) zou hier ook passen, met een content-picker voor interne links
      (`[[type/slug]]`-autolink). _(chat-idee; M)_
- [ ] **Kaart-body-template configureerbaar** — bij het kiezen van een
      component vult een lege body nu vast met `Werken aan [naam](/…)`. Een
      per-bord of per-widget sjabloon met velden (`{{component}}`,
      `{{component.description}}`) zou dit vrij definieerbaar maken (à la de
      template-widget). _(chat-idee; M)_
- [ ] **Generieke modus verschuifbaar** — nu read-only; een gemachtigde
      gebruiker zou ook een component tussen fasen mogen slepen (zet
      `component.phase`). Meestal doet het project dit via de API. _(idee; M)_
- [ ] **Board as-of in de widget** — de widget leest `listItems` (huidig); de
      publieke weergave reist nog niet mee met time-travel (de historie zelf
      wél, via de item-versies). _(S)_

### Custom editors (het editor-seam bestaat, wordt nog nauwelijks benut)
- [ ] **Specs-editor** voor `product.specs` — nu een JSON-box, verdient hetzelfde
      grid als de table-widget. _(chat-idee; S)_
- [ ] **Downloads-editor** voor `release.downloads` (label/url/checksum). _(S)_
- [ ] **API-widget-editor** met een apart **zoekterm**-veld i.p.v. de query in de
      lange URL verstoppen — dit maakte de "Kraftwerk"-verwarring. _(chat-idee; S)_
- [ ] **Menu-items** in de `treeview`-widget: nu nog een JSON-box. _(S)_

### Nieuwe widgettypen
- [x] ~~**`itinerary`**~~ — gedaan in 0.8.0.
- [x] ~~**`gallery` / media**~~ — gedaan in 0.8.0 (gallery-widget + lightbox;
      `product.media` wordt op de productpagina gerenderd). Voor W3 rest **video**.
- [x] ~~**foto-carrousel**~~ — gedaan in 0.8.0.
- [x] ~~**externe foto-repo / Lightroom-view**~~ — gedaan in 0.8.0; de
      Lightroom-provider loopt sinds 0.8.1 de echte share-API af en is
      geverifieerd met Marks "@2020 Street"-album (11 foto's).
- [x] ~~**interactieve kaart**~~ — gedaan in 0.8.0 (Leaflet/OSM).
- [x] ~~**kanban-bord**~~ — gedaan in 0.8.0.
- [x] ~~**`downloads`**~~ — gedaan in 0.9.0 (W7).
- [x] ~~**`posts` / nieuws-feed**~~ — gedaan in 0.9.0 (W6-deel; RSS staat nog open).
- [x] ~~**`accordion` / FAQ**~~ — gedaan in 0.9.0.
- [x] ~~**`hero`**~~ — gedaan in 0.9.0.
- [x] ~~**`divider` / spacer**~~ — gedaan in 0.9.0.
- [x] ~~**`video`**~~ — gedaan in 0.9.0 (YouTube/Vimeo privacy-embed of bestand;
      rest van W3).
- [ ] **`search`** — zoeken in content (vergt eerst een zoekindex). _(idee; L)_
- [ ] **Lijst-varianten** — de `list`-widget kan alleen links; Pleio doet ook
      *feed* en *slider* als weergavevorm. _(idee; M)_

### Widget-contract
- [ ] **`help` als markdown** i.p.v. één regel, met een "meer info"-uitklap in de
      sidebar. _(chat-idee; S)_
- [ ] **Widget-versie pinnen** — het contract kent `version`, maar content kan er
      (nog) niet tegen pinnen. Pas nodig als er breaking widget-wijzigingen komen.
      _(chat-idee; M)_

---

## 2. Studio & admin

- [x] ~~**As-of-preview**~~ — gedaan in 0.10.0: "Time travel" op het
      admin-dashboard (draft mode + `asOf`-cookie; `currentRows` reist nu op
      beide tijdassen). Sinds 0.11.0 reizen ook de widgets met eigen
      store-reads (posts, list, releases, boardspec, itinerary, downloads,
      products) mee.
- [ ] **Preview-URL voor drafts** (S5: draft → preview-URL → publish). Nu wel
      draft-vlag + studio-concept, geen deelbare preview-link. _(S5; M)_
- [ ] **Drafts in een tabel** i.p.v. procesgeheugen — een niet-opgeslagen
      studio-concept overleeft nu geen serverherstart. _(bekend; M)_
- [x] **Users-beheer in de admin** — `/admin/users` (admins: toevoegen, rol,
      wachtwoord resetten, verwijderen; iedereen: eigen wachtwoord wijzigen),
      plus `npm run user` als noodingang via SSH. _(README)_
- [ ] **Sessie intrekken bij reset/rol/verwijderen** — de sessiecookie is
      stateless (HMAC, 12u), dus een gereset of gedegradeerde gebruiker blijft
      tot 12u ingelogd in een browser die al openstond. Vraagt een
      `session_epoch`-kolom die `getSession()` meeneemt. _(M)_
- [ ] **Wachtwoord vergeten zonder SSH** — nu is `npm run user -- passwd`
      (CLI, bij de database) de enige weg terug; september 2026 weer nodig
      gehad. Wacht op de configureerbare mail (§6); dan liever meteen de
      magic-link uit de requirements (§C) dan een reset-token-flow, met een
      "wachtwoord vergeten"-link op het loginscherm. _(S10-afhankelijk; M)_
- [ ] **Rollen per content-item** (`ContentUser`: creator/owner/contributor) staan
      in het schema maar worden niet gehandhaafd; S3 vraagt ook een
      *product-editor*-rol. _(S3; M)_
- [x] ~~**Default views uitbreiden (product)**~~ — gedaan in 0.12.0: vier
      subject-widgets (subjectheader, spectable, components, releases in
      product-modus) delen de secties met de ingebouwde pagina
      (`product-sections.tsx`), en `_view/product` wordt meegeseed als
      1-op-1-reproductie — overrulen is nu veilig én bewerkbaar. Nog open:
      - [ ] zelfde behandeling voor **component** en **release** (hun
            fallbacks zijn rijker: gepinde versie/kanaalweging resp.
            component-lijst). _(M)_
- [ ] **Media-bibliotheek** met automatische varianten (thumbnail/OG/hero). De
      AssetStore is er; upload-UI en varianten niet. _(S8; L)_
- [ ] **Chrome-varianten** — de grove pagina-indeling (logo-positie,
      header/footer-variant) parameteriseren per site, als server-side laag
      naast de client-side thema-tokens (zie architecture.md §3c). _(M)_
- [~] **Editor-demo online** (`/editor`, eis A1) — de MusicBrain-editor is een
      zelfstandige Vite/React-SPA zonder database (draait een complete synth
      in simulatiemodus). **Gekozen (juli 2026): eigen subdomein**
      `editor.musicbrain.nl` als aparte Plesk-vhost, gedeployd uit het
      MusicBrain-repo op eigen release-tempo; de editor is puur statisch
      (geen Node/Passenger, `vite base` blijft `/`). Imprint's `/editor`
      linkt erheen — geen ContentStore-koppeling.
      - [x] Imprint-kant: `/editor`-landingspagina + menu-item (juli 2026).
      - [x] MusicBrain-repo: editor in de huisstijl (variant B — licht
        werkinstrument met merk-accenten; `doc/styleguide.md` +
        `editor/src/tokens.css`), deploy-doc in `doc/editor-deploy.md`.
      - [x] Plesk: subdomein **editor.musicbrain.nl draait live** (statische
        docroot `editor/dist`, `npm install` i.p.v. `npm ci`, webhook aan).
      - [ ] Rest-styling: de laatste blauwtjes in uitklapmenu's, de
        cyaan-hue gelijktrekken met `--accent-2`, en de emoji in submenu's.
        Donker thema voor de editor is bewust géén doel (Mark werkt overdag
        liever licht); een kleurswitch ooit misschien. _(S)_
      _(A1; grotendeels af)_

---

## 3. Contentmodel, API & opslag

- [ ] **Engine en instanties werkelijk scheiden** — voer het
      [architectuurrevisievoorstel](design/engine-instance-plugin-architectuur.md)
      gefaseerd uit: composition root, gedeelde renderer/standaardwidgets,
      generieke admin en studio, daarna Planning als eerste proefplugin.
      MusicBrain blijft tijdens iedere fase releasable; Imprint is de tweede
      instantiatietest. Begin met Fase 0 (besluiten + karakterisatietests), niet
      met het kopiëren van `/admin`. Opdracht en volgorde:
      [opdrachtbrief](design/opdracht-engine-bibliotheek-backend-site.md)
      (vier lagen; Postgres-backend als spike vóór de composition root).
      _(architectuurrevisie; L)_
      - [x] **A. Fase 0 — architectuurcontract** (september 2026):
        `docs/architecture.md` §0 (vier lagen + regels + besluiten + open
        vragen) en karakterisatietests (`npm test`, §8): contractsuite voor
        file- en DB-store, schrijfkant, widget-model, relaties, itinerary,
        `layoutRows`, studio-ops, MusicBrain-catalogus.
      - [x] **Open vragen uit A** beslist (Mark, september 2026): basisthema's/
        presets horen in de bibliotheek, identiteit blijft van de site;
        "bibliotheek" is voorlopig een verzamelnaam, geen package-groep.
      - [x] **B. Postgres naast MariaDB** (september 2026): `DbContentStoreBase`
        + `PgContentStore`, schema/journal per dialect, Postgres in compose,
        beide backends door dezelfde lees- en schrijfcontractsuite;
        `sites/imprint` op Postgres, `sites/musicbrain` ongewijzigd.
      - [x] **Users op Postgres** (september 2026, Fase 3 stap 1) —
        `UserStore`-basis + `DbUserStore`/`PgUserStore`, één contractsuite op
        beide databases; `npm run user` en de seed volgen het URL-schema.
      - [ ] **Backup en assets-gc op Postgres** — `npm run backup` en
        `npm run assets:gc` zijn nog MariaDB-only; nodig vóór de Imprint-site
        een admin met echte content krijgt (Fase 3 stap 7). _(S)_
      - [ ] **MusicBrain naar Postgres?** — aparte beslissing nu B bewezen is;
        migratiepad = backup → seed via `openContentDatabase` (historie
        meenemen vraagt een rij-voor-rij kopie, geen `putItem`). _(M)_
      - [x] **C. Fase 1** (september 2026): `@imprint/extension-api` met
        `defineImprint()`/`createImprint()`; `imprint.config.ts` in beide
        sites, `content.ts`/`auth.ts`/`assets.ts` lezen uit de instantie.
      - [x] **Fase 2** — renderer + standaardwidgets naar de engine; viewers
        krijgen een expliciete `WidgetContext`; `chrome`, viewers en editors
        krijgen dan hun slot in `ImprintConfig`. _(L)_
        - [x] Stap 1, renderer vastgelegd (september 2026): golden HTML van
          `PageRenderer`, alle viewers, `DefaultView` en `SiteChrome` op de
          nieuwe `MemoryContentStore` (`sites/musicbrain/test/render/`).
        - [x] Stap 2, renderer en layouthelpers naar de engine (september
          2026): `@imprint/runtime-admin` met `PageRenderer`, `Widget`,
          `layoutRows` en `Markdown`; de site bindt hem aan haar viewers.
          Golden HTML en CSS ongewijzigd. Tailwind scant het package en slaat
          `test/` over; `css-coverage.test.ts` bewaakt dat voortaan.
        - [x] Stap 3, viewers een expliciete `WidgetContext` (september
          2026): `ctx` met store, schrijfkant en leesopties, per verzoek
          gebouwd in `src/lib/widget-context.ts`; lintregel tegen de oude
          imports; `DefaultView` mee naar de engine; module-mocks en de
          experimentele vlag weg uit de tests.
        - [x] Stap 4, catalogus splitsen (september 2026): twintig
          standaardwidgets naar `@imprint/widgets-standard` (schema's en
          viewers, per widget te kiezen); tien domeinwidgets blijven in
          MusicBrain; studio-catalogus aantoonbaar ongewijzigd; `WidgetFrame`
          naar de engine.
        - [ ] Slots voor `chrome` en editors in `ImprintConfig` — verschoven
          naar Fase 4, waar de studio ze nodig heeft. Viewers blijven een
          sitebinding (`src/components/page-renderer.tsx`), omdat
          `extension-api` framework-vrij blijft.
        - [x] Stap 5, het exitcriterium (september 2026): de Imprint-site
          rendert `/techniek` uit Postgres of `content/` met dezelfde
          renderer en acht gekozen standaardwidgets; tokencontract gevuld met
          het Imprint-palet.
        - [ ] **Basistaal per site** — de store gebruikt Engels als basis
          (`pickLang`), dus de Nederlandstalige Imprint-site moet haar
          pagina's als `en` opslaan om ze zonder taalparameter te tonen. Een
          `defaultLocale` uit de siteconfig als basis maakt dat recht. _(S9; M)_
        - [ ] **Viewers per widget importeerbaar** — `standardViewers` is één
          object, dus elke site bundelt alle twintig viewers en hun
          client-eilanden, ook als ze er acht kiest. Losse exports per widget
          laten de bundler de rest weglaten. _(S)_
        - [ ] **CSS-dekking ook voor de Imprint-site** — de golden-HTML- en
          CSS-dekkingstests bestaan alleen voor MusicBrain; de Imprint-CSS is
          bij stap 5 met de hand gecontroleerd. Het harnas delen zodra een
          tweede site het nodig heeft. _(S)_
        - [ ] **Navigatie van de Imprint-site uit de contentstore** — het menu
          is nog code, dus `/techniek` is alleen via de URL bereikbaar. _(S)_
      - [x] **Secrets in de config** (september 2026, Fase 3 stap 1) —
        `secrets` in `ImprintConfig`; alleen `imprint.config.ts` leest nog
        `process.env`.
      - [x] **Contenttypecatalogus beschikbaar/actief** (september 2026,
        Fase 3 stap 1) — `CONTENT_TYPES` + `contentTypes` in de config; de
        zeven losse typelijsten zijn weg. Het admin-menu leest er nog niet
        uit; dat hoort bij stap 5.
      - [x] **Browsertests van de admin** (september 2026, Fase 3 stap 2) —
        `sites/musicbrain/e2e/`: login, lijsten, opslaan met revalidatie,
        validatie, historie, herstel, aanmaken, verwijderen,
        gebruikersbeheer, studio-rooktest; productie én `next dev`.
      - [ ] **Leesbare validatiefouten in de itemeditor** — een ongeldige
        waarde geeft nu de ruwe zod-issues als JSON naast de knop
        (`[{"code":"too_small", … "path":["tagline"] …}]`). Per veld tonen,
        bij het veld. Hoort bij de formulieren (ontwerp §5); de browsertest
        in `e2e/content.spec.ts` moet dan mee. _(S)_
      - [ ] **Thema-script via `next/script`** — `ThemeInit` rendert een kale
        `<script>`; op een 404 in dev waarschuwt React dat die in de browser
        niet draait. Onschuldig (de server-HTML heeft hem al uitgevoerd), maar
        het staat nu als bekende uitzondering in `e2e/test.ts`.
        `strategy="beforeInteractive"` lost het op; toets dan het flitsvrije
        laden. _(S)_
      - [ ] **Dev-indicator bedekt de uitlogknop** — linksonder in de
        admin-rail, alleen in `next dev`. Verplaatsen via `devIndicators.position`
        of de knop. _(S)_
      - [x] **Fase 3 stap 4: admin-context en generieke clientcomponenten
        naar `@imprint/runtime-admin`** (september 2026) — `/admin`,
        `/forms`, `AdminContext`; actions als props.
      - [x] **Fase 3 stap 5, eerste helft: login, dashboard, lijst,
        itemeditor, historie en herstel uit het package** (september 2026)
        — `runtime-admin/admin-server`; menu uit de catalogus plus
        `contributions`; dunne routes in de site.
      - [x] **Fase 3 stap 5, tweede helft: gebruikers, relaties, default
        views en modeloverzicht uit het package** (september 2026).
      - [x] **Fase 3 stap 6 en 7** (september 2026) — sessie en preview in
        het package; de Imprint-site heeft `/admin` op Postgres (13 dunne
        bestanden). Getoetst met een Playwright-doorloop: inloggen, lijst,
        meta-save van een gecomponeerde pagina (layout blijft), historie,
        herstel, gebruikers, relaties, model, uitloggen, geen console-errors.
      - [ ] **Browsertests voor de Imprint-site** — de e2e-harnas
        (`sites/musicbrain/e2e`) is MusicBrain-specifiek (MariaDB, :3200);
        generaliseren naar een gedeelde `e2e/`-map met per site een
        database en poort, zodat de Imprint-admin ook in CI meeloopt. _(M)_
      - [ ] **Pagina's bewerken op de Imprint-site** — nu alleen het
        meta-formulier; de studio komt met Fase 4 naar het package. _(Fase 4)_
      - [ ] **Vaste pagina's van de Imprint-site naar content** (na Fase 4,
        besluit Mark september 2026) — `/mogelijkheden`, `/praktijk` en de
        tekst van `/` worden content-pagina's met de acht standaardwidgets;
        de homepage-route blijft code (merkbeleving). Voor de stukken die de
        huisstijl dragen komen site-eigen widgets: `capabilities`
        (genummerde lijst met Lucide-iconen) en `studio-scene` (de
        HTML/CSS-tekening van de studio); `/merk` blijft code of krijgt
        een eigen widget. Meteen een proef van het widgetmodel: kan een
        site zijn vormgeving als widgets aan de redactie aanbieden? Pas
        zinvol zodra de studio in het package zit. _(M)_
      - [ ] **Sessies intrekbaar** — besloten in het ontwerp Fase 3 (§1),
        maar nog zonder stap in het plan: een sessietabel of een
        versieteller per gebruiker, zodat een wachtwoordreset of uitloggen
        een gelekt cookie ongeldig maakt. _(S–M)_
      - [x] **Bouwen of lenen vóór Fase 3** — beslist (Mark, 16 september
        2026): eigen admin, van andere CMS'en alleen ideeën; formulieren en
        lijsten volgens Omnium; rechten via PxP met twee sidecar-PDP's
        (AuthZEN NL Gov, FTV); opslag op termijn als gegenereerd register.
        Zie [ontwerp Fase 3](design/fase-3-admin-toegang-tijdreizen.md); open vragen staan in §11.3
        daarvan.
      - [x] **Poortje in AuthZEN-vorm, asynchroon, beslisser in het proces;
        `access: public | restricted` op alle inhoud** (september 2026,
        Fase 3 stap 3) — `access.ts`; onbereikbare PDP = nee voor beperkt en
        schrijven; `/members/<slug>` voor beperkte pagina's en wiki's.
      - [ ] **Spoor toegang: twee PDP's als sidecar** — OpenFTV zoals in
        Omnium, HTTP-adapter achter `ImprintConfig.pdp`, correlatie
        (`trace_id` in `context`) met het logboek. Ontwerp §4. _(M)_
      - [ ] **Inlogpagina voor leden** — een reader logt nu in via `/admin`
        en ziet daar het formulier opnieuw (wel ingelogd). Eén `/login?to=`
        voor iedereen, met terugkeer naar de beperkte pagina; hoort bij de
        gedeelde admin (stap 5). _(S)_
      - [ ] **Ledenweergave van beperkte producten, componenten en releases**
        — die verdwijnen nu uit de publieke site; `/members/…` rendert alleen
        pagina's en wiki's. Met de default views (Fase 4) één generieke
        ledenroute per type. _(M)_
      - [ ] **Studio-canvas leest als bezoeker** — `widgetContext()` kent in
        de studio geen subject, dus een list-widget verbergt beperkte items
        voor de redacteur op het canvas. Subject doorgeven vanuit de studio
        (Fase 4). _(S)_
      - [ ] **Toegang per widget (deelcontent)** — een beperkte widget op
        een publieke pagina. Besluit Mark (september 2026): later, als eigen
        stap na Fase 3. Voorkeur Partial Prerendering (`cacheComponents`:
        statische schil, dynamisch gat per beperkte widget); alternatief laden
        in de browser via de API. Fase 3 reserveert alleen de plek in het
        schema. Ontwerp §4.3. _(L)_
      - [ ] **Spoor register: Imprint op een gegenereerd register** —
        contentmodel in V3 en het canonieke model (bron van waarheid; de
        eerste versie uit de zod-schema's), register genereren en als
        container draaien, `BitempContentStore` door de contractsuites,
        migratie met droogloop; eerst de Imprint-site. Ontwerp §3. _(L)_
      - [ ] **Voorwaarden in Omnium voor het register** — echte formele tijd,
        historie inlezen, materiële tijd als tijdstip en bevraagbaar, de
        gebruiker vastleggen bij een registratie, apart register per
        toepassing, schemawijzigingen uitvoeren, bulkimport, PEP per type en
        item, standaard weigeren. Werk in Omnium; ontwerp §3.3.
      - [x] **Tijdreislekken gedicht** (september 2026) —
        `getSiteConfig(opts)`, thema-CSS in de root-layout en default views
        lezen met de leesopties van het request. Ontwerp §8.4. Wat in code
        staat (widgetselectie, SiteChrome) en widgetversies blijven open.
      - [ ] **Widgetversie per instantie** — hoofdversie opslaan bij de
        widget, zodat een brekende widgetwijziging zichtbaar is bij
        tijdreizen. Ontwerp §9. _(M)_
      - [ ] **Fase 7 — configuratie in de tijd (voorstel)** — actieve
        catalogus, instellingen, formulier- en lijstdefinities en
        toegangsbeleid als bitemporele configuratie. Ontwerp §8.5; nog te
        besluiten. _(L)_
      - [ ] **Karakterisatie uitbreiden**: admin-flows (login, save,
        restore, studio-save) en API-routes zijn nog alleen end-to-end
        bewaakt (`npm run smoke`, `npm run testcase:bitemporal`); vóór
        Fase 3 vastleggen zoals de renderer. _(M)_

- [ ] **Typelijsten consolideren** — `ContentType` staat in vijf losse
      allowlists (admin-action, list/edit/history-routes, content-API's
      INGESTABLE). Bij de wiki-typen vergat ik er één en dat gaf een
      cryptisch "Unknown content type" pas bij het opslaan. Eén gedeelde
      bron per context (schrijfbaar / lijstbaar / ingestbaar) maakt een
      nieuw type weer één regel. _(S)_
- [ ] **Hulp in de admin: zelfde principe als Omnium** (Mark, 19 september
      2026) — nu is de admin-help een wiki op de publieke site (`/help`), en
      dat wringt: het is hulp bij de admin, niet voor bezoekers (als
      members-wiki gaf hij bovendien een 500, zie §6). Omnium heeft het
      principe al uitgewerkt: *hulp is aanwezig en bewust van de toestand,
      maar nooit modaal*, in oplopende "bij-de-hand-houden"-factor —
      mouseover → lege staten die uitleggen → command palette → eenmalige
      contextuele hints → checklist i.p.v. wizard; referentiedocumentatie
      apart, met "Meer…"-links erheen. Ontwerp: Bitemporal-repo
      `docs/plans/2026-09-10 Begeleiding in de Studio — palette, lege staten,
      hints, checklist (ontwerp).md` (backlog §28 daar). Voor Imprint is het
      metamodel het zod-schema: veldhulp afleiden uit `.describe()` in
      `SchemaForm`, widgethulp uit het widget-contract (§1 "`help` als
      markdown"), de Help-wiki als referentie. Eén ontwerp voor beide tools
      maken. _(ontwerp eerst; M)_
- [ ] **Handleiding: één bron kiezen** — de redacteurshandleiding leeft nu
      twee keer: `docs/handleiding.md` (git, reservekopie) en de Help-wiki
      (live, bewerkbaar). Dubbel onderhoud loopt uit de pas. Opties: de
      wiki leidend maken en het md-bestand laten vervallen (of genereren
      uit de wiki), of andersom een "publiceer docs → wiki"-script. _(S)_
- [ ] **Documentatie differentiëren** — `docs` is nu één optioneel veld (pagina-slug
      of inline markdown). Het UML liet `Documentation` bewust vaag; board-spec was
      de eerste uitwerking. _(open ontwerp; M)_
- [~] **Wiki (site-in-de-site)** — drie nieuwe contenttypen (Wiki /
      WikiFolder / WikiPage): een op zichzelf staande informatiebundel met
      eigen treeview-navigatie onder één URL-voorvoegsel (Help, Cortex
      deep-dive). Ontwerp: docs/design/wiki.md.
      - [x] Schema's + relatieregels + admin (juli 2026): de drie typen
        bestaan, met `visibility` op Wiki, enforced refs
        (page→folder→wiki), en beheer onder Content → Wiki. Verplaatsen =
        het folder-veld wijzigen.
      - [x] **PEP** (juli 2026): `authorize()` in lib/authorize.ts met
        inplugbaar `PolicyDecisionPoint`-interface (AuthZEN-snijvlak —
        gestandaardiseerd op het PEP↔PDP-contract, niet op een policytaal,
        zodat later een policies-als-content-PDP of Marks ODRL-gebaseerde
        taal kan inpluggen). `staticPdp` = vaste regelset; `canEdit()` is
        een wrapper over het PEP.
      - [x] Publieke route + wiki-chrome (juli 2026): `/<wiki>/…` rendert in
        de catch-all met navigatieboom links en pagina rechts. Opgelost op
        het laatste segment (paginaslug uniek per wiki), dus verplaatsen
        breekt geen links; het folderpad in de URL is cosmetisch.
        `visibility: members` gaat door het PEP en rendert dynamisch
        (ledencontent komt niet in statische HTML). Boom-query in
        lib/wiki.ts, view in components/wiki-view.tsx.
      - [x] **Wiki-studio v1** (juli 2026) — /admin/wiki (overzicht +
        aanmaken op titel) en /admin/wiki/[slug]: boom links (pagina's en
        folders slepen = folder/parent-veld wijzigen, cykel-bescherming),
        eigenschappen + markdown-tekst rechts, niets geselecteerd = de
        wiki zelf (titel/beschrijving/zichtbaarheid). Slugs worden per
        wiki gescopet en uit de titel gegenereerd (wiki-prefix +
        nummering). De platte typelijsten zijn uit de rail; generiek
        bewerken kan nog via /admin/wiki-folder e.d. Volgorde slepen met
        invoeg-streepjes zit erin (hernummering server-side), net als
        inline hernoemen (dubbelklik; slug blijft stabiel dus links breken
        niet) en cascade-delete van folders (compositie, met waarschuwing
        die de aantallen noemt). _(was M)_
      - [x] **Publiceer-knop** (juli 2026) — "Publiceer → live" in de
        studio: POST per item naar de live content-API (wiki → folders,
        ouders eerst → pagina's) met PUBLISH_URL/PUBLISH_TOKEN uit de
        lokale .env.local. Wiki-typen zijn INGESTABLE.
      - [x] Gedogfood (juli 2026): de handleiding leeft als Help-wiki
        (/help, 4 folders, 12 pagina's); docs/handleiding.md blijft als
        reservekopie.
      - [ ] **Publiceren spiegelt niet** — de knop telt op (nieuwe versies);
        een lokaal verwijderde pagina/folder blijft op het doel staan.
        Optie: een "wat verdwijnt er"-vergelijking vóór publiceren, of een
        expliciete sync-modus. _(S–M)_
      - [ ] **Wiki verwijderen** kan nergens (folders/pagina's wel). Zelfde
        patroon als delete-board: cascade + waarschuwing met aantallen.
        _(S)_
      - [ ] Later: policies als content (PDP/PAP), `[[wiki-links]]`,
        overerving van rechten, zoeken binnen een wiki. _(M–L)_
- [x] ~~**Asset-opruiming**~~ — gedaan in 0.11.0: `npm run assets:gc`
      (dry-run default, `--delete` om echt op te ruimen). Verwijdert alleen
      bestanden waar geen énkele historische rij naar wijst — History en
      time travel behouden hun assets.
- [ ] **MinIO/S3 AssetStore** — de interface is er, alleen de implementatie +
      config-wissel ontbreekt. _(D7; M)_
- [ ] **Migratie naar het bitemporal-register** (bitemporal2026) achter de
      `ContentStore`. _(README/§B3; L)_
- [x] ~~**RSS-feed**~~ — gedaan in 0.11.0: `/feed.xml` (W6-rest), met
      `rel=alternate` in de metadata.
- [ ] **sitemap.xml + robots.txt**; OG-images per pagina genereren. _(W13; M)_

---

## 4. Board/MMB-spoor

- [x] ~~**Overige 12 borden publiceren**~~ — gedaan: MMB heeft de volledige set
      gepubliceerd (incl. gswitch-serie), sinds 0.10.x mét 3D-modellen.
- [x] ~~**Hotspot-punten meesturen**~~ — gedaan: de specs komen met `points`
      binnen (de interactieve modus staat overal aan).
- [ ] **Herpost met `kind` + GLB naar live** — wacht op de Plesk-pull van
      v0.10.2; daarna één herpost-run van MMB (editors → "Software",
      3D-tabs live). _(MMB; S aan hun kant)_
- [x] ~~**Boards-index**~~ — gedaan in 0.10.0: `/boards`, kaartenraster met
      render, component en versie.
- [x] ~~**Componentpagina: gepinde versie prominent**~~ (MMB-testcase assert 4
      + vraag 4) — gedaan in 0.10.0: de door de nieuwste release gepinde
      versie is de hoofdweergave (met "pinned by"-badge naar de release,
      kanaalweging stable > beta > dev); overige versies ingeklapt onder
      "Other versions". Zonder pins: vlakke lijst zoals voorheen.

---

## 5. Website (requirements die nog open staan)

- [ ] **W1** Nieuwsbrief-signup met double opt-in (staat nu als "coming soon").
      Vergt S10. _(must; M)_
- [x] ~~**W2/S7** Release-feed automatisch uit GitHub~~ — gedaan in 0.11.0:
      `POST /api/webhooks/github` (HMAC-signature, `GITHUB_WEBHOOK_SECRET`);
      repo→project/product-mapping in de site-config (`releaseSources`).
      Nog te doen aan jouw kant: secret zetten + webhook aanmaken in de
      GitHub-repo('s) + mapping invullen.
- [ ] **W4** Beta-/interesse-aanmelding per product (formulier → lijst). _(must; M)_
- [ ] **S10** Formulieren → DB + notificatie-mail + spam-bescherming (de basis
      onder W1/W4). _(must; L)_ **Spooraanpassing (juli 2026)**: Mark bouwt in
      het bitemporal-project (Omnium) een metamodel-gedreven formuliereditor +
      React-renderer. Imprint levert de datakant:
      - [x] ~~metamodel uitleesbaar~~ — gedaan in 0.11.0: `GET /api/meta`
            (JSON Schema 2020-12 per contenttype, uit dezelfde zod-schema's,
            plus de relatieregels als referentietypen en de afgeleide
            itinerary).
      - [x] ~~**V3-formaat**~~ — gedaan in 0.11.0: `GET /api/meta?format=v3`
            levert het geneste `V3Model` (spec: design/v3-metamodel-spec.md;
            mapping: `v3-export.ts` — GE/relatie-splitsing, velden óp de
            relatie zoals Release↔Component-versie, centrale enums,
            datatypes Slug/Versienummer/Markdown/Kleur/AssetUrl/Json).
      - [ ] **Formulier-renderer als widget** — de Omnium-renderer (React)
            inpluggen als `form`-widget: configschema verwijst naar een
            formulierdefinitie, submits → S10-opslag. Aangescherpt
            (september 2026, [design/nl-design-system.md](design/nl-design-system.md)):
            - [ ] Utrecht in Omnium van `^13` naar 15 bijwerken. _(Omnium; S)_
            - [ ] Renderer uit Omnium losmaken als package: schema,
                  validatie en referentielijst-opties aangereikt i.p.v.
                  `useSchema()`/`fetch` naar `/api/viz/…`. _(Omnium; M)_
            - [ ] `form`-widget: server-viewer + renderer als client-eiland,
                  NL Design System als **CSS-klassen** (losse
                  `@utrecht/*-css`-packages, niet de React-bibliotheek: geen
                  `"use client"`) en een `nlds-bridge.css` die de
                  `--utrecht-*`-tokens aan de Imprint-tokens koppelt. _(M)_
            - [ ] Inzendingen buiten de bitemporele store (AVG: wisbaar).
            - [ ] NLDS-formulierrichtlijnen afvinken voor de widget en voor
                  `SchemaForm` in de admin. _(S)_
- [ ] **Productpagina toont toekomstige releases** — de releases-sectie in
      productmodus (`ProductReleases`, ook de `releases`-widget met een
      product) leest `listItems` zonder datumfilter, dus een release met een
      datum in de toekomst staat er al, terwijl `/releases` en de
      `downloads`-widget hem verbergen. Gevonden bij de renderer-
      karakterisatie (september 2026); bewust nog niet gerepareerd. _(S)_
- [ ] **W3** Foto/video op de productpagina (zie gallery-widget). _(must; M)_
- [ ] **W5/S9 Meertaligheid** — het fundament bestaat (elk item heeft `lang`,
      EN→NL-fallback in beide stores, `?lang=` op de API), maar er is nog
      geen gezicht: geen taal-switcher op de site, geen NL-content, en in de
      admin geen taalkeuze-flow (vertaling maken = zelfde slug met
      `lang: nl` opslaan, maar geen knop "vertaal dit item"). Ook nog open:
      `hreflang`/URL-strategie. **Ontwerp ligt klaar** (beheer-flow, fasering):
      [design/meertaligheid.md](design/meertaligheid.md). _(should; L)_
- [ ] **W8** Press kit als downloadbare zip. _(should; S)_
- [ ] **W11** Community: links + GitHub Discussions embed. _(should; S)_
- [ ] **W12** Privacy-vriendelijke analytics (Plausible/Umami). _(should; S)_
- [ ] **W9** Embedded demo van de editor. **Ontwerp ligt klaar** (aparte
      demo-imprint met nachtelijke reset; open vragen voor Mark):
      [design/editor-demo.md](design/editor-demo.md). _(could; M)_
- [ ] **W10** Dealer-portal achter login. _(later; L)_
- [ ] **Placeholder-content vervangen** — productteksten, links, domein zijn nog
      door mij verzonnen. _(README; M — jouw tekst)_

---

## 6. Deploy & beheer

- [x] ~~**Deploy naar Plesk**~~ — live op https://musicbrain.nl sinds juli 2026;
      update-flow bewezen bij 0.9.0 (pull → gericht bijseeden → rebuild →
      `npm run smoke`). Servercommando's zonder SSH via Scheduled Tasks
      (patroon in de README).
- [x] ~~**CI**~~ — gedaan in 0.10.0: GitHub Actions draait typecheck + lint +
      build (file-store, geen DB) bij elke push/PR.
- [x] ~~**Deploy-inrichting VPS**~~ — september 2026: Dockerfile + `deploy/vps/`
      (compose, `deploy.sh`, `backup.sh`, Caddy-blok), lokaal getest voor beide
      sites; zie [deploy-vps.md](deploy-vps.md). **Imprint-site live** sinds
      19 september op https://imprint.musicbrain.nl (tijdelijk adres, noindex).
- [x] ~~**imprint-engine.nl aanzetten**~~ — live sinds 19 september 2026;
      `www` en `imprint.musicbrain.nl` sturen door.
- [x] ~~**Cron voor `backup.sh` + NAS-pull**~~ — cron sinds 19 september
      (03:15 UTC); sinds 21 september haalt de NAS elke dag om 06:00 op
      (`Pool1/backup/vps1/imprint`, alleen-lezen sleutel via `rrsync`, getest).
      Nog open op de NAS: een snapshot-taak voor de lange historie, want de VPS
      bewaart maar 3 dagen. Eerder: de Rsync-pull door de NAS, samen met die van
      Omnium. Stappen in [deploy-vps.md](deploy-vps.md) §Backups en in het
      Bitemporal-repo `docs/plans/2026-09-20 NAS haalt de VPS-backups op`.
      `backup.sh` neemt sinds 21 september ook `volksgebouw_data` en
      `psycholog_data` mee (volume + `.env` per site; regel `EXTRA` in het
      script), dus alle vijf de sites zitten in de nachtelijke backup. _(XS)_
- [x] ~~**De andere twee Quickhost-sites naar de VPS**~~ — 21 september 2026:
      **volksgebouwzeist.nl** (Next 14, agenda uit Google Calendar,
      contactformulier via de Quickhost-relay; de open schrijfkant van
      `/api/events` is dichtgezet) en **psycholog.pi-utrecht.nl** (Next 14,
      PL/NL/EN, eigen mini-CMS dat naar GitHub commit). Elk repo heeft nu een
      `Dockerfile` + `deploy/vps/` met README; de VPS heeft per privé-repo een
      alleen-lezen deploy-key. Nog open daar: de uploads van
      psycholog.pi-utrecht.nl van Plesk halen (staan nergens anders, dus de
      `/d/<uuid>`-links werken nog niet), de klassieke GitHub-token vervangen
      door de fine-grained `ewa-site-PAT`, en een Action voor automatisch
      deployen. Een migratie van die twee náár Imprint is een aparte afweging:
      wat Imprint daarvoor mist is meertaligheid in de admin (psycholog), een
      agendawidget en formulieren met mail (volksgebouw), en een
      mediabibliotheek met kiezer — zie §1, §2 en §5.
- [x] ~~**MusicBrain naar de VPS**~~ — 19 september 2026: lokaal + live-
      bewerkingen samengevoegd, naar Postgres gekopieerd, DNS om; smoke groen.
      Verslag in [deploy-vps.md](deploy-vps.md).
- [x] **Members-wiki geeft 500 in productie** (september 2026, Fase 3
      stap 3) — beperkte wiki's en pagina's renderen onder `/members/…`
      (`force-dynamic`); de statische catch-all leest geen cookies meer.
- [ ] **Opruimen na de verhuizing** — de Plesk-deploywebhook op GitHub
      verwijderen (hook 655391019, naar `cordelia.exsilia.net`); het
      `MUSICBRAIN_GITHUB_WEBHOOK_SECRET` op de VPS is een testwaarde: echte
      waarde uit Plesk overnemen als er een release-webhook naar
      `/api/webhooks/github` wijst; README §"Deploy naar Plesk" en
      overdracht.md §3 inkorten. _(S)_ — **19 september:** Plesk-webhook
      verwijderd; er wijst geen release-webhook naar musicbrain.nl en de
      site-config heeft geen `releaseSources`, dus het secret is leeg
      gemaakt (de route antwoordt 503 "webhook disabled"). Quickhost blijft
      (all-in hostingpakket): DNS, mail en `editor.musicbrain.nl` staan daar.
      Rest: README/overdracht inkorten.
- [ ] **Volgorde van `listPages` is niet deterministisch** — pagina's met
      dezelfde (of geen) `publishedAt` komen in database-volgorde terug; die
      verschilt tussen MariaDB en Postgres bij reads met `asOf` (gezien bij de
      kopie-controle). Tie-break op slug in `db-store-base.ts`; let op de
      golden-HTML-tests. _(XS)_
- [ ] **`npm run backup` schrijft verschoven tijden** — het leest met kale
      mysql2, die DATETIME als lokale tijd interpreteert, terwijl drizzle er
      UTC in zet. De ISO-tijden in `content_items.jsonl` liggen dus de
      tijdzone van de server ernaast; terugzetten op dezelfde machine heft dat
      op, elders niet. Fix: `dateStrings: true` en als UTC lezen, zoals
      `copy-mariadb-to-pg.ts`. _(XS)_
- [ ] **`npm run backup` en `assets:gc` op Postgres** — beide zijn nog
      MariaDB-only (`mysql2` rechtstreeks). Op de VPS vangt `backup.sh`
      (pg_dump) de backup op; `assets:gc` heeft nog geen vervanger. _(S)_
- [ ] **Image bouwen zonder database (CI/registry)** — kan zodra de publieke
      routes niet meer bij de build prerenderen maar bij het eerste verzoek
      (lege `generateStaticParams` + ISR); dan is de image
      omgevingsonafhankelijk en kan GitHub Actions hem bouwen. _(M)_
- [ ] **Seed triggert revalidatie** — `db:seed` schrijft rechtstreeks in de
      DB en leegt de Next-cache niet; geseede content verschijnt pas na een
      rebuild óf een willekeurige admin-save (juli 2026 live gebleken bij de
      "open brain"-uitrol: build vóór seed = oude content in de statische
      pagina's). Seed zou na afloop de revalidate-hook moeten aanroepen, dan
      is de volgorde niet meer belangrijk. _(S)_
- [ ] **Mail configureerbaar per instantie** — plan en keuze staan in
      [design/mail.md](design/mail.md) (19 september 2026: eerst de
      SMTP-relay van Quickhost, later een transactionele dienst). Kort: een
      `mail`-blok in
      `imprint.config.ts` (SMTP-host/poort/credentials uit de omgeving,
      afzender per site) met één `sendMail()` in de engine; geen mail
      geconfigureerd = functies die mail nodig hebben nette melding. Eerste
      gebruikers: wachtwoord-vergeten/magic-link (§2) en admin-mededelingen
      (nieuwe gebruiker aangemaakt, ingest-fout, backup mislukt, wekelijkse
      samenvatting).
      **De route is bewezen** (21 september 2026, contactformulier van
      volksgebouwzeist.nl op de VPS): Quickhost als relay, met
      `mail.<domein>:465` (SSL) en een mailbox van het domein. Onthoud van die
      exercitie: 587/STARTTLS weigert altijd (`454 … generic failure`, dezelfde
      melding als bij een niet-bestaande mailbox), en **niet** het kale domein
      als host nemen — Plesk noemt dat in "Mail Client Setup", maar dat A-record
      wijst na de verhuizing naar de VPS; `mail.<domein>` is ook de enige naam
      met een passend certificaat. Details in [design/mail.md](design/mail.md).
      Bouwen kan wachten tot §2 (wachtwoord vergeten) opgepakt wordt; dat is de
      eerste functie die mail nodig heeft. _(vraag van Mark, september 2026; M)_
- [x] ~~**Backups**~~ — gedaan in 0.11.0: `npm run backup` (hele bitemporale
      historie + users + assets, retentie 14, Node-only dus Plesk-Scheduled-
      Task-klaar); zie [backups.md](backups.md). Nog te doen: de dagelijkse
      taak aanmaken op Plesk + af en toe een backup van de server halen.

---

## 7. Open beslissingen (vragen aan Mark)

- [ ] **`image` en `board` samenvoegen?** Beide zijn "afbeelding + punten"; je wilde
      ze voorlopig apart houden omdat de board-kant zich apart kan ontwikkelen
      (pinouts zijn SVG's op de render → beeld-op-beeld).
- [ ] **Echte WYSIWYG-markdown?** Nu contentEditable + marked/turndown met een
      Markdown-tab. Een zwaardere editor (Milkdown/TipTap) kan op dezelfde plek
      inpluggen als je meer wilt.
- [ ] **Postgres of MariaDB?** S11 noemt PostgreSQL; we koersen bewust op MariaDB
      (Plesk). Prima keuze, maar het staat nog als afwijking in de requirements.
- [x] ~~**Relations aanzetten**~~ — gedaan: de default-regels staan aan in de
      dev-DB (op Plesk straks nogmaals via /admin/relations → Load defaults).

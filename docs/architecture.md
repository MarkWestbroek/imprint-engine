# Imprint — architectuur

Eén publicatie-motor, meerdere merk-sites ("imprints"). Dit document beschrijft
het ontwerp zoals het er staat; de requirements staan in
[website-requirements.md](website-requirements.md) (eisnummers W*/S*/§B/§C
worden in code-comments aangehaald).

De voorgestelde revisie waarin runtime, admin, widgets en plugins werkelijk
site-onafhankelijke engineonderdelen worden staat in
[Revisievoorstel — engine, instanties, widgets en plugins](design/engine-instance-plugin-architectuur.md).
Dat document is normatief voor de gewenste richting, maar nog niet volledig
geïmplementeerd; dit document blijft de beschrijving van de huidige werking.

## 0. Architectuurcontract: vier lagen

Vastgelegd in september 2026 (Fase 0 van het
[revisievoorstel](design/engine-instance-plugin-architectuur.md), volgens de
[opdrachtbrief](design/opdracht-engine-bibliotheek-backend-site.md)). Dit is
het contract waar de extractie in de volgende fasen aan getoetst wordt; de
rest van dit document beschrijft hoe de code er *nu* bij ligt, en die twee
lopen bewust nog uiteen.

| laag | inhoud | staat nu in | mag afhangen van |
|---|---|---|---|
| **Engine** | contentcontracten (zod-schema's, `ContentStore`/`WritableContentStore`, `ContentType`), widget-model, relatieregels, afgeleide domeinlogica, gebruikers/wachtwoordbeleid, renderer, publieke API, admin/studio ("editor-motor") | `packages/content-core` (contracten); `packages/runtime-admin` (renderer, `DefaultView`, `WidgetContext`, layouthelpers, `Markdown`, `WidgetFrame`; sinds Fase 3 stap 4 ook `/admin`: de generieke admin-clientcomponenten, `/forms`: formulierschema's, en `AdminContext`); `content-core/access.ts` (PEP/PDP); API, admin-routes en -actions, sessie, studio-ops en de widget-viewers nog in `sites/musicbrain/src` | niets in `sites/*`; geen concrete site-naam, geen concreet domein |
| **Bibliotheek** | herbruikbare onderdelen die een site *kiest*: widgets (schema + viewer + optioneel editor), plugins (nog geen package), mogelijk basisthema's/presets | `packages/widgets-standard` (twintig standaardwidgets: schema's en viewers); MusicBrains domeinwidgets en alle editors nog in `sites/musicbrain/src/widgets/` | de engine-contracten (`WidgetTypeDef`, `ContentStore`), nooit een site |
| **Backend** | opslagimplementaties achter het `ContentStore`-contract: file, MariaDB, Postgres, later het bitemporele register | `file-store.ts`; `db-store-base.ts` (gedeelde semantiek) + `db-store.ts`/`db-schema.ts` (MariaDB) + `db-store.pg.ts`/`db-schema.pg.ts` (Postgres) + `memory-store.ts` (in geheugen, voor tests); keuze via `db.ts` | de engine-contracten (`store.ts`, `schemas.ts`, `widgets.ts`); niemand kent een backend behalve de composition root |
| **Site** ("imprint") | gekozen engineversie + bibliotheekkeuze + backendkeuze + eigen merk (SiteChrome, design-tokens), content, DB, assets, secrets, sessiecookie | `sites/musicbrain`, `sites/imprint`; de composition root is per site `imprint.config.ts` (`defineImprint()`), tot leven gebracht in `src/lib/content.ts` (`createImprint()`) | engine + bibliotheek + precies één backend |

```mermaid
flowchart TB
    subgraph site["Site (per imprint)"]
        ROOT["composition root<br/>imprint.config.ts → createImprint()"]
        CHROME["SiteChrome, globals.css, content/, secrets"]
    end
    subgraph lib["Bibliotheek"]
        WIDG["widgets: registry + viewers + editors"]
        PLUG["plugins (later)"]
    end
    subgraph engine["Engine"]
        EXT["extension-api:<br/>defineImprint / createImprint"]
        CONTRACT["contracten: schemas, ContentStore,<br/>WidgetTypeRegistry, RelationRules"]
        RT["runtime: renderer, publieke API"]
        ADM["admin/studio"]
    end
    subgraph backend["Backend"]
        FILE["FileContentStore"]
        MARIA["DbContentStore (MariaDB)"]
        PG["PgContentStore (Postgres)"]
        BT["bitemporeel register (later)"]
    end

    ROOT --> EXT
    EXT -- "kiest één" --> backend
    EXT --> CONTRACT
    ROOT --> RT
    ROOT --> ADM
    ROOT --> WIDG
    CHROME --> RT
    WIDG --> CONTRACT
    PLUG --> CONTRACT
    RT --> CONTRACT
    ADM --> CONTRACT
    FILE -. implementeert .-> CONTRACT
    MARIA -. implementeert .-> CONTRACT
    PG -. implementeert .-> CONTRACT
    BT -. implementeert .-> CONTRACT
```

Pijlen zijn de *enige* toegestane afhankelijkheden. Concreet:

1. **Site → engine, nooit andersom.** Enginecode bevat geen verwijzing naar
   `musicbrain`, `imprint` of een ander site-id; sitekeuzes komen binnen via
   de composition root (dependency injection), niet via `if (site === …)`.
2. **Engine-contracten kennen geen React of Next.js.** `content-core` blijft
   framework-vrij; renderer en admin (die wél React kennen) horen bij de
   engine maar zijn een aparte laag dáárboven (het toekomstige
   `@imprint/runtime-admin`-package, eerst één package — voorstel §18).
3. **Backend alleen via `ContentStore`.** Site-, admin- en widgetcode praten
   uitsluitend via `ContentStore`/`WritableContentStore` met content; nooit
   met drizzle, SQL of bestanden. Alleen de composition root instantieert een
   backend. Een nieuwe backend = één implementatie van het contract die de
   contractsuite (§8) doorstaat; hij raakt geen paginacode.
4. **Bibliotheek → engine-contracten, nooit een site.** Een widget importeert
   geen site-globaal storebestand en geen SiteChrome; hij krijgt zijn context
   (store, subject) aangereikt. Sinds Fase 2 is dat de `WidgetContext`,
   afgedwongen met een lintregel in de site. Een site kiest widgets **individueel** (de
   registry werkt al per widget); een "bundel" is niet meer dan een
   gemaks-export.
5. **Per site: eigen database, assets, secrets en sessiecookienaam.** Gedeelde
   code, aparte app en database per instantie; geen multitenant admin in deze
   fase (voorstel §18, bevestigd in de opdrachtbrief).
6. **Tijd is een leesparameter van het contract, niet van de backend.**
   `ReadOptions.asOf` is de materiële tijd ("gold op"). Het contract moet
   later ook een formele tijd ("beweerden wij op") als aparte leesparameter
   kunnen dragen zonder site-code te raken, zodat een `BitempContentStore` op
   het bitemporele register inplugbaar blijft. Nu vullen de backends dat
   verschillend in: de DB-store legt `asOf` op **beide** assen, de file-store
   kent alleen valid time (vastgelegd in de karakterisatietests, §8).

### Besluiten (genomen zonder Mark, terug te draaien als hij anders wil)

- **Product/component/release blijven voorlopig in core.** `plugin-catalog`
  komt pas in Fase 5 aan bod, ná Planning en Wiki (de volgorde van het
  voorstel §12); vroeger extraheren geeft nu geen tweede gebruiker.
- **Standaardwidgets zijn individueel kiesbaar** (regel 4); de catalogus van
  MusicBrain is met een test vastgepind zodat verplaatsen niets verandert.
- **Onbekende of uitgeschakelde widget blijft een harde fout** bij lezen én
  opslaan (huidig principe, nu getest). Een placeholder voor beheerders is
  een Fase 6-verfijning, geen contractwijziging.
- **Pluginconfig is code-only** in de composition root. Bewerkbare
  beheerconfig als content (met eigen schema) mag een plugin later zélf
  toevoegen; het contract sluit dat niet uit.
- **Postgres als tweede databasebackend, MariaDB blijft** (opdracht B,
  gerealiseerd — zie §4); het argument "MariaDB omdat shared hosting dat
  biedt" is met de VPS vervallen.
- **Reikwijdte van de bibliotheek** (Mark, september 2026): de bibliotheek
  levert *basisthema's/presets* (design-tokens, een neutrale SiteChrome); de
  site blijft eigenaar van haar merk. Herbruikbaar = bibliotheek, identiteit
  = site.
- **"Bibliotheek" is voorlopig een verzamelnaam** voor `widgets-standard` +
  `plugin-*` (Mark, september 2026); een package-prefix (`packages/library-*`)
  pas als er meer dan twee bibliotheek-packages zijn.

### Composition root (Fase 1, september 2026)

Elke site beschrijft zichzelf één keer in `imprint.config.ts` met
`defineImprint()` uit [`@imprint/extension-api`](../packages/extension-api/src/index.ts):

```ts
export default defineImprint({
  id: "musicbrain",
  store: { databaseUrl: process.env.DATABASE_URL, contentDir: path.join(process.cwd(), "content") },
  widgets: widgetRegistry,                       // de catalogus (configschema's)
  contentTypes: ["page", "menu", "theme"],       // optioneel: welke typen actief zijn (default alle)
  session: { cookie: "imprint_session", hours: 12 },
  assets: { root: process.env.ASSET_ROOT, baseUrl: process.env.ASSET_BASE_URL },
  secrets: { session: process.env.SESSION_SECRET, ingestToken: process.env.INGEST_TOKEN /* … */ },
});
```

`createImprint(config)` in `src/lib/content.ts` maakt daar de levende
instantie van (`ImprintInstance`): `store`, `writableStore` (null in
file-modus), `users` (null in file-modus), `widgets`, `contentTypes`,
`assets`, `session` en `secrets`. Eén instantie per proces per id (cache op `globalThis`, dezelfde
truc als vroeger voor de connection pool). De backend volgt het URL-schema
via `openContentDatabase()`; geen URL = file-store op `contentDir`.

Wat daarmee verschoven is: `auth.ts` haalt cookienaam, sessieduur en de
`UserStore` uit de instantie; `assets.ts` de `FileAssetStore`; `content.ts`
de stores. De 36 modules die `@/lib/content` importeren merken niets — dat
was de eis van Fase 1 ("zonder zichtbaar gedrag te veranderen"). Het package
is bewust framework-vrij: SiteChrome, viewers en editors blijven in de site
tot de renderer- en admin-extractie (Fase 2 en 4) ze een getypeerd slot
geeft.

**Secrets** (`SESSION_SECRET`, `INGEST_TOKEN`, `GITHUB_WEBHOOK_SECRET`,
`PUBLISH_*`) staan in de omgeving, maar alleen `imprint.config.ts` leest ze
(`secrets`); de rest van de site, en straks de gedeelde admin, krijgt ze van
de instantie en kent geen `process.env`. De config valideert ze bewust niet:
een kale checkout moet bouwen, en een ontbrekend secret faalt of schakelt uit
op de plek waar het nodig is (geen sessiesecret = niemand logt in; geen
ingest-token = de schrijf-API staat uit).

**Contenttypen als definities** (ontwerp Fase 5 §3.1). Eén
`ContentTypeDefinition` per type in
[content-types.ts](../packages/content-core/src/content-types.ts): schema,
label, vlaggen (`listable`, `editable`, `ingestable`, `overview`,
`viewable`), menuplek, domein, relatieregels, startwaarden, sleutel en
optioneel het formulierschema. De kern levert zijn typen in
[core-content-types.ts](../packages/content-core/src/core-content-types.ts);
plugins en site voegen de hunne toe. *Beschikbaar* is het
`ContentTypeRegistry` (kern + plugins + site) — de store valideert
schrijfacties ermee, een niet-geregistreerd type wordt geweigerd, bestaande
rijen blijven leesbaar. *Actief*: `contentTypes` in `imprint.config.ts`, als
`ContentTypeCatalog` over dat register op de instantie. `ContentType` is een
open string (besluit Mark, Fase 5): de compiler kent de lijst niet meer, het
register bewaakt op runtime, zoals bij widgets. Admin-routes, server actions, dashboard, relatie-editor en
`/api/content` vragen `contentTypes.has(type, "editable")` in plaats van elk
een eigen lijst te houden. De store zelf filtert niet: die bewaart elk type.
"Actief" is configuratie en hoort op termijn in de tijdlijn (§8 van het
ontwerp); nu is het code.

### Nog open

- **Vierde backend** (bitemporeel register, Omnium): niet bouwen; wel de
  formele-tijd-parameter uit regel 6 meenemen zodra het contract wordt
  aangeraakt (Bitemporal_2026 `docs/BACKLOG.md` §27.2).

## 1. Overzicht

npm-workspaces-monorepo. De kern (`@imprint/content-core`) kent schema's,
opslag en het widget-model, maar geen React en geen concrete widgets; elke
site levert zijn eigen gezicht én zijn eigen widget-catalogus.

```mermaid
flowchart LR
    subgraph core["packages/content-core"]
        SCH["schemas.ts<br/>zod-schema's per contenttype"]
        WID["widgets.ts<br/>PageLayout, WidgetTypeRegistry"]
        ST["store.ts<br/>ContentStore + WritableContentStore"]
        FS["file-store.ts"]
        DBS["db-store.ts"]
    end

    subgraph runtime["packages/runtime-admin"]
        REN["PageRenderer + layoutRows<br/>kent geen concrete widgets"]
    end

    subgraph lib["packages/widgets-standard"]
        STD["standaardwidgets<br/>schema's + viewers"]
    end

    subgraph site["sites/musicbrain (Next.js 16)"]
        PUB["(site)/ publieke pagina's"]
        ADM["admin/ editor-UI"]
        CAT["src/widgets/<br/>catalogus: standaard + domein"]
        BIND["components/page-renderer.tsx<br/>renderer + eigen viewers"]
    end

    FILES[("content/ bestanden<br/>(v0 + seed-bron)")]
    DB[("MariaDB<br/>content_items + users")]

    PUB --> ST
    ADM --> ST
    PUB --> BIND
    BIND --> REN
    BIND -. viewers .-> CAT
    CAT -. kiest .-> STD
    ST --> FS --> FILES
    ST --> DBS --> DB
    CAT -. "valideert configs" .-> WID
```

De site praat **uitsluitend** via de `ContentStore`-interface met content
(S1/§B3). Met `DATABASE_URL` gezet kiest [content.ts](../sites/musicbrain/src/lib/content.ts)
de database-store; zonder valt hij terug op de file-store, zodat een kale
checkout (en CI) altijd bouwt.

## 2. Contentmodel

Implementatie van het UML-contentmodel. Elk type heeft een zod-schema in
[schemas.ts](../packages/content-core/src/schemas.ts) — dat ene schema
valideert de content bij het lezen én genereert de admin-formulieren.

```mermaid
classDiagram
    class Site { name, tagline, baseUrl, links }
    class Page { slug, lang, title, draft, publishedAt, body, layout? }
    class Product { slug, name, status, specs[] }
    class Release { project, version, date, channel }
    class Menu { name }
    class MenuItem { label, url? }
    class PageLayout
    class LayoutRow
    class LayoutCell { span }
    class Widget { type, config }
    class WidgetType { name, configSchema }
    class User { name, hashedPassword, role }

    Site *-- Page
    Site *-- Product
    Site *-- Release
    Site *-- Menu
    Menu *-- MenuItem
    MenuItem o-- MenuItem : children
    MenuItem --> Page : points to 0..1
    Page *-- PageLayout
    PageLayout *-- LayoutRow : rows
    LayoutRow *-- LayoutCell : cells (vakken)
    LayoutCell o-- Widget : 0..*
    Widget --> WidgetType : /type
    User --> Page : ContentUser (v2, nog niet afgedwongen)
```

Verschillen met het oorspronkelijke UML:

- `ContentItem`-subklassen zijn aparte zod-schema's; het `/type`-kenmerk is
  de `type`-kolom in de database. `NewsItem` is een pagina onder `posts/`.
- `PageLayout` is het Pleio-achtige vakkenmodel: **rijen → cellen → widgets**.
  Een cel heeft een relatieve breedte (`span` in fractie-eenheden: cellen
  1|2 renderen als ⅓ + ⅔). Een ouder formaat (template + regio's) parseert
  nog en wordt bij renderen/bewerken naar rijen omgezet.
- `User`/`RoleType` zijn actief (admin-login); de rol per content-item
  (`ContentUser`) staat in het schema maar wordt nog niet gehandhaafd.
  Gebruikers lopen **niet** via de `ContentStore`: ze zijn geen content en
  krijgen bewust géén historie — een bitemporale tabel bewaart elke rij voor
  altijd, en dat is precies wat je met wachtwoordhashes niet wilt. Ze hebben
  een eigen `UserStore`, opgezet als de contentstores: de regels in
  [user-store-base.ts](../packages/content-core/src/user-store-base.ts), per
  dialect vijf rij-operaties (`DbUserStore` voor MariaDB, `PgUserStore` voor
  Postgres), gedeeld door
  **/admin/users**, de seed en de `npm run user`-CLI, zodat de regels
  (wachtwoordlengte, "laatste admin blijft admin") overal gelden. Hashing en
  wachtwoordbeleid staan apart in
  [passwords.ts](../packages/content-core/src/passwords.ts).
- **Sessies** zijn stateless: een HMAC-ondertekend cookie met naam, rol en
  vervaltijd (12u), zonder tabel. Dat betekent dat een wachtwoordreset of
  rolwijziging een al openstaande sessie niet intrekt — die loopt gewoon af.
  Acceptabel bij deze handvol vertrouwde gebruikers; een `session_epoch`-kolom
  zou het dichtzetten (backlog).

## 3. Widgets: kern kent het model, de site de catalogus

Een widgettype bestaat uit drie stukken; alleen het eerste is verplicht
handwerk, de editor heeft een schema-gedreven default:

| stuk | bestand | draait | rol |
|---|---|---|---|
| **configschema** | `@imprint/widgets-standard/schemas` of `src/widgets/registry.ts` | overal (geen React/store) | valideert de config; bron voor het default-editorformulier |
| **viewer** | `@imprint/widgets-standard/viewers` of `src/widgets/components.tsx` | server | rendert de widget op de site; leest content via de aangereikte `ctx`, mag externe API's aanroepen |
| **editor** | `src/widgets/editors.tsx` | client | bewerkt de config in de studio; default = formulier uit het schema, alleen overriden voor rijkere bewerking |

```mermaid
flowchart LR
    JSON["page-layout in DB/bestand<br/>{ type: 'api', config: {...} }"]
    REG["WidgetTypeRegistry<br/>(kern, generiek)"]
    RTS["registry.ts<br/>configschema per widgettype"]
    CTS["components.tsx<br/>viewer (server component)"]
    ETS["editors.tsx<br/>editor (client, default: SchemaForm)"]
    REN["PageRenderer<br/>rijen → cellen → widgets"]
    STU["Studio<br/>(pagina-editor)"]
    HTML["HTML"]

    JSON -->|"store valideert bij lezen"| REG
    RTS -->|registreert| REG
    REG --> REN
    CTS --> REN
    REN --> HTML
    CTS -->|previews| STU
    ETS -->|sidebar| STU
```

- De **renderer** zelf (`PageRenderer`, `Widget`, `DefaultView`,
  `layoutRows`, `Markdown`) staat sinds Fase 2 in `@imprint/runtime-admin` en
  kent geen concrete widgets. De site bindt hem in
  `src/components/page-renderer.tsx` en `src/components/default-view.tsx` aan
  haar eigen viewers; de rest van de site importeert die bindingen.
- Viewers krijgen een **`WidgetContext`** (`ctx`) mee: `store`,
  `writableStore` (null in file-modus) en de `readOptions` van het verzoek.
  De site bouwt die per verzoek in `src/lib/widget-context.ts`, waar ook de
  as-of-preview (`readOpts()`) wordt uitgelezen. Viewers importeren dus geen
  store-singleton en geen request-API meer; een `no-restricted-imports`-regel
  in `eslint.config.mjs` houdt dat zo. Precies dat maakt ze verplaatsbaar naar
  een package. De handgeschreven productpagina gebruikt dezelfde context voor
  de gedeelde productsecties.
- De **store** valideert elke widget-config tegen het geregistreerde schema:
  een kapotte widget breekt de build/save met een duidelijke fout, in plaats
  van stil verkeerd te renderen.
- Config moet **JSON-serialiseerbaar** zijn (opslag als JSON); coördinaten
  e.d. relatief opslaan (0..1) zodat ze meeschalen met de vakbreedte.
- Interactieve viewers (hover/klik) zijn een dun server-component met een
  `"use client"`-eiland erin; `treeview`/`api` hebben dat niet nodig, een
  geannoteerde-afbeelding-widget wel.
- **Catalogus van MusicBrain**, samengesteld in `src/widgets/registry.ts` en
  `src/widgets/components.tsx`, in de volgorde die de studio toont (vastgepind
  in `test/catalog.test.ts`):
  - *standaard*, uit `@imprint/widgets-standard`: `text`, `table`, `image`,
    `gallery`, `carousel`, `album`, `map`, `kanban`, `hero`, `video`,
    `accordion`, `divider`, `specs`, `posts`, `template`, `list`, `callout`,
    `embed`, `treeview`, `api`. Ze kennen alleen generieke contracten
    (pagina's, content-items).
  - *domein*, in de site: `planning`, `itinerary`, `downloads`, `board`,
    `boardspec`, `releases`, `products`, `subjectheader`, `spectable`,
    `components`. Ze kennen producten, componenten, releases, board-specs of
    planning, en worden in Fase 5 plugins.
- **Wat een site levert voor de standaardwidgets**: de design-tokens
  `background`, `surface`, `line`, `foreground`, `muted`, `accent`,
  `accent-strong` en `accent-2` als Tailwind-kleuren (`@theme`), de classes
  `eyebrow` en `markdown`, en per engine-package een `@source`-regel in
  `globals.css`. De bibliotheek levert geen merk; dat blijft van de site
  (besluit in §0).

## 3b. Product / component / release

Naast de website-content is er een productdomein: producten zijn opgebouwd
uit **componenten**, en worden in genummerde **releases** uitgebracht. Een
product-project (bijv. de MusicBrain-hardwarerepo) kan dit zelf **posten**
via de write-API; het landt in dezelfde bitemporal-store als alle content.

```mermaid
classDiagram
    class Product { slug, name, status, components[] }
    class Component { slug, name, children[], versions[] }
    class ComponentVersion { number, date, notes, spec? }
    class BoardSpec { slug, component, version, connectors[], assets, sections[] }
    class Release { project, version, date, product, components[] }
    class ReleaseComponent { component, version }
    class ComponentItinerary { start, end, versions[] }

    Product o-- Component : components[] (refs)
    Component o-- Component : children (nesting)
    Component *-- ComponentVersion : versions
    ComponentVersion ..> BoardSpec : spec (per versie)
    BoardSpec --> Component : component (ref)
    Product *-- Release : product
    Release *-- ReleaseComponent : components[]
    ReleaseComponent --> Component : component (ref)
    ComponentItinerary ..> Release : afgeleid
```

Modelleerkeuzes (naar het UML van Mark):

- **Component is een eigen contenttype**, niet genest in een product — omdat
  hetzelfde component in meerdere producten kan zitten. Componenten kunnen
  wél nesten (`children`), bijv. een busboard met modules.
- **Een release bevat componenten met genoteerde versie** (`components: [{
  component, version }]`) — de `ReleaseComponent`-associatie draagt het
  versienummer. Bewust géén directe relatie naar een `ComponentVersion`-
  entiteit: een versie ís geen component.
- **ProductComponentItinerary is afgeleid**, niet opgeslagen:
  [`computeItinerary()`](../packages/content-core/src/itinerary.ts) leest per
  component de eerste→laatste release af (`end: null` = zit nog in de nieuwste
  release).
- **Documentatie** hangt (voorlopig simpel) als optioneel `docs`-veld aan
  product/component: een pagina-slug of inline markdown. Differentiëren kan
  later.

**board-spec** (hardware-documentatie, D1–D10) is de eerste gedifferentieerde
documentatievorm: een eigen contenttype voor de machinaal gegenereerde
bord-info (connectors, nets, gerenderde SVG's/PNG's, proza-secties, fab-info,
hotspot-punten). Eén board-spec **per ComponentVersion** (slug
`<component>@<versie>`); de `ComponentVersion` verwijst er optioneel naar via
`spec`, en de board-spec verwijst terug naar zijn component (RelationRule
`board-spec.component → component`). De technische kern is taalneutraal, alleen
de `sections` zijn vertaalbaar (S9).

### 3d. Planning (kanban als content)

Een **planning** is een bord dat bij een product hoort en zijn **fasen**
(kolommen) declareert; de kaarten zijn een eigen contenttype **planning-item**
— want een kaart heeft een eigen eigenaar, een eigen rich-text-body en een
eigen levensloop. Een kaart verschuiven ís een `status`-wijziging, geen nieuwe
kaart, en dus **een nieuwe bitemporale versie**: de versiegeschiedenis van een
planning-item *is* het verhaal van hoe het werk door de fasen liep, en
`asOf`-preview toont het bord op elke datum. Relatieregels:
`planning → product`, `planning-item → planning`, `planning-item → component`.
De eigenaar is een gebruikersnaam (zachte verwijzing naar de users-tabel; geen
contenttype, dus geen RelationRule).

Bewerken gebeurt in de admin (`/admin/planning/<slug>`): een client-bord met
HTML5-drag&drop tussen kolommen en een edit-paneel per kaart; de mutatielogica
is puur ([`lib/planning.ts`](../sites/musicbrain/src/lib/planning.ts):
`computeMove` renummert de bron- en doelkolom), de serveracties doen de
bitemporale puts.

De **`planning`-widget** rendert een bord op de site, in twee modi: *board*
(een planning + zijn planning-items) of *generiek* — een read-only view over
elk contenttype met een aanwijsbaar fase-, eigenaar- en titelveld en de fasen
op de widget geconfigureerd. Zo toont hij bv. componenten gegroepeerd op hun
optionele `phase`-veld (dat een project via de API bijwerkt) zonder aparte
planning-items. Dit is Marks "widget = configureerbare view op data":
hoofditem + subitems + aanwijsbaar fase-veld + optionele eigenaar.

- **Assets** (renders, pinout-SVG's) gaan via de **AssetStore** (D7,
  `content-core/asset-store.ts`): `put(path,bytes) → url`, file-backend nu,
  MinIO/S3 later als config-wissel. Upload via multipart
  `POST /api/ingest/board-spec` (D5/D6): de backend slaat de bestanden op,
  herschrijft asset-namen in de doc naar URL's en doet `putItem`. Serveren via
  `GET /api/assets/...`.
- **Weergave** met lage auteurlast: `BoardSpecView` (D9) rendert een board-spec
  (interactief board of overzicht + connectors-tabel + pinouts + secties). De
  `boardspec`-widget zet dat op elke pagina met alleen een spec-slug. De
  `board`-widget-config is bovendien **afleidbaar** uit een board-spec
  (`boardSpecToBoardConfig`, D4): de punten komen uit `spec.points`, hun detail
  uit de per-connector pinout-SVG (`svgRef`, D10) — geen JSON-plak meer.
- **Navigatie (per-type pagina's, "optie B"):** elk contenttype heeft een
  eigen route — `/products/<slug>`, `/components/<slug>`, `/releases/<slug>` —
  die het item als *subject* rendert. De keten is klikbaar: productpagina →
  releases van dat product → release → zijn componenten → component → board
  (en terug: de componentpagina toont in welke producten/releases hij zit).
- **Studio-bewerkbare default-views:** een route gebruikt de layout van de
  pagina `_view/<type>` (in de studio samengesteld) met het item als subject;
  bestaat die niet, dan valt hij terug op de hand-gecodeerde weergave. In de
  studio kies je "preview als <voorbeeld-item>" zodat de widgets zich vullen
  terwijl je de template ontwerpt. `_view/*`-pagina's zijn niet publiek
  bereikbaar. Beheer via **/admin → Default views**.
- **`list`-widget** volgt de content-graaf voor die navigatie: modus `query`
  (items van een type waar `veld == waarde`, bijv. releases van dit product)
  of `refs` (een slug-array op de subject, bijv. `release.components[]`), met
  een `linkPattern` naar de doelpagina. De `template`- en `list`-widgets
  krijgen de subject van de pagina mee (PageRenderer geeft `subject` door),
  zodat dezelfde default-view zich vult voor elk item.

Omdat de `content_items`-tabel generiek is (§4), kostte dit **geen
DB-migratie**: `component` is gewoon een nieuwe waarde in de `type`-kolom,
met een eigen zod-schema.

### Relaties tussen contenttypen

Referenties tussen types (`release → product`, `product → components`,
`component → children`, …) zijn **zachte slug-verwijzingen** in de JSON,
maar hun integriteit is bewaakbaar. Een set **RelationRules** verklaart welk
veld van welk type naar welk ander type wijst; de store controleert dat bij
elke schrijfactie ([relations.ts](../packages/content-core/src/relations.ts),
`validateReferences`). De regels zijn zélf content (`type: "relations"`),
bewerkbaar in **/admin/relations** — dus configureerbaar, niet hardgecodeerd.

- Veldpaden: `product` (slug), `components[]` (array van slugs),
  `components[].component` (array van objecten met een slug-veld).
- Per regel een `enforce`-vlag: aan = een verwijzing naar niet-bestaande
  content weigert de write (422); uit = advies.
- Machine-ingest post daarom in volgorde: eerst componenten, dan het product,
  dan de releases (de bundle-POST doet dit al).

## 3c. Theming

Een **thema is content**: een set design-tokens (kleuren, fonts) als
`type: "theme"`-item, bewerkbaar in de admin met kleurpickers en bitemporeel
geversioneerd zoals alles. De aanpak volgt de standaardpraktijk:

- **Tokens als CSS custom properties** — componenten gebruiken uitsluitend
  token-klassen (`bg-background`, `text-accent`, …; afgedwongen door de
  werkafspraak "geen losse hexkleuren"). `globals.css` houdt de
  default-waarden op `:root` (tevens de no-JS-fallback); die default is het
  **Amber-thema** (het "open brain"-palet). Fonts gaan via een indirectie
  (`--sans`/`--mono` op `:root`, door `@theme inline` gemapt naar Tailwinds
  `--font-*`): zou `@theme inline` direct naar de next/font-variabelen
  wijzen, dan bakt Tailwind die ín de `font-mono`-utilities en raken
  thema-overrides ze niet meer.
- **`[data-theme="<naam>"]`-switching** — de site rendert per thema een
  CSS-blok dat de variabelen overschrijft (`ThemeStyles`). Omdat Tailwind v4
  de tokens via `@theme inline` aan de variabelen bindt, restylet één
  attribuutwissel de hele site, direct.
- **Gebruikers-switcher** (IDE-stijl) in de header: zet `data-theme` op
  `<html>` en bewaart de keuze in localStorage; een klein inline-script
  bovenin `<body>` past de keuze vóór de eerste paint toe (geen flash).
- **Formaat**: het zod-`ThemeSchema` is bewust plat (7 kleurtokens + een
  optioneel achtste, `accent2`, voor sierelementen zoals de scope-divider —
  leeg valt het serverside terug op `accent` — plus optionele font-stacks) —
  in de geest van het W3C **Design Tokens (DTCG)**-formaat (tokens als
  data), maar zonder de volle diepte daarvan. Import/export naar DTCG-JSON
  kan later een dunne mapping zijn.
- **Afgeleide textuur**: de achtergrond (dot-grid + accentgloed bovenin,
  uit het "open brain"-ontwerp) staat in `globals.css` en is met
  `color-mix()` afgeleid van de tokens `--muted`/`--accent`; hij kleurt dus
  automatisch mee met elk thema zonder eigen tokens nodig te hebben.
- **Afbakening**: tokens (kleur/typografie) zijn client-side wisselbaar; de
  **grove pagina-indeling** (logo-positie, header-variant) is een
  server-concern en hoort bij een aparte chrome-variant per site — bewust
  níet in het thema gestopt (staat op de backlog).

## 3d. Autorisatie: PEP en PDP in AuthZEN-vorm

Ontwerp en besluiten: [design/fase-3 §4](design/fase-3-admin-toegang-tijdreizen.md).
Het contract tussen poortje (PEP) en beslisser (PDP) is de OpenID **AuthZEN
Authorization API 1.0**: `{ subject, action, resource, context }` in,
`{ decision, context? }` uit, plus een batchvorm (`evaluations`). Imprint
standaardiseert op dat contract, niet op een policytaal; de beslisser is
daarmee verwisselbaar zonder dat een aanroep verandert. De shapes, de
beslisser in het proces en de twee poortjes staan in
[access.ts](../packages/content-core/src/access.ts):

- **`inProcessPdp`** — de vaste regelset (admin alles; editor schrijft;
  ingelogd leest alles; bezoeker leest alleen `access: "public"`), voor dev,
  test en CI. De instantie kiest de PDP (`ImprintConfig.pdp`); productie
  krijgt daar de HTTP-adapter naar de OpenFTV-sidecar (backlog).
- **`permit()`** — het poortje aan de voorkant, asynchroon. Twee
  invarianten: een publieke leesvraag bereikt de PDP nooit (geen
  afhankelijkheid, mag voorgerenderd), en een PDP die niet antwoordt is een
  "nee" voor beperkte content en voor schrijven. De site wikkelt het in
  `authorize(session, action, resource)`
  ([authorize.ts](../sites/musicbrain/src/lib/authorize.ts)); `canEdit()` en
  `editingSession()` in auth.ts zijn dunne wrappers, waar elke server action
  mee begint.
- **`guardReads()`** — het poortje aan de achterkant: de leeskant van een
  store zoals één subject hem mag zien. Beperkte items vallen uit elke lijst
  en zijn `null` bij elke get, tenzij de PDP ze toestaat (batchvraag);
  `listItems`/`getItem` van een writable store worden meegenomen, zodat ook
  widgets die rauwe items lezen (planning, list) niets lekken. Schrijven
  wordt niet gewikkeld. `imprint.store` is deze bewaakte kijk voor de
  bezoeker; `imprint.storeFor(subject)` voor een ingelogde; `imprint.readStore`
  de onbewaakte leeskant (alleen serverside, "wat bestaat er").

**Publiek en beperkt.** Elk inhoudstype (page, product, component,
board-spec, release, planning, planning-item, wiki, wiki-page) heeft
`access: "public" | "restricted"` (`Access` in schemas.ts, default public);
configuratietypen niet. Oude wiki's met `visibility: members` blijven
parseren: `WikiSchema` beeldt dat bij het lezen af op `restricted`, zodat de
historie leesbaar blijft zonder migratie. Beperkte content staat nooit in
voorgerenderde HTML: de statische catch-all leest via de bezoekersstore en
stuurt een bestaand-maar-beperkt slug door naar **`/members/<slug>`**, een
`force-dynamic`-route die per verzoek de sessie leest, de PDP vraagt en
anders 404 geeft (de URL bevestigt niet dat er iets is). Datzelfde geldt voor
een beperkte wiki en voor een beperkte pagina in een publieke wiki. De
`/api/content`-leeskant antwoordt met de kijk van de sessie (of van de
bezoeker) en is met een sessie niet cachebaar. Dit loste ook de 500 op de
members-wiki in productie op: die route las cookies in een statische render.

```mermaid
sequenceDiagram
    autonumber
    participant V as bezoeker
    participant S as statische route<br/>(site)/[...slug]
    participant M as /members/[...slug]<br/>(force-dynamic)
    participant PEP as permit() / guardReads()
    participant PDP as PDP<br/>inProcessPdp | sidecar

    V->>S: GET /help
    S->>PEP: store.getPage (bezoeker)
    Note over PEP: access = restricted → géén PDP-vraag, item weg
    S-->>V: 307 → /members/help
    V->>M: GET /members/help (cookie)
    M->>PEP: storeFor(subject).getPage
    PEP->>PDP: evaluate({subject, read, resource{access}})
    PDP-->>PEP: { decision }
    PEP-->>M: pagina of null
    M-->>V: 200, of 404
```

Nog niet: toegang per widget op een publieke pagina (besluit: eigen stap,
§4.3 van het ontwerp), een ledenweergave van beperkte producten, componenten
en releases (die verdwijnen nu uit de publieke site), en een inlogpagina
voor leden — een reader logt nu in via `/admin` en ziet daar het formulier
opnieuw, maar heeft wel een sessie.

## 4. Opslag: bitemporal-light (§B3)

Eén generieke tabel `content_items`; de payload per type blijft een
zod-gevalideerd JSON-document. Twee tijdassen:

| as | kolommen | betekenis | levert |
|---|---|---|---|
| valid time | `valid_from` / `valid_to` | wanneer de content *geldt* | geplande publicatie (S6), "site zoals op datum X" (S5) |
| transaction time | `tx_from` / `tx_to` | wanneer wij het *beweerd* hebben | versiegeschiedenis + rollback (S4) |

Elke save is een nieuwe rij; `tx_to IS NULL` markeert de huidige versie.

```mermaid
sequenceDiagram
    participant E as Editor (/admin)
    participant W as WritableContentStore
    participant DB as MariaDB

    E->>W: putItem("page", "about", data)
    W->>W: valideer data (zod + widget-registry)
    W->>DB: UPDATE ... SET tx_to = now()<br/>WHERE slug='about' AND tx_to IS NULL
    W->>DB: INSERT nieuwe rij (tx_from = now(), tx_to = NULL)
    Note over DB: oude versie blijft bestaan → History/restore
    E->>E: revalidatePath: site-cache leeg
```

Lezen voor de site is volledig bitemporeel op één moment: `tx_from ≤ asOf <
tx_to` (wat we op dat moment beweerden) én `valid_from ≤ asOf < valid_to`
(wat op dat moment gold). Zonder `asOf` is dat moment "nu", en is de
tx-clausule gelijkwaardig aan `tx_to IS NULL` — maar met een `asOf` in het
verleden komen de tóen actuele (inmiddels gesuperseerde of getombstonede)
rijen terug: echt tijdreizen. Terugrollen = een oude payload opnieuw
asserteren; de geschiedenis zelf wordt nooit herschreven. Let op het
verschil met de file-store: die kent alleen valid time (`publishedAt`,
releasedatum), dus een `asOf` vóór de eerste assertie geeft in de DB-store
níets en in de file-store gewoon de content van toen (§0 regel 6; getest
in §8).

**As-of-preview** (S6) maakt dat tijdreizen zichtbaar: het admin-dashboard
("Time travel") opent de publieke site met een gekozen moment. Technisch:
Next **draft mode** (de bypass-cookie laat de prerendered pagina's dynamisch
renderen voor déze browser) plus een `imprint_asof`-cookie met het moment;
[preview.ts](../sites/musicbrain/src/lib/preview.ts) vertaalt dat per request
naar `ReadOptions` en elke publieke pagina geeft die door aan de store.
In-/uitstappen via `/api/preview?asOf=…&to=…` (editors only) en
`/api/preview/exit`; een banner in de site-layout markeert de preview.
Wat meereist: inhoud, menu, thema's (ook de thema-CSS in de root-layout),
default views (`_view/<type>`) en de siteconfiguratie — `getSiteConfig(opts)`
valt vóór de eerste assertie terug op de huidige config, omdat zonder
siteconfig geen pagina rendert. `readOpts()` is `{}` voor bezoekers, dus de
root-layout blijft statisch.
Beperking: widgets die zelf content ophalen (posts, list, releases…) kijken
nog naar "nu" — de kernpagina's reizen mee. Dit model migreert later naadloos naar het echte
bitemporal-register (bitemporal2026) — de site merkt daar niets van, want
alles loopt via de `ContentStore`-interface.

```mermaid
classDiagram
    class ContentStore {
        <<interface>>
        getSiteConfig()
        listProducts(opts) / getProduct(slug)
        listReleases(opts)
        listPages(opts) / getPage(slug)
        getMenu(name)
    }
    class WritableContentStore {
        <<interface>>
        listItems(type)
        getItem(type, slug, lang)
        putItem(type, slug, data, opts)
        deleteItem(type, slug, lang)
        listVersions(type, slug, lang)
    }
    class FileContentStore { v0: bestanden in git }
    class DbContentStoreBase {
        <<abstract>>
        alle lees-/schrijfsemantiek
        selectValidAt() / selectCurrent() / …
        supersede()
    }
    class DbContentStore { MariaDB: drizzle/mysql2 }
    class PgContentStore { Postgres: drizzle/node-postgres }
    class MemoryContentStore { in geheugen: tests, demo }

    ContentStore <|-- WritableContentStore
    ContentStore <|.. FileContentStore
    WritableContentStore <|.. DbContentStoreBase
    DbContentStoreBase <|-- DbContentStore
    DbContentStoreBase <|-- PgContentStore
    DbContentStoreBase <|-- MemoryContentStore
```

### Twee databasedialecten, één semantiek

Sinds september 2026 zijn er twee databasebackends achter hetzelfde contract
(§0 regel 3): **MariaDB** (MusicBrain, ongewijzigd) en **Postgres** (de
Imprint-productsite). De opzet is bewust *geen* kopie van de store:

- [db-store-base.ts](../packages/content-core/src/db-store-base.ts) bevat
  álles wat een site kan waarnemen — taal-overlay, drafts, `asOf` op beide
  tijdassen, validatie, referentiecontrole, supersede-in-plaats-van-overschrijven
  — en declareert zes abstracte rij-operaties (`selectValidAt`,
  `selectCurrent`, `selectCurrentOne`, `selectVersions`, `supersede`).
- [db-store.ts](../packages/content-core/src/db-store.ts) (`DbContentStore`)
  en [db-store.pg.ts](../packages/content-core/src/db-store.pg.ts)
  (`PgContentStore`) implementeren alleen die zes in hun dialect; elk ~100
  regels drizzle. De MariaDB-variant houdt de "JSON is LONGTEXT"-thaw, de
  Postgres-variant krijgt `jsonb` al geparsed terug.
- Het schema is per dialect een eigen bestand met **dezelfde kolomnamen**
  ([db-schema.ts](../packages/content-core/src/db-schema.ts) `mysqlTable`,
  [db-schema.pg.ts](../packages/content-core/src/db-schema.pg.ts) `pgTable`:
  `bigserial`, `jsonb`, `timestamptz(3)`), met een eigen migratiejournal
  (`drizzle/` resp. `drizzle-pg/`, `drizzle.config.ts` resp.
  `drizzle.config.pg.ts`; `npm run db:generate:pg` / `db:migrate:pg`).
- [db.ts](../packages/content-core/src/db.ts) (`openContentDatabase(url)`)
  kiest de backend op het URL-schema (`mysql://` → MariaDB, `postgres://` →
  Postgres). Dat is de enige plek in de kern die weet dat er twee dialecten
  zijn; de composition root van een site en de seed roepen alleen dít aan.
- Beide draaien **dezelfde contract- en schrijfsuite** (§8) — dat is het
  bewijs dat ze gelijk zijn, niet de code-review.
- Een derde implementatie op dezelfde basis, `MemoryContentStore`
  ([memory-store.ts](../packages/content-core/src/memory-store.ts)), houdt de
  rijen in een array. Hij haalt dezelfde lees- en schrijfsuites en is daarmee
  een bewezen stand-in voor een database: de renderer-karakterisatie (§8)
  draait erop. Niet persistent, nooit een productiebackend.

Gebruikers werken op beide databases (`DbUserStore`, `PgUserStore`), en
daarmee ook `npm run user` en de seed. Wat nog MariaDB-only is:
`npm run backup` en `npm run assets:gc`; dat staat in de backlog. Waarom Postgres
wenselijk is voor de bitemporele route: `jsonb` i.p.v. tekst, en
`tstzrange` + exclusion constraints maken de stap van bitemporal-light naar
echt bitemporeel klein.

Alle reads nemen `ReadOptions` mee: `asOf` (tijdreizen), `lang`
(taal-fallback naar EN, S9) en `includeDrafts` (previews).

Dezelfde store is ook als **JSON-API** ontsloten (`/api/content/...`, zie de
README): één catch-all route handler die de `ContentStore` aanroept, met
dezelfde query-parameters. API, site en admin kunnen daardoor per definitie
niet van elkaar afwijken.

- **GET** is read-only en publiek (alleen gepubliceerde content; `?drafts=1`
  met admin-sessie). Endpoints o.a. `products`, `components`, `board-specs`
  (`?component=`), `releases` (`?product=`), en de afgeleide
  `itinerary/<product>`.
- **POST** is de schrijfkant voor product-projecten: `Authorization: Bearer
  <INGEST_TOKEN>` (constant-time check; leeg token = schrijven uit). Eén item
  via `POST /api/content/<type>/<slug>`, een bundle via `POST /api/content`
  met `{ product?, components?, releases? }`, of assets+doc via multipart
  `POST /api/ingest/board-spec`. Elke put loopt door de zod-validatie + de
  referentiecheck en wordt een nieuwe bitemporale versie — dus ook machine-
  posts hebben volledige historie en rollback. Schrijven revalideert de
  site-cache. Een handleiding voor de consument staat in
  [mmb-ingest-guide.md](mmb-ingest-guide.md).
- **Webhook**: `POST /api/webhooks/github` (W2/S7) maakt van GitHub-releases
  release-items — HMAC-signed (`GITHUB_WEBHOOK_SECRET`), mapping
  repo→project/product in de site-config (`releaseSources`), onbekende repos
  genegeerd.
- **Metamodel**: `GET /api/meta` publiceert het contentmodel als JSON Schema
  (2020-12) per type — gegenereerd uit dezelfde zod-schema's, dus per
  definitie synchroon — plus de actieve relatieregels als referentietypen.
  Bedoeld voor externe form-builders (het bitemporal/Omnium-formulierspoor);
  een V3-vertaling kan er later naast onder `?format=v3`.
- **Feed**: `GET /feed.xml` — RSS 2.0 van de devlog (`posts/`-pagina's).

## 5. Admin (/admin)

- **Auth:** scrypt-wachtwoordhashes in de `users`-tabel, HMAC-signed
  session-cookie ([auth.ts](../sites/musicbrain/src/lib/auth.ts)). Rollen:
  `admin`/`editor` mogen schrijven, `reader` niet; elke server action begint
  met `editingSession()` (§3d).
- **Formulieren uit schema's:** `contentFormSchema`
  ([forms.ts](../packages/runtime-admin/src/forms.ts)) zet het zod-schema om
  naar JSON Schema; `SchemaForm` rendert scalars als echte controls en
  complexe/recursieve velden als gevalideerde JSON-boxen. Een nieuw veld
  hoort dus in het schema, niet als los formulierveld.
- **Generieke clientcomponenten in het package** (Fase 3 stap 4):
  [runtime-admin/src/admin/](../packages/runtime-admin/src/admin/) — dialoog,
  `SchemaForm`, `MarkdownEditor`, `LoginForm`, `MenuEditor`, `ThemeEditor`,
  gebruikersbeheer, `RelationsEditor`, `ItemEditor`. Ze importeren geen
  site-module en geen server action: de action komt als prop (`action`,
  `actions`), getypeerd als `FormAction` (`useActionState`-vorm). Studio,
  planning en wiki blijven in de site (Fase 4 en 5).
- **Schermen en actions in het package** (Fase 3 stap 5, eerste helft):
  [runtime-admin/src/admin-server/](../packages/runtime-admin/src/admin-server/)
  bevat de servercomponenten `AdminGate` (geen database / login / shell),
  `DashboardScreen`, `ListScreen`, `ItemEditScreen` en `HistoryScreen`, en
  de action-implementaties (`signIn`, `signOut`, `saveItem`, `deleteItem`,
  `restoreVersion`). Alles neemt de `AdminContext` als eerste argument. De
  site houdt dunne routebestanden (`app/admin/**/page.tsx` rendert een
  scherm met `admin` en `adminActions`) en een `"use server"`-module met
  één-regel-wrappers (`loginAction = (prev, fd) => signIn(admin, prev, fd)`).
  Waarom niet gesloten over de context: een `"use server"`-bestand mag alleen
  kale async functies exporteren, dus Next registreert alleen top-level
  functies als action; en een proces-singleton zou onzichtbaar zijn. Aparte
  entry `/admin-server` naast `/admin` (client), zodat een clientbundel nooit
  `next/cache` meetrekt. Het menu komt uit `adminMenu(admin)`: de
  catalogus zegt per type waar zijn lijst hoort (`CONTENT_TYPES[type].menu`:
  groep en kopje), de site voegt haar eigen schermen toe via
  `contributions`; `AdminShell` (client) tekent wat hij krijgt. Tweede
  helft: `UsersScreen` (+ `users.ts`: aanmaken, reset, rol, verwijderen,
  eigen wachtwoord), `RelationsScreen` (+ `saveRelations`), `ViewsScreen`
  (typen met de catalogusvlag `viewable`) en `ModelScreen`. Nog in de site:
  studio (Fase 4), planning en wiki (Fase 5).
- **Sessie en preview in het package** (stap 6/7):
  [session.ts](../packages/runtime-admin/src/admin-server/session.ts) —
  `createSessionAuth(imprint)` geeft de `AdminAuth` (HMAC-cookie, naam, uren
  en secret uit de instantie, `canEdit` via de PDP); de site zet hem in zijn
  context en exporteert wat zijn eigen routes nodig hebben.
  [preview.ts](../packages/runtime-admin/src/preview.ts) — `readOpts()`,
  `getPreview()`; `previewEnter`/`previewExit` in admin-server voor de twee
  routebestanden. **Een tweede site krijgt de admin met** `lib/admin.ts`
  (context), `lib/admin-actions.ts`, `app/admin/actions.ts` en
  `users/actions.ts` (wrappers), zes routebestanden en twee preview-routes —
  zie `sites/imprint`, dat precies zo is aangesloten (Postgres).
- **Plugins** (ontwerp Fase 5): een sitebrede capability, aangezet met
  `plugins: [planningPlugin()]` in `imprint.config.ts`. De React-vrije helft
  (`ImprintPluginCore` in extension-api: contenttypedefinities,
  widgetschema's, relatieregels, menu-items) voegt `createImprint` samen —
  de typen in het register, de menu-items in het admin-menu. De React-helft
  (`ImprintPlugin` in runtime-admin: `screen`, `actions`) leest de admin uit
  dezelfde objecten (`AdminContext.plugins`). Drie vaste haken per site:
  `app/admin/[type]/page.tsx` en `[type]/[...path]/page.tsx` renderen
  `PluginScreen` als het segment geen contenttype is (URL's blijven
  `/admin/planning/<slug>`); één `pluginAction(plugin, action, ...args)` in
  `actions.ts` roept `runPluginAction`; de publieke catch-all en `/members`
  vragen eerst de plugins (`pluginPublicRoute`: in de statische route een
  redirect voor beperkte inhoud, onder /members een PDP-besluit voor de
  sessie). `AdminTypeScreen` laat een plugin die het segment claimt winnen
  van de generieke lijst. Clientonderdelen van een plugin krijgen de
  dispatcher als `call`-prop. Plugins: [plugin-planning](../packages/plugin-planning/src/index.ts)
  (twee typen met regels, bordadmin, acties, widget, pure bordlogica met
  tests; de site componeert de widget in zijn catalogus en viewers) en
  [plugin-wiki](../packages/plugin-wiki/src/index.ts) (drie typen, boomstudio,
  acties incl. publiceren, publieke route, `WikiView`). Node-scripts
  gebruiken de React-vrije entries (`/content-types`, `/schemas`).
- **AdminContext** ([admin-context.ts](../packages/runtime-admin/src/admin-context.ts)):
  wat de gedeelde admin van de site krijgt, in één object — de instantie
  (stores, users, PDP, catalogus, assets, sessie-instellingen, secrets), de
  sessie (`auth.getSession`/`editingSession`, door de site geleverd omdat die
  het request leest), de formulieren per contenttype en per widget
  (`forms.content`, `forms.widgets`) en de admin-bijdragen van site en
  plugins (`contributions`, nog leeg). De site bouwt hem in
  [lib/admin.ts](../sites/musicbrain/src/lib/admin.ts); de itemeditor en de
  studio lezen hun formulieren er nu uit. Stap 5 verhuist de routes en
  actions en geeft ze alleen nog dit object.
- **Studio in het package** (Fase 4): `PageStudioScreen`
  ([studio-screen.tsx](../packages/runtime-admin/src/admin-server/studio-screen.tsx))
  met de actions in `studio-actions.ts` en de draftopslag in `drafts.ts`
  (sleutel per instantie, gebruiker en pagina); de clientonderdelen in
  [admin/studio-parts.tsx](../packages/runtime-admin/src/admin/studio-parts.tsx),
  de pure layoutoperaties in `@imprint/runtime-admin/studio`. Wat een site
  levert (`AdminContext.studio`): `viewers` (zijn widgetcomponenten),
  `chrome` (één component om het canvas — MusicBrain zijn `SiteChrome` in de
  inert-stand, de Imprint-site header en footer; besluit in het
  revisievoorstel, Fase 4) en optioneel `editor` (zijn widget-editorkeuze,
  default de schemaform). Het package bouwt de `WidgetContext` voor het
  canvas zelf, als de ingelogde redacteur: `storeFor(subject)`,
  `guardReads(writableStore)` en de leesopties van de preview plus drafts.
  De studio-actions komen als props binnen (`AdminActions.studio`), net als
  de andere actions. De rijke editors van de standaardwidgets (table,
  gallery/carousel, map) staan in
  [widgets-standard/src/editors.tsx](../packages/widgets-standard/src/editors.tsx)
  (`standardEditors`); een site spreidt ze in zijn eigen editor-map
  (MusicBrain: plus board en kanban) en geeft die als `WidgetEditorFor` mee.
- **Studio (pagina-editor):** WYSIWYG-achtig, Pleio/Gutenberg-stijl. Het
  canvas ís de pagina: de echte widget-viewers, met echte data, binnen de
  echte site-omlijsting (`SiteChrome`, gedeeld met de publieke layout).
  Klik op een widget → links een sidebar met zíjn editor; een wijziging
  gaat (gedebounced) naar een **serverside draft** en het canvas rendert
  opnieuw — direct effect, zonder dat er iets is gepubliceerd. "+"-balken
  voegen rijen toe, "+"-stroken vakken links/rechts; pas "Save" assereert
  de draft als nieuwe versie in de store.
- **Menu-editor:** genest lijstje; een item wijst naar een pagina (dropdown
  met echte pagina's), een URL, of niets (groepslabel).
- **History:** alle versies per item, met restore.

```mermaid
sequenceDiagram
    participant S as Sidebar (client)
    participant A as draftOpAction
    participant D as Draft (server, per gebruiker+pagina)
    participant C as Canvas (server components)

    S->>A: op (bijv. widget-config, rij toevoegen)
    A->>D: applyOp(draft, op)
    S->>C: router.refresh()
    C->>D: lees draft
    C-->>S: canvas opnieuw gerenderd (echte viewers)
    Note over S,C: pas "Save" → putItem(draft) = nieuwe versie
```

## 6. Omgevingen & deploy

```mermaid
flowchart LR
    subgraph dev["Lokaal (dev)"]
        NX["next dev :3000 (musicbrain)"] --> MDBL[("MariaDB 10.11<br/>docker compose, :3306")]
        NXI["next dev :3100 (imprint)"] --> PGL[("Postgres 17<br/>docker compose, :5434")]
    end
    subgraph vps["VPS (prod) — Caddy ervoor"]
        CMB["container musicbrain<br/>127.0.0.1:3000"] --> PGP[("Postgres 17<br/>database per site")]
        CIM["container imprint<br/>127.0.0.1:3100"] --> PGP
    end
    GH["GitHub (git)"]
    dev -- "push<br/>code + drizzle-migraties" --> GH
    GH -- "deploy.sh: pull → db:migrate:pg<br/>→ docker build → up" --> vps
```

- **Productie** is de VPS: git levert de bron, per site één container-image
  (standalone Next-server), één Postgres met een database per imprint, uploads
  op een volume, Caddy voor TLS. De compositie van een imprint is buildtime
  (widgets, CSS), dus een deploy is een nieuwe image; content zit in de
  database. De build leest die database (SSG) en draait daarom op de VPS.
  Runbook en afwegingen: [deploy-vps.md](deploy-vps.md). Tot september 2026
  was productie Plesk (Passenger → `server.js`, MariaDB); die host heeft
  Node.js uitgezet.

- **Code en schema** reizen via git: `db:generate` maakt van een wijziging
  in [db-schema.ts](../packages/content-core/src/db-schema.ts) een
  SQL-migratie in `drizzle/`; elke omgeving haalt zichzelf bij met
  `db:migrate`. Voor Postgres: `db-schema.pg.ts` → `db:generate:pg` →
  `drizzle-pg/` → `db:migrate:pg`. Een schemawijziging hoort dus in **beide**
  schemabestanden (zelfde kolomnamen), met een migratie per journal.
- **Lokale databases**: `npm run db:up` start MariaDB (poort 3306) én
  Postgres (poort **5434**, omdat 5432 en 5433 lokaal vaak al bezet zijn door Omnium); de
  Postgres-container maakt bij de eerste start ook `imprint_test` aan
  (`docker/pg-init.sql`).
- **Content** wordt níet gesynct: de productie-database is de bron van
  waarheid; `db:seed` importeert de bestanden éénmalig (idempotent — draait
  hij nogmaals, dan wordt dat een nieuwe versie in de historie).
- Publieke pagina's zijn prerendered (SSG); admin-saves legen de cache en
  nieuwe pagina's renderen on demand — geen rebuild nodig.
- **CI**: GitHub Actions ([ci.yml](../.github/workflows/ci.yml)) draait
  typecheck + lint + build bij elke push/PR. De build draait zonder
  `DATABASE_URL` en valt dus terug op de file-store — precies de
  v0-belofte "een checkout bouwt zonder database".
- **Backups**: `npm run backup` (Node-only; hele bitemporale historie +
  users + assets, retentie) — zie [backups.md](backups.md); asset-wezen
  opruimen met `npm run assets:gc` (houdt alles wat óóit gerefereerd is).

## 7. Nieuwe site ("imprint") toevoegen

De repository bevat naast MusicBrain een tweede site onder `sites/imprint`:
de publieke productsite van Imprint zelf. Ze draait op een eigen
**Postgres**-database (`DATABASE_URL`, §4), zonder URL op de eigen
`content/`-map, en deelt met MusicBrain alleen de engine-packages. De vaste
routes (`/`, `/mogelijkheden`, `/praktijk`, `/merk`) zijn code; alle andere
pagina's komen uit de contentstore en lopen door dezelfde engine-renderer als
MusicBrain, met een eigen selectie van acht standaardwidgets. Dat was het
exitcriterium van Fase 2. Een admin heeft de site nog niet (Fase 3).

```mermaid
flowchart LR
    subgraph shared["engine + bibliotheek"]
        REN["@imprint/runtime-admin<br/>PageRenderer"]
        STD["@imprint/widgets-standard"]
    end
    subgraph mb["sites/musicbrain"]
        MBC["catalogus<br/>20 standaard + 10 domein"]
        MBDB[("MariaDB")]
    end
    subgraph imp["sites/imprint"]
        IMC["catalogus<br/>8 standaard"]
        IMDB[("Postgres")]
    end
    MBC -. kiest .-> STD
    IMC -. kiest .-> STD
    MBC --> REN
    IMC --> REN
    MBDB -- ContentStore --> REN
    IMDB -- ContentStore --> REN
```

Stappen voor een nieuwe site:

1. `sites/<naam>/` scaffolden (Next.js) met `@imprint/content-core`,
   `@imprint/extension-api`, `@imprint/runtime-admin` en
   `@imprint/widgets-standard` als dependencies en in `transpilePackages`.
2. Catalogus samenstellen: `src/widgets/registry.ts` kiest schema's uit
   `standardWidgets` (plus eventuele eigen widgets), `src/widgets/components.tsx`
   de bijbehorende viewers uit `standardViewers`.
3. `imprint.config.ts` schrijven (`defineImprint`: id, `store.databaseUrl` +
   `contentDir`, `widgets: widgetRegistry`, sessiecookie, assets) en in
   `src/lib/content.ts` met `createImprint()` tot instantie maken. MariaDB of
   Postgres: het URL-schema beslist.
4. `src/lib/widget-context.ts` voor de `WidgetContext`, en een route die
   `PageRenderer` met de eigen viewers en die context aanroept; zie
   `sites/imprint/src/app/[...slug]/page.tsx`.
5. Huisstijl in `globals.css`: het tokencontract van de standaardwidgets (§3)
   vullen met het eigen palet, de classes `eyebrow` en `markdown`, en een
   `@source` per engine-package. Eigen globale elementregels horen in
   `@layer base`: buiten een laag overschrijven ze élke Tailwind-utility, dus
   ook die van de widgets.

De kern verandert daarbij niet — dat is de kern van het ontwerp.

## 8. Tests: contractsuite en karakterisatie

`npm test` draait in elke workspace diens eigen `test`-script (`npm run test
--workspaces`), met Node's ingebouwde testrunner (`node --test` via `tsx`,
geen extra framework); CI doet hetzelfde. Per workspace, omdat `tsx` de
tsconfig van de map pakt waarin hij draait: de site-tests hebben de
`@/`-paden van de site nodig, en straks hebben engine-packages hun eigen
tsconfig. De tests zijn
**karakterisatietests** (Fase 0): ze leggen het huidige gedrag vast, zodat de
extractie in Fase 1–4 aantoonbaar niets verandert. Ze schrijven géén
verwachtingen voor die de code nu niet waarmaakt.

| suite | bestand | bewaakt |
|---|---|---|
| **ContentStore-contract** | `packages/content-core/test/store-contract.ts` | de leessemantiek die élke backend moet delen: taal-overlay op EN, drafts/toekomst verborgen, `asOf` in de toekomst, prefix, sortering, schema-defaults, widget-validatie bij lezen. Eén fixture-set (`fixtures.ts`), door elke backend zelf gematerialiseerd |
| file-store | `test/file-store.test.ts` | contract + file-eigen: `asOf` = alleen valid time, lege mappen, kapot bestand breekt de build |
| **WritableContentStore-contract** | `test/writable-contract.ts` | de schrijfkant die elke databasebackend deelt: nieuwe versie supersedeert, historie nieuwste eerst, tijdreizen op beide assen, tombstone, `listItems` negeert valid time en sorteert op slug/lang, zod- en referentieweigering, onbekende widget geweigerd bij opslaan |
| db-store (MariaDB) | `test/db-store.test.ts` | lees- + schrijfcontract tegen `TEST_DATABASE_URL`, tabellen uit `drizzle/` |
| db-store (Postgres) | `test/db-store.pg.test.ts` | exact dezelfde suites tegen `TEST_PG_DATABASE_URL`, tabellen uit `drizzle-pg/` |
| memory-store | `test/memory-store.test.ts` | exact dezelfde suites tegen de geheugen-backend; draait altijd, geen database nodig |
| **UserStore-contract** | `test/user-store-contract.ts` | aanmaken, lijst zonder hash, dubbele/ongeldige namen en zwakke wachtwoorden geweigerd, inloggen, eigen wachtwoord wijzigen, laatste-admin-bewaking, verwijderen; draait binnen de MariaDB- en de Postgres-suite |
| contenttypecatalogus | `test/content-types.test.ts` | default alle typen, versmallen per site, onbekend type geweigerd; legt de lijsten vast die de admin vroeger met de hand bijhield |
| toegang | `test/access.test.ts` | de vaste regelset per rol, batch in volgorde; `permit()`: publiek vraagt nooit, een kapotte PDP is nee; `guardReads()` op de geheugenstore: bezoeker ziet niets beperkts (typed reads én `listItems`/`getItem`), reader alles, schrijven en historie ongemoeid; legacy `visibility` → `access` |
| **browsertests admin** | `sites/musicbrain/e2e/*.spec.ts` (Playwright, `npm run test:e2e`) | inloggen en uitloggen per rol, lijsten en dashboard, 404 op typen buiten de catalogus, opslaan met revalidatie van de publieke pagina, validatie, historie en herstel, aanmaken en verwijderen, gebruikersbeheer, studio-rooktest; beperkte pagina: bezoeker → /members → 404 en niet in de API, reader ziet hem, editor ziet hem in de admin, weer publiek → terug op de eigen URL; elke test faalt op een console-error. `e2e/serve.ts` maakt `imprint_e2e` leeg, migreert, seedt via de store en start `next build` + `next start` op :3200; `test:e2e:dev` doet hetzelfde tegen `next dev` in `.next-e2e`, omdat React hydration- en propfouten alleen in development meldt |
| backendkeuze | `test/db.test.ts` | `dialectOf()`: URL-schema → dialect |
| composition root | `packages/extension-api/test/imprint.test.ts` | `defineImprint` weigert ongeldige config; `resolveImprint` levert file-/MariaDB-/Postgres-instantie met juiste write-side, users, sessie- en asset-defaults; `createImprint` is één instantie per id |
| widget-model | `test/widgets.test.ts` | `WidgetTypeRegistry` (dubbel, onbekend, ongeldig, defaults), layoutschema's |
| relaties, itinerary | `test/relations.test.ts`, `test/itinerary.test.ts` | `extractRefs`/`validateReferences`, afgeleide reis |
| renderer-normalisatie | `packages/runtime-admin/test/layout.test.ts` | `layoutRows()`: legacy template+regio's → rijen, presets |
| studio-ops | `sites/musicbrain/test/layout-ops.test.ts` | `applyOp()`: alle draft-mutaties, geen widgetverlies, limieten |
| catalogus | `sites/musicbrain/test/catalog.test.ts` | de exacte widgetset van MusicBrain, en dat alle `content/`-pagina's ertegen valideren |
| **renderer (golden HTML)** | `sites/musicbrain/test/render/` | de HTML van `PageRenderer`, alle viewers, `DefaultView` en `SiteChrome`; zie hieronder |
| **CSS-dekking** | `sites/musicbrain/test/render/css-coverage.test.ts` | dat elke class in de golden HTML CSS krijgt uit de eigen bronnen van de site; zie hieronder |

De databasesuites draaien alleen met `TEST_DATABASE_URL` (MariaDB) en/of
`TEST_PG_DATABASE_URL` (Postgres): wegwerpdatabases waarvan de naam op
`_test` eindigt; de suites droppen en hermaken de tabellen met de échte
drizzle-migraties van het dialect. Lokaal: de Postgres-container maakt
`imprint_test` zelf aan; voor MariaDB eenmalig

```bash
docker compose exec -T db mariadb -uroot -pimprint-root -e \
  "CREATE DATABASE IF NOT EXISTS imprint_test; GRANT ALL ON imprint_test.* TO 'imprint'@'%';"
npm run test:db
```

Zonder die variabelen worden de suites overgeslagen, zodat `npm test` op een
kale checkout en in CI groen is. Een derde databasebackend (het bitemporele
register) is straks: één klasse op `DbContentStoreBase` plus één testbestand
van twintig regels dat dezelfde twee suites aanroept.

### Renderer-karakterisatie (Fase 2, stap 1)

Voordat de renderer naar de engine verhuist, ligt vast wat hij nu oplevert.
De suite rendert de échte server components naar HTML in gewone Node, met
React's eigen prerenderer (die async server components aankan), en vergelijkt
met *golden files* in `sites/musicbrain/test/render/__golden__/`: per
widgettype één bestand met al zijn gevallen, plus pagina's, default views en
de chrome.

```mermaid
flowchart LR
    FIX["fixtures.ts<br/>content + gevallen per widget"] --> MEM[("MemoryContentStore<br/>lees- én schrijfkant")]
    MEM --> CTX["WidgetContext<br/>lege leesopties"]
    F["fetch<br/>vaste antwoorden"]
    CTX --> VIEW["engine-renderer en DefaultView,<br/>MusicBrain-viewers, SiteChrome"]
    F --> VIEW
    VIEW --> HTML["HTML"] --> CMP{"gelijk aan<br/>golden?"}
```

- **Geen modules vervangen**: de test geeft de viewers een `WidgetContext`
  met de geheugen-backend en lege leesopties, precies wat een bezoeker buiten
  de as-of-preview krijgt. Alleen `fetch` (album- en api-widget) krijgt vaste
  antwoorden. Tot stap 3 importeerden viewers zelf `@/lib/content` en
  `next/headers`, en moest de test die via de experimentele `mock.module`
  vervangen; die afhankelijkheid en de vlag zijn weg.
- **Productieconfiguratie, niet de hint-paden**: de store heeft een
  schrijfkant, dus `planning`, `list` en `template` renderen echte data zoals
  op de databasesite, in plaats van "needs the database".
- **Dekking wordt afgedwongen**: een test faalt als een geregistreerd
  widgettype geen gevallen heeft, en een andere als een widget een URL
  ophaalt die geen vast antwoord heeft.
- **Deterministisch**: vaste antwoorden in plaats van netwerk, datums in 2025
  of 2026 en 2099 zodat "nu" er altijd tussen valt, en het footerjaar wordt
  geneutraliseerd.
- **Bewust gewijzigde weergave?** Draai
  `UPDATE_GOLDEN=1 npm test --workspace=musicbrain` en review de diff van de
  golden files zoals elke andere codewijziging.
- **Engine-packages in de test**: `tsx` past de JSX-instellingen van een
  tsconfig alleen toe op bestanden binnen diens map. Daarom draaien de
  site-tests met `sites/musicbrain/tsconfig.test.json`, die de
  site-instellingen uitbreidt naar `packages/*/src`. Next en `tsc` gebruiken
  gewoon `tsconfig.json`.
- **CSS-dekking**: de golden HTML ziet niet of een class ook CSS krijgt, en
  een build faalt er ook niet op. Staan componenten in een engine-package,
  dan moet Tailwind dat package scannen via een `@source`-regel in
  `globals.css`, anders verdwijnen hun classes stil. De testmap staat juist
  buiten de scan: de golden HTML bevat dezelfde classes en zou een vergeten
  `@source` maskeren. `css-coverage.test.ts` bouwt de CSS twee keer, zoals
  ingesteld en mét de golden HTML gescand (testcode blijft buiten, anders
  tellen class-achtige strings in tests mee), en eist dat die gelijk zijn.
  In Fase 2 stap 4 ving hij in het echt een ontbrekende `@source` voor
  `widgets-standard`.
  Elke bouw draait in een eigen Node-proces: de Tailwind-plugin cachet per
  invoerbestand, waardoor een tweede bouw in hetzelfde proces stil het
  eerste resultaat teruggeeft. Een gevoeligheidstest met een verzonnen class
  bewaakt dat de vergelijking echt iets kan vangen.

Gevonden bij het vastleggen, niet gerepareerd (karakterisatie verandert geen
gedrag): de releases-sectie in productmodus, dus ook op de productpagina,
toont releases met een datum in de toekomst, terwijl `/releases` die
verbergt. Staat in de backlog.

**Nog niet gekarakteriseerd** (bewust; staat in de backlog): de admin-flows
(login, save, restore, studio-save) en de API-routes. Die worden nu alleen
end-to-end bewaakt door `npm run smoke` en `npm run testcase:bitemporal`
tegen een draaiende site.

# Imprint — architectuur

Eén publicatie-motor, meerdere merk-sites ("imprints"). Dit document beschrijft
het ontwerp zoals het er staat; de requirements staan in
[website-requirements.md](website-requirements.md) (eisnummers W*/S*/§B/§C
worden in code-comments aangehaald).

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

    subgraph site["sites/musicbrain (Next.js 16)"]
        PUB["(site)/ publieke pagina's"]
        ADM["admin/ editor-UI"]
        CAT["src/widgets/<br/>registry.ts + components.tsx"]
        REN["page-renderer.tsx"]
    end

    FILES[("content/ bestanden<br/>(v0 + seed-bron)")]
    DB[("MariaDB<br/>content_items + users")]

    PUB --> ST
    ADM --> ST
    REN --> CAT
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

## 3. Widgets: kern kent het model, de site de catalogus

Een widgettype bestaat uit drie stukken; alleen het eerste is verplicht
handwerk, de editor heeft een schema-gedreven default:

| stuk | bestand | draait | rol |
|---|---|---|---|
| **configschema** | `src/widgets/registry.ts` | overal (geen React/store) | valideert de config; bron voor het default-editorformulier |
| **viewer** | `src/widgets/components.tsx` | server | rendert de widget op de site (mag store/API's gebruiken) |
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

- De **store** valideert elke widget-config tegen het geregistreerde schema:
  een kapotte widget breekt de build/save met een duidelijke fout, in plaats
  van stil verkeerd te renderen.
- Config moet **JSON-serialiseerbaar** zijn (opslag als JSON); coördinaten
  e.d. relatief opslaan (0..1) zodat ze meeschalen met de vakbreedte.
- Interactieve viewers (hover/klik) zijn een dun server-component met een
  `"use client"`-eiland erin; `treeview`/`api` hebben dat niet nodig, een
  geannoteerde-afbeelding-widget wel.
- Catalogus van musicbrain: `text`, `table` (met custom grid-editor),
  `image`, `callout`/CTA, `embed` (iframe), `treeview`, `api` (JSON-endpoint
  met veldselectie), `releases`, `products`.

## 3b. Product / component / release

Naast de website-content is er een productdomein: producten zijn opgebouwd
uit **componenten**, en worden in genummerde **releases** uitgebracht. Een
product-project (bijv. de MusicBrain-hardwarerepo) kan dit zelf **posten**
via de write-API; het landt in dezelfde bitemporal-store als alle content.

```mermaid
classDiagram
    class Product { slug, name, status, components[] }
    class Component { slug, name, children[], versions[] }
    class ComponentVersion { number, date, notes }
    class Release { project, version, date, product, components[] }
    class ReleaseComponent { component, version }
    class ComponentItinerary { start, end, versions[] }

    Product o-- Component : components[] (refs)
    Component o-- Component : children (nesting)
    Component *-- ComponentVersion : versions
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

Omdat de `content_items`-tabel generiek is (§4), kostte dit **geen
DB-migratie**: `component` is gewoon een nieuwe waarde in de `type`-kolom,
met een eigen zod-schema.

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

Lezen voor de site is altijd: `tx_to IS NULL` (huidige bewering) én
`valid_from ≤ asOf < valid_to` (geldig op dat moment). Terugrollen =
een oude payload opnieuw asserteren; de geschiedenis zelf wordt nooit
herschreven. Dit model migreert later naadloos naar het echte
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
    class DbContentStore { v1: MariaDB, bitemporal-light }

    ContentStore <|-- WritableContentStore
    ContentStore <|.. FileContentStore
    WritableContentStore <|.. DbContentStore
```

Alle reads nemen `ReadOptions` mee: `asOf` (tijdreizen), `lang`
(taal-fallback naar EN, S9) en `includeDrafts` (previews).

Dezelfde store is ook als **JSON-API** ontsloten (`/api/content/...`, zie de
README): één catch-all route handler die de `ContentStore` aanroept, met
dezelfde query-parameters. API, site en admin kunnen daardoor per definitie
niet van elkaar afwijken.

- **GET** is read-only en publiek (alleen gepubliceerde content; `?drafts=1`
  met admin-sessie). Endpoints o.a. `products`, `components`, `releases`
  (`?product=`), en de afgeleide `itinerary/<product>`.
- **POST** is de schrijfkant voor product-projecten: `Authorization: Bearer
  <INGEST_TOKEN>` (constant-time check; leeg token = schrijven uit). Eén item
  via `POST /api/content/<type>/<slug>`, of een bundle via `POST /api/content`
  met `{ product?, components?, releases? }`. Elke put loopt door de
  zod-validatie en wordt een nieuwe bitemporale versie — dus ook machine-
  posts hebben volledige historie en rollback.

## 5. Admin (/admin)

- **Auth:** scrypt-wachtwoordhashes in de `users`-tabel, HMAC-signed
  session-cookie ([auth.ts](../sites/musicbrain/src/lib/auth.ts)). Rollen:
  `admin`/`editor` mogen schrijven, `reader` niet.
- **Formulieren uit schema's:** `contentFormSchema` zet het zod-schema om
  naar JSON Schema; `SchemaForm` rendert scalars als echte controls en
  complexe/recursieve velden als gevalideerde JSON-boxen. Een nieuw veld
  hoort dus in het schema, niet als los formulierveld.
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
        NX["next dev :3000"] --> MDBL[("MariaDB 10.11<br/>docker compose")]
    end
    subgraph plesk["Plesk (prod)"]
        PSG["Passenger → server.js<br/>(Node.js-extensie)"] --> MDBP[("MariaDB 10.11<br/>Plesk-database")]
    end
    GH["GitHub (git)"]
    dev -- "push<br/>code + drizzle-migraties" --> GH
    GH -- "pull + npm ci + build<br/>+ db:migrate" --> plesk
```

- **Code en schema** reizen via git: `db:generate` maakt van een wijziging
  in [db-schema.ts](../packages/content-core/src/db-schema.ts) een
  SQL-migratie in `drizzle/`; elke omgeving haalt zichzelf bij met
  `db:migrate`.
- **Content** wordt níet gesynct: de productie-database is de bron van
  waarheid; `db:seed` importeert de bestanden éénmalig (idempotent — draait
  hij nogmaals, dan wordt dat een nieuwe versie in de historie).
- Publieke pagina's zijn prerendered (SSG); admin-saves legen de cache en
  nieuwe pagina's renderen on demand — geen rebuild nodig.

## 7. Nieuwe site ("imprint") toevoegen

1. `sites/<naam>/` scaffolden (Next.js), `@imprint/content-core` als
   dependency.
2. Eigen `src/widgets/registry.ts` + `components.tsx` (de catalogus mag
   compleet anders zijn dan die van musicbrain).
3. Eigen design-tokens in `globals.css`.
4. Store aanwijzen in `src/lib/content.ts` (eigen `content/`-map of eigen
   database).

De kern verandert daarbij niet — dat is de kern van het ontwerp.

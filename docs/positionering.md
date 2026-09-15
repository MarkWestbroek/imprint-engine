# Imprint naast andere CMS'en

Waar staat Imprint tussen bekende systemen? Dit document is bedoeld voor wie
Imprint kent van naam ("zoiets als Drupal?") en wil weten wat het wel en niet
is. Stand van september 2026 (Imprint pre-1.0); bij tegenstrijdigheid is de
[architectuur](architecture.md) leidend voor wat er nu werkelijk is.

## In één zin

Imprint is een **CMS met contentschema's in code, bitemporele historie en een
eigen visuele studio**, op weg naar een engine met build-time plugins. Het is
*geen* statische sitegenerator en *geen* git-gebaseerd CMS.

## Veelgemaakte misverstanden

| Aanname | Hoe het zit |
|---|---|
| Content staat als bestanden in git | Content staat in een database (MariaDB of Postgres) achter de `ContentStore`. De file-store is alleen een v0-terugval zodat een kale checkout en CI zonder database bouwen. In git staan code, schema's en migraties — "alles in git behalve runtime-content" (eis S12). |
| De auteur is de developer | Redacteuren werken in `/admin`: rollen (admin/editor/reader), een studio die de pagina rendert met de echte widgets in de echte site-omlijsting, History met restore, tijdreizen, wiki-studio, planningborden, thema's. |
| Het is een statische React-SPA zonder serverkant | Het is een Next.js-serverapp: publieke pagina's zijn prerendered en worden na een admin-save gerevalideerd, maar er draaien login, server actions, een schrijf-API (bearer-token), multipart-ingest en een GitHub-webhook. Klein aanvalsoppervlak, niet nul. |
| Relaties, filters en runtime-data vragen om een "echt" CMS | Relaties zijn zachte slug-verwijzingen met afdwingbare RelationRules (bewerkbaar in de admin); `list`- en `planning`-widgets zijn views op data; er is een lees- en schrijf-API. Wat nog ontbreekt: formulieren (S10), publieke accounts, commerce (geen doel). |

## Imprint en Drupal

### Waar Imprint iets anders doet

- **Tijd als leesparameter.** Elke wijziging is een nieuwe rij met valid time
  én transaction time; `asOf` toont de site zoals hij op elk moment was of
  wordt, geplande publicatie volgt uit valid time. Drupal kent revisies
  (transaction time) en geplande publicatie via contrib, geen
  "site zoals op datum X".
- **Schema als code, één bron.** De zod-schema's valideren, genereren de
  admin-formulieren en worden als JSON Schema (`/api/meta`) en V3-metamodel
  gepubliceerd. Een nieuw type vraagt geen DB-migratie (generieke
  `content_items`-tabel). Velden bijklikken in de UI kan bewust niet; Drupal
  kan dat wel, en beperkt de drift daarvan met config-export naar git.
- **Verwisselbare opslag achter één contract.** File, MariaDB en Postgres
  doorstaan dezelfde contractsuite; het bitemporele register kan er later
  achter zonder paginacode te raken.
- **Machine-aanlevering als volwaardige route.** Productprojecten posten
  componenten, releases en board-specs met assets; die lopen door dezelfde
  validatie, referentiecheck en historie als redactiewerk.
- **Autorisatie via één PEP met verwisselbare beslisser** (AuthZEN-snijvlak).
  Flexibel ontwerp, maar de huidige regelset is eenvoudig.

### Waar Drupal ruim voorloopt

Field UI, Views en taxonomie; mediabibliotheek met afbeeldingsvarianten (S8
open); moderatie-workflows (Imprint heeft een draft-vlag); vertaalbeheer (het
fundament met `lang` en EN-fallback bestaat, de UI niet); rechten per item
(`ContentUser` staat in het schema, niet gehandhaafd); publieke accounts,
formulieren, zoeken; en twintig jaar ecosysteem plus een securityteam.

### Multisite

Beide delen code tussen sites met een database per site. Het verschil: een
Imprint-site bouwt en deployt als eigen app (upgrade per site, controleerbaar),
Drupal-multisite deelt één codebase-deploy (alle sites upgraden tegelijk).
Imprint kiest bewust géén multitenant admin
([revisievoorstel §11](design/engine-instance-plugin-architectuur.md)). Let
op: de scheiding is nog in uitvoering — renderer, admin en widgets staan nog
in `sites/musicbrain` (Fase 1–4).

### Plugins

Imprint kiest build-time plugins zonder marktplaats of browserinstallatie
([revisievoorstel §6.3](design/engine-instance-plugin-architectuur.md)). Dat
ligt dichter bij Drupal (modules via Composer) dan bij WordPress; het
verschil is dat een ontwikkelaar activeert in `imprint.config.ts` in plaats
van een beheerder in de UI. Het pluginsysteem bestaat nog niet (Fase 5).

## Imprint en Payload

[Payload](https://payloadcms.com) is inhoudelijk de naaste verwant: een
TypeScript-CMS dat sinds 3.0 in een Next.js-app draait, met het contentmodel
in code en een daaruit gegenereerde admin. Stand hieronder: Payload 3.89
(september 2026); 4.0 is in pre-alpha.

### Licentie en eigenaar

- De kern is **MIT** sinds mei 2022; daarvóór was Payload betaalde,
  propriëtaire software.
- Figma nam Payload in juni 2025 over; de MIT-licentie en de GitHub-repo zijn
  gebleven. Payload Cloud (managed hosting) neemt geen nieuwe projecten meer
  aan.
- **Open core in de praktijk:** een aantal features is alleen via Payload
  Enterprise beschikbaar — SSO, Publishing Workflows (goedkeuringsstappen),
  de Visual Editor, A/B-testing en AI-functies. Drafts, versies, live
  preview, localisatie en de officiële plugins zitten in de MIT-kern.

### Wat hetzelfde is

| | Payload | Imprint |
|---|---|---|
| stack | TypeScript, Next.js, React Server Components | idem |
| contentmodel | collections/globals in `payload.config.ts` | zod-schema's in `content-core` |
| admin | gegenereerd uit de config | formulieren gegenereerd uit de schema's (`SchemaForm`) |
| SQL-laag | Drizzle (Postgres, SQLite) | Drizzle (MariaDB, Postgres) |
| historie | drafts + versies + restore | versies + restore |
| plugins | npm-packages die de config transformeren, build-time | voorgesteld: build-time, via `imprint.config.ts` |
| API | Local API, REST, GraphQL | `ContentStore` (lokaal), REST `/api/content` |

### Waar ze uiteenlopen

| onderwerp | Payload | Imprint |
|---|---|---|
| **opslagmodel** | tabel per collection, plus `_rels`- (relaties), `_locales`- en `_v`-tabellen (versies), met foreign keys; MongoDB als alternatief | één generieke `content_items`-tabel, payload als zod-gevalideerde JSON; nieuw type = geen migratie |
| **relaties** | relationship-field, in SQL via `_rels` met foreign keys; integriteit in de database | zachte slug-verwijzingen; integriteit via RelationRules die zelf content zijn (bewerkbaar in de admin), enforced of advies |
| **tijd** | versies zijn momentopnames per document (alleen transaction time); geen "site zoals op datum X" | bitemporeel: valid time én transaction time, `asOf` over de hele site en de API |
| **gepland publiceren** | een background job zet `_status` om; vereist een draaiende job-runner | valt uit valid time; geen job nodig |
| **pagina-opbouw** | blocks-field: een lijst blokken met eigen schema; de frontend-developer rendert ze. Live preview = de frontend in een iframe via `postMessage`; de Visual Editor is enterprise | rijen → cellen (`span`) → widgets; een widget is schema **plus viewer** (en optioneel editor), dus de engine rendert zelf. De studio-canvas ís de pagina met echte viewers; `_view/<type>` maakt per-type weergaven in de studio samenstelbaar |
| **multisite** | multi-tenant-plugin: één database, `tenant`-veld per document, filtering in de applicatie, tenantkiezer in de admin | aparte app, database, secrets en cookie per site; geen multitenant admin (bewuste keuze) |
| **backends** | officieel MongoDB, Postgres, SQLite; geen MySQL/MariaDB | file, MariaDB, Postgres achter één contract met gedeelde contractsuite; later het bitemporele register |
| **autorisatie** | access-functies per operatie op collection-, global- én veldniveau, die ook `Where`-filters kunnen teruggeven | PEP met verwisselbare PDP; huidige regelset op rolniveau, rechten per item nog niet gehandhaafd |
| **i18n** | `localized: true` per veld, fallback-locale, localeschakelaar in de admin | taal per item met overlay op EN; geen admin-flow ([ontwerp](design/meertaligheid.md)) |
| **media** | upload-collections met afbeeldingsformaten (sharp), storage-adapters (S3 e.d.) | `AssetStore` (file), ingest via API; geen upload-UI of varianten (S8) |
| **formulieren, zoeken, SEO, redirects** | officiële plugins | nog niet (S10 loopt via het Omnium-formulierspoor) |
| **workflow** | drafts + autosave; goedkeuringsstappen = enterprise | draft-vlag + serverside studio-concept |
| **domein** | generiek | eerste imprint heeft een productdomein: component/release/board-spec, afgeleide itinerary, machine-ingest van borddocumentatie |
| **volwassenheid** | groot team (Figma), duizenden installaties | pre-1.0, één ontwikkelaar |

### Wat dat betekent

- **Het eigen terrein van Imprint** is smal maar echt: bitemporele opslag
  achter een verwisselbaar contract, een studio waarin widgets met hun eigen
  viewer de pagina ís, en isolatie per site in plaats van een tenantveld.
  Payload heeft geen van drieën in de kern.
- **De overlap zit in het generieke CMS-werk** — gebruikers en rechten per
  veld/item, media met varianten, localisatie-UI, formulieren, jobs. Daar is
  Payload ver vooruit, en precies dat werk staat voor Imprint nog in de
  backlog (Fase 3 "generieke adminbasis", S8, S9, S10).
- **Payload als backend achter `ContentStore`** is technisch denkbaar, maar
  kost de valid-time-as: tijdreizen en publicatie-uit-geldigheid zouden
  terugvallen op versies en jobs. Het zou dus het onderscheidende deel
  opgeven om het generieke deel te winnen.
- Een expliciete **bouwen-of-lenen-afweging vóór Fase 3** ligt voor de hand:
  welke generieke admin-onderdelen bouwt Imprint zelf, en welke ideeën
  (veldniveau-access die filters teruggeeft, upload-collections met
  formaten, een job-queue) neemt het over.

Bronnen: [Payload-licentie (2022)](https://payloadcms.com/posts/blog/open-source),
[overname door Figma](https://www.figma.com/blog/payload-joins-figma/),
[enterprise-features](https://payloadcms.com/enterprise),
[versies](https://payloadcms.com/docs/versions/overview),
[drafts en gepland publiceren](https://payloadcms.com/docs/versions/drafts),
[Postgres-adapter](https://payloadcms.com/docs/database/postgres),
[multi-tenant-plugin](https://payloadcms.com/docs/plugins/multi-tenant),
[access control](https://payloadcms.com/docs/access-control/overview),
[4.0-preview](https://payloadcms.com/posts/blog/payload-40-admin-ui-redesign-tanstack-mcp-and-more).

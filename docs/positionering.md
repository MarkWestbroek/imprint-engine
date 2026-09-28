# Imprint naast andere CMS'en

Actuele toets aan code en tests: [architectuur- en productreview van
28 september 2026](review-2026-09-28.md), inclusief de bijstelling op basis
van Marks doelen en de letterlijke oorspronkelijke chatreview. Vervolgwerk
staat in de [opdracht aan architect en bouw-agent](design/opdracht-review-doorontwikkeling.md).

Waar staat Imprint tussen bekende systemen? Dit document is bedoeld voor wie
Imprint kent van naam ("zoiets als Drupal?") en wil weten wat het wel en niet
is. Stand van september 2026 (Imprint pre-1.0); bij tegenstrijdigheid is de
[architectuur](architecture.md) leidend voor wat er nu werkelijk is.

## In één zin

Imprint is een **open-source website- en publicatiemotor in React en TypeScript
voor websites, portfolio's en gestructureerde publicaties in eigen beheer**:
ontwikkelaars bepalen model en vorm, redacteuren beheren content en stellen
pagina's visueel samen.

Contentschema's in code, versiehistorie, de studio en build-time plugins zijn
de bestaande basis. Een uitgebreidere bitemporele Go-backend is de gewenste
richting, nog geen opgeleverde integratie. Imprint is geen git-gebaseerd CMS;
prerendering is een publicatiestrategie binnen de serverapp.

## Voor wie en waarom

De eerste doelgroep omvat de eigen bestaande WordPress-sites, het
fotografieportfolio en product-/kenniswebsites. Fotografie is een zelfstandig
publicatiedomein, niet noodzakelijk een productcatalogus. Het werk wordt
gefaseerd; de doelgroep hoeft daarom niet tot productsites te worden beperkt.

Eigen beheer, openheid en aansluiting op de eigen JS/TS- en Go-stack zijn
zelfstandige argumenten om te bouwen. WordPress en Drupal zijn open source
(GPL); het bezwaar is hier hun PHP-ontwikkelbasis. Een headless React-site
verwijdert de PHP-backend en bijbehorende onderhoudslast niet.

Adobe Portfolio werkt voor Mark goed en is inbegrepen bij zijn Adobe-
abonnement. De reden voor migratie is extra zeggenschap, niet een bewezen
kostenbesparing. De technische onderbouw is hier niet vastgesteld; ga niet
uit van WordPress of een beschikbare WordPress-export. Behoud presentatie-
en beheerkwaliteit en migreer pas na een proef naast het bestaande portfolio.

Een vergelijking met andere JS/TS-CMS'en blijft nuttig, maar moet gaan over
de benodigde open-sourcefuncties, onderhoud en volledige data-export, niet
alleen de licentie van de kern. Gratis SaaS, source-available en open source
zijn verschillende zaken. Copyleft is een licentiekeuze, geen gebrek aan
openheid. De leveranciersversies en feature-/licentiepakketten in de
vergelijking hieronder zijn bij deze aanvulling niet opnieuw geverifieerd;
controleer actuele primaire bronnen voordat ze een selectiebesluit bepalen.

Mediabeheer, portfoliopresentatie en herhaalbare migratie worden daarom
eerste praktijkeisen, naast publicatiecorrectheid en beveiliging. Volg het
besloten [beeldbibliotheekontwerp](design/beeldbibliotheek.md). De Go-library
moet eerst worden onderzocht en via een kleine adapterproef worden aangesloten;
een nieuwe backend lost caches, toegangsrechten en redactieconflicten niet
automatisch op.

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
  én transaction time. De huidige `asOf` gebruikt één datum voor beide assen;
  pluginreads en publicatiecache zijn nog niet uniform tijdsbewust. Geplande
  vervanging heeft een gereproduceerde fout (R1). Dit is dus nog geen garantie
  dat de hele site op ieder tijdstip exact wordt gereconstrueerd. Drupal kent
  revisies en geplande publicatie via contrib; vergelijk de vereiste
  tijdsemantiek, niet alleen het woord "versies".
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
([revisievoorstel §11](design/engine-instance-plugin-architectuur.md)). Renderer,
admin en standaardwidgets staan inmiddels in gedeelde packages. Deployments
zijn afzonderlijk, maar packageversies lopen in deze monorepo gelijk;
dat is niet hetzelfde als onafhankelijk packageversies kiezen.

### Plugins

Imprint kiest build-time plugins zonder marktplaats of browserinstallatie
([revisievoorstel §6.3](design/engine-instance-plugin-architectuur.md)). Dat
ligt dichter bij Drupal (modules via Composer) dan bij WordPress; het
verschil is dat een ontwikkelaar activeert in `imprint.config.ts` in plaats
van een beheerder in de UI. Planning en wiki gebruiken dit pluginsysteem al.

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
| plugins | npm-packages die de config transformeren, build-time | build-time, via `imprint.config.ts`; planning en wiki bestaan |
| API | Local API, REST, GraphQL | `ContentStore` (lokaal), REST `/api/content` |

### Waar ze uiteenlopen

| onderwerp | Payload | Imprint |
|---|---|---|
| **opslagmodel** | tabel per collection, plus `_rels`- (relaties), `_locales`- en `_v`-tabellen (versies), met foreign keys; MongoDB als alternatief | één generieke `content_items`-tabel, payload als zod-gevalideerde JSON; nieuw type = geen migratie |
| **relaties** | relationship-field, in SQL via `_rels` met foreign keys; integriteit in de database | zachte slug-verwijzingen; integriteit via RelationRules die zelf content zijn (bewerkbaar in de admin), enforced of advies |
| **tijd** | versies zijn momentopnames per document; geen onafhankelijk tweedimensionaal tijdcontract | valid time én transaction time, nu met één `asOf` voor beide; plugins nog niet uniform, zie R5 |
| **gepland publiceren** | een background job zet `_status` om; vereist een draaiende job-runner | valid-time-filtering, maar vervanging en tijdgestuurde cacheverversing vragen herstel (R1/R5) |
| **pagina-opbouw** | blocks-field: een lijst blokken met eigen schema; de frontend-developer rendert ze. Live preview = de frontend in een iframe via `postMessage`; de Visual Editor is enterprise | rijen → cellen (`span`) → widgets; een widget is schema **plus viewer** (en optioneel editor), dus de engine rendert zelf. De studio-canvas ís de pagina met echte viewers; `_view/<type>` maakt per-type weergaven in de studio samenstelbaar |
| **multisite** | multi-tenant-plugin: één database, `tenant`-veld per document, filtering in de applicatie, tenantkiezer in de admin | aparte app, database, secrets en cookie per site; geen multitenant admin (bewuste keuze) |
| **backends** | officieel MongoDB, Postgres, SQLite; geen MySQL/MariaDB | file, MariaDB, Postgres achter één contract met gedeelde contractsuite; later het bitemporele register |
| **autorisatie** | access-functies per operatie op collection-, global- én veldniveau, die ook `Where`-filters kunnen teruggeven | PEP met verwisselbare PDP; huidige regelset op rolniveau, rechten per item nog niet gehandhaafd |
| **i18n** | `localized: true` per veld, fallback-locale, localeschakelaar in de admin | taal per item met overlay op EN; geen admin-flow ([ontwerp](design/meertaligheid.md)) |
| **media** | upload-collections met afbeeldingsformaten (sharp), storage-adapters (S3 e.d.) | `AssetStore` (file), ingest via API; geen upload-UI of varianten (S8) |
| **formulieren, zoeken, SEO, redirects** | officiële plugins | nog niet (S10 loopt via het Omnium-formulierspoor) |
| **workflow** | drafts + autosave; goedkeuringsstappen = enterprise | draft-vlag + serverside studio-concept |
| **domein** | generiek | eerste imprint heeft product-/borddocumentatie; beoogd ook gewone websites en fotografieportfolio's |
| **volwassenheid** | groot team (Figma), duizenden installaties | pre-1.0, één ontwikkelaar |

### Wat dat betekent

- **De eigen combinatie van Imprint** is tijdsbewuste opslag achter een
  verwisselbaar contract, een studio met echte widgetviewers en isolatie per
  site. Die combinatie kan voor de eigen websites waarde hebben zonder te
  claimen dat elk onderdeel uniek is of alle garanties al zijn opgeleverd.
- **De overlap zit in het generieke CMS-werk** — gebruikers en rechten per
  veld/item, media met varianten, localisatie-UI, formulieren, jobs. Daar is
  Payload ver vooruit, en precies dat werk staat voor Imprint nog in de
  backlog (Fase 3 "generieke adminbasis", S8, S9, S10).
- **Payload als backend achter `ContentStore`** is technisch denkbaar, maar
  kost de valid-time-as: tijdreizen en publicatie-uit-geldigheid zouden
  terugvallen op versies en jobs. Het zou dus het onderscheidende deel
  opgeven om het generieke deel te winnen.
- Een expliciete **bouwen-of-lenen-afweging per vervolgstap** blijft zinvol:
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

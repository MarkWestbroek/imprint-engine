# Plank: widgets en plugins die er nog niet zijn

> Brainstorm van 25 september 2026 (Mark + Claude), na Fase 5/6 van de
> engine-revisie. Wat ligt er in widget-cms-land op de plank, wat is van
> elders te lenen, en wat is kern versus plugin bij Imprint. Beslissingen van
> Mark staan gemarkeerd met **▶**. Concreet werk staat afgevinkt in
> `docs/backlog.md` (§1 widgets, §7 open beslissingen); dit document is de
> onderbouwing.

## 1. Views op andere bronnen (Marks idee)

De `api`- en `album`-widget doen al wat het idee beschrijft: server
components, `fetch` op de server (build/ISR), de browser ziet HTML — geen
CORS. Wat ontbreekt is de scheiding tussen **bron** en **weergave**: de URL
zit in de widget-config, elke widget fetcht zelf, er is geen plek voor
secrets, cachebeleid of een allow-list.

Voorstel (Drupal noemt dit *Views*, Directus *panels*):

- **`source` als contenttype** (of in `imprint.config.ts`): naam, URL-template,
  methode, headers, secret **bij naam** (`secrets.lightroom` — nooit een token
  in content), TTL, veldmapping (JSONPath-achtig, `items[*].title`).
- **Eén engine-functie `readSource(name, params)`** die als enige de deur
  uitgaat: cache, revalidatie, foutafhandeling en een **host-allow-list** in
  de config. Zonder allow-list is een door redacteuren ingevuld `url`-veld
  dat de server ophaalt een SSRF-gat (`http://169.254.169.254/…`). Dat geldt
  nu al voor `api`/`embed`/`album` → backlog.
- **Viewwidgets die alleen bron + mapping kennen**: `table`, `cards`, `list`,
  `chart`, `stat`. De bestaande `api`-widget is het zaadje; `list` krijgt een
  "bron"-modus (de lijst-variant uit de backlog).
- **Twee smaken tijd**: statisch (build/ISR, publiek) en per gebruiker
  (persoonlijke data). Voor de tweede één proxy-route `/api/source/[name]`
  achter de AuthZEN-poort die de secret toevoegt — de client praat met onze
  eigen backend, weer geen CORS.

## 2. Widgets die "iedereen" heeft

Vergeleken: Gutenberg-core, Wagtail StreamField, Payload blocks, Umbraco
Block Grid, Storyblok, Pleio. Onze 21 standaardwidgets dekken de basis; wat
ontbrak, op volgorde van hoe vaak het elders voorkomt:

| Grootte | Widget | Status |
|---|---|---|
| S | `quote` (pull-quote met bron) | ▶ bouwen |
| S | `code` (syntax-highlighting) | ▶ bouwen |
| S | `mermaid` (diagram uit tekst) | ▶ bouwen — "ja, leuk" |
| S | **`v3model`** — Marks variant: het V3-metamodel als diagram, elementen op positie en in domeinkleur | ▶ bouwen (zie §2.1) |
| S | `tabs` | ▶ bouwen |
| S | `cards` / feature-grid (icoon + kop + tekst + link) | ▶ bouwen |
| S | `buttons` (rij knoppen), `logos` (logo-wolk) | ▶ bouwen |
| S | `toc` (inhoudsopgave), `breadcrumb` | ▶ bouwen |
| S | `audio`, `pdf`, `file` (één download) | ▶ bouwen |
| S | `timeline` | ▶ bouwen |
| S | `media-text` (beeld naast tekst als één blok) | ▶ bouwen |
| S | `person`/`team`, `testimonial`, `pricing` | ▶ bouwen |
| M | `chart` (Chart.js, MIT) — pas echt nuttig mét de bronnen-laag (§1) | later |
| M | `rss` (inkomend; open deel van W6) — is in feite een *source* met XML-mapping | met §1 |
| M | `related`, `tagcloud`, `calendar`/`events` (vraagt contenttype → plugin) | later |
| M | `image-compare`, `countdown`, `share` | idee |
| L | `search` (zoekindex), `form` (zie §3) | plugin |

### 2.1 De V3-viewer

Het V3-formaat (`docs/design/v3-metamodel-spec.md`) kent `domeinen[]` met
`kleur`, entiteiten met `domein`-label en — in de UML-editor van Omnium —
`positie`/`layoutLocked` en `diagrammen[]`. De widget leest een V3-document
(geplakt, of van een URL zoals `/api/meta?format=v3`) en tekent entiteiten
als kaarten in hun domeinkleur, op `positie` als die er is en anders in een
automatisch raster per domein, met relaties als lijnen. **Open**: de exacte
vorm van `positie` en `diagrammen[]` in een echte Omnium-export — Mark
levert een voorbeeld, dan wordt de viewer daarop uitgelijnd.

## 3. Plugins die overal terugkomen

| Categorie | Elders | Bij Imprint |
|---|---|---|
| **Formulieren** | Gravity/CF7, Webform, Payload form-builder | Plugin. ▶ Mark vliegt dit aan vanuit bitemporal (Omnium-formulierrenderer leest al V3); landt daarna hier. Nr. 1 plugin in elk ecosysteem. |
| **Agenda/evenementen** | The Events Calendar | Plugin. ▶ De Volksgebouw-site heeft zoiets; generaliseren, en **op een standaard aansluiten** (§4.1). |
| **Zoeken** | Relevanssi, Search API | Plugin met adapter (§4.2). |
| **AI** | (hot, nog geen gevestigde plugin) | Plugin met adapter (§4.3). |
| **Meertaligheid** | WPML, Polylang | ▶ Via het model: een eigen dimensie in het bitemporele register naast de twee tijdsassen, niet op alle data. Zie `docs/design/meertaligheid.md`. |
| **SEO/metatag, sitemap, redirects** | Yoast, Metatag, Pathauto | Grensgeval: OG/title zit in het schema; sitemap en redirects zijn klein en horen in de kern. |
| **Reacties** | Disqus | Plugin (contenttype + moderatiescherm + publieke route). |
| **Workflow/moderatie** | Content Moderation, Scheduler | Concept en validFrom/validTo zitten in de kern; een goedkeuringsstap is plugin. |
| **Analytics, cookie-consent** | GA, Plausible, Complianz | Kleine plugins; bewust niet in de kern (privacykeuze per site). |
| **Leden/betaald, e-commerce** | MemberPress, WooCommerce | ▶ "ook nog iets" — toegang zit in de kern (`restricted`); betaling/winkel = plugin, later. |
| **Webhooks** | Directus flows | Engine-haak "na save"; nuttig als omgekeerde van §1. |
| **Backup** | UpdraftPlus e.d. | ▶ Belangrijk — ops, geen plugin (§4.4). |
| **Blog, portfolio, docs, glossary, changelog** | thema-afhankelijk | Contenttype-bundels: het plugin-formaat van planning/wiki. |

Volgorde: **forms → events → search**; sitemap/redirects/health zijn
kern-hardening (Fase 6).

## 4. Antwoorden op de vervolgvragen

### 4.1 Agenda: welke standaard?

- **iCalendar (RFC 5545)** is dé uitwisselingsstandaard: `VEVENT` met
  `DTSTART`/`DTEND`, `RRULE` (herhaling), `LOCATION`, `GEO`, `CATEGORIES`.
  Elke agenda-app leest `.ics`. **CalDAV (RFC 4791)** is iCalendar over
  WebDAV, voor tweerichtingssync (Nextcloud, Google, Apple).
- **schema.org/Event** voor de markup op de pagina (Google toont events dan
  rijk in de resultaten).
- Voorstel voor de plugin: contenttype `event` met iCalendar-compatibele
  velden (dus ook `rrule` als string; `rrule.js` is MIT), export
  `/calendar.ics` (abonneerbaar), **import** van een `.ics`/CalDAV-bron als
  *source* (§1) zodat een externe agenda ook getoond kan worden, en widgets
  `calendar` (maandraster) en `agenda` (lijst). Het Volksgebouw-model daarop
  mappen in plaats van andersom.

### 4.2 Zoeken: wat is open source, wat is een gedrocht?

| Optie | Licentie | Gewicht | Oordeel |
|---|---|---|---|
| Elasticsearch | AGPL/SSPL/Elastic (sinds 2024 ook AGPL) | JVM, ≥ 2 GB RAM, eigen cluster | Gedrocht voor een site van deze schaal. |
| OpenSearch (fork), Solr | Apache-2 | idem JVM | Zelfde. |
| **Meilisearch** | MIT | Rust, één binary, ~100 MB, REST, typo-tolerant | De moderne middenweg; als container naast Postgres prima. |
| Typesense | GPL-3 | C++, één binary | Vergelijkbaar; licentie is de reden om Meilisearch te kiezen. |
| **Postgres full-text** (`tsvector`, `pg_trgm`) | — | niets extra's | Voor duizenden documenten ruim genoeg; MariaDB FULLTEXT idem. |
| **Pagefind** | MIT | index bij de build, zoekt in de browser | Past perfect op SSG — maar kent geen toegang (`restricted`) en geen live content. |
| MiniSearch/FlexSearch | MIT | in-process JS | Klein, geen dienst; index in geheugen. |

Voorstel: een `search`-plugin met een `SearchAdapter`-interface; eerste
adapter **Postgres FTS** (niets installeren, respecteert toegang omdat de
query serverside door de poort gaat), tweede **Meilisearch** als een site
het nodig heeft. Indexeren op de save-haak; widget `search` + route
`/search`.

### 4.3 AI

Geen gevestigde plugin-categorie, wel bruikbare bouwstenen: een `plugin-ai`
met een adapter (Anthropic/OpenAI/lokaal) en drie haken: **in de editor**
(samenvatten, herschrijven, vertalen, alt-teksten), **op de save-haak**
(embeddings → `pgvector` voor semantisch zoeken, past op de zoekadapter) en
**publiek** ("vraag het de site": antwoord met bronverwijzingen uit de eigen
content, alleen wat de bezoeker mag zien). Kosten en privacy zijn per site
een keuze — daarom plugin, nooit kern.

### 4.4 Backup: standaard of zelf?

Beide, op de juiste laag:

- **Database**: `pg_dump` (logisch, consistent) is de standaard en is
  genoeg — de store is append-only/bitemporeel, dus een nachtelijke dump
  bevat álle historie. `pgBackRest`/Barman zijn voor point-in-time-recovery
  bij grote installaties; hier overbodig.
- **Bestanden** (assets, `.env`, Caddy-config): **restic** (BSD-2) of
  **borg** — versleuteld, gededupliceerd, offsite (S3/Backblaze B2/Hetzner
  Storage Box), met retentie (`forget --keep-daily 14 --keep-weekly 8`).
- **Eigen deel**: één script `deploy/vps/backup.sh` dat `pg_dump | restic`
  doet plus de assets-map, in cron; `npm run backup` (nu MariaDB-only,
  backlog) wordt daar een dunne aanroep van. Geen plugin: dit is ops en hoort
  in `docs/deploy-vps.md`. En: elk kwartaal een **restore-proef** in een
  wegwerpcontainer — een backup die nooit teruggezet is, bestaat niet.

## 5. Beeldbibliotheek: standaard

Overal kern (WordPress Media Library, Drupal Media, Strapi, Payload,
Umbraco, Craft): `image`, `hero`, `gallery`, `carousel`, OG-image en
productschema verwijzen allemaal naar assets; het is dwarsdoorsnijdend en de
gc/tijdreis-koppeling (`assets:gc`, versies houden hun assets) hoort bij de
opslaglaag. De `AssetStore` zit dus terecht in `content-core`. Wat ontbreekt
is de **UI** (S8 in de backlog): bibliotheekscherm in `runtime-admin`
(uploaden, bladeren, alt-tekst, gebruik-waar) en een **picker** die het
schema-formulier voor elk asset-veld gebruikt. **Plugin/adapter** zijn de
*providers*: S3/Cloudinary-opslag, Lightroom-import, varianten/optimalisatie
— dat past op `ImprintConfig.assets`.

## 6. Lenen en porten — met licentiebril

Ideeën lenen mag altijd; code porten hangt aan de licentie. WordPress,
Drupal, Pleio: GPL (code overnemen maakt Imprint GPL). Wagtail (BSD),
Payload, Keystone, Umbraco, Ghost (MIT), Tina (Apache-2): veilig. Directus is
BSL — niet porten.

Concreet het lenen waard:

- **Wagtail StreamField** — blokkenmodel met *snippets*: herbruikbare stukjes
  content (één callout op tien pagina's, op één plek bewerkt). Missen we.
- **Payload form-builder** — ontwerp van de forms-plugin (velden als data,
  inzendingen als collectie, e-mailtemplates, honeypot). MIT.
- **Drupal Views** — het denkmodel voor §1 (bron → filter → weergavevorm).
- **Gutenberg `block.json`** — referentie voor ons widget-contract
  (`attributes`, `supports`, `example`); een `example`-config per widget zou
  de catalogus-dialoog meteen een preview geven.
- **oEmbed-providerlijst** (data, geen code) — één `embed` die YouTube/
  Vimeo/SoundCloud/Flickr herkent i.p.v. widgets per dienst.
- **Strapi's provider-patroon** voor upload/e-mail — het adapter-idee dat we
  bij assets al doen.

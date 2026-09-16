# Claude Code-sessie-export

> **Let op:** export van een **Claude Code**-sessie. Gebruiker- en assistentteksten zijn letterlijk overgenomen; tool-aanroepen staan als compacte `🔧`-annotaties (hun output niet); interne redeneerblokken weggelaten.
>
> - **Datum:** 2026-09-15
> - **Sessie-id:** `878a0534-2c87-4748-8bd2-f16fd76ac5fa`
> - **Branch:** `engine/fase-0-en-postgres-backend`

---

## 👤 Gebruiker (1)

ik had los van het project een claude chat gevraagd naar hoe Imprint-engine zich verhoudt tot zoiets als drupal. Het antwoord was onderstaand, maar ik denk dat de Claude los van het project niet alle context en inhoud kent.

----
Kort gezegd: het zijn twee verschillende soorten dier. Jouw imprint-engine is een **site-generator plus designsysteem** (één codebase, `sites/<naam>/`, content als bestanden, React als rendering-laag). Drupal is een **CMS én applicatieframework**: een database met entiteiten, een runtime-configureerbaar contentmodel, en een redactie-UI met rollen en rechten.

De vier plekken waar het echt uiteenloopt:

- **Contentopslag** — bij jou git: diff, branch, PR-preview, rollback gratis. Bij Drupal rijen in een DB: revisions, workflow-states, maar je content leeft buiten je repo en migreren is een project op zich.
- **Contentmodel** — jouw types staan in code (TS/MDX-frontmatter), wijzigen = commit + build. Drupals Entity/Field API laat een beheerder er live een veld of contenttype bij klikken, met taxonomie en Views eroverheen.
- **Redactie** — jouw engine gaat ervan uit dat de auteur de developer is. Drupal gaat ervan uit dat dat níét zo is: WYSIWYG, mediabibliotheek, moderatie, vertaal-workflow.
- **Runtime** — jouw React-SPA serveert (semi-)statisch, minimaal aanvalsoppervlak, geen securityreleases om bij te houden. Drupal is een PHP-applicatie met caching-lagen, patch-ritme en majorupgrade-pijn.

Waar jij het wint is multi-site. Eén engine met een `sites/`-map is precies wat Drupals multisite altijd moeizaam deed (gedeelde code, aparte databases per site, gedeeld upgraderisico). Voor een handvol eigen merken-sites met dezelfde vormtaal is jouw model structureel schoner.

Het kantelt op het moment dat er content moet komen van iemand die geen git aanraakt, of als je runtime-data nodig hebt: formulieren, accounts, commerce, gestructureerde content met filters en relaties. Dan is de eerlijke vergelijking niet Drupal maar een git-based CMS (Keystatic, Decap, Tina) of een headless backend (Directus, Payload) achter je bestaande frontend.

Wat is de aanleiding — overweeg je iets te migreren, of wil je weten hoever de engine nog moet groeien?
-----

Wil je dat precisieren?

**🤖 Claude:**

Ik kijk eerst wat de engine nu werkelijk is, zodat de correctie op feiten rust.
> 🔧 `Bash` — Survey repo layout, docs and history
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/architecture.md
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/website-requirements.md
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/backlog.md
> 🔧 `Bash` — Show design docs, recent architecture commits, README
> 🔧 `Bash` — Search docs for CMS comparisons and outline design doc
> 🔧 `Bash` — Outline editor manual and admin routes
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/engine-instance-plugin-architectuur.md
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/engine-instance-plugin-architectuur.md
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/engine-instance-plugin-architectuur.md

**🤖 Claude:**

Ja. Die chat had geen toegang tot de repo en ging uit van een ander soort project: een statische sitegenerator met content in git. Imprint is dat niet (meer). Hieronder de bewering per punt naast wat de code en de docs zeggen, en daarna een eerlijkere vergelijking met Drupal.

## Wat niet klopt

| Bewering in de chat | Hoe het werkelijk zit |
|---|---|
| "Site-generator + designsysteem, content als bestanden" | Content staat in een **database** (MariaDB voor MusicBrain, Postgres voor de Imprint-site). Opslaan gaat altijd via `ContentStore`. De file-store is alleen een v0-terugval, zodat CI zonder database kan bouwen. |
| "Contentopslag = git: diff, branch, PR-preview gratis" | Juist niet. S12 zegt "alles in git **behalve runtime-content**". In git staan code, schema's en migraties. De historie van content staat in de DB, en die is **bitemporeel**: elke save is een nieuwe rij met valid time én transaction time. Een deelbare preview-URL voor drafts staat nog open in de backlog. |
| "De auteur is de developer" | Er is een `/admin` met rollen (admin, editor, reader). De studio toont de pagina met de echte widgets in de echte site-omlijsting. Verder zijn er een menu-editor, History met restore, tijdreizen, een wiki-studio met drag & drop, planningborden en thema's met kleurpickers. De handleiding is zelf een wiki die redacteuren kunnen bewerken. |
| "React-SPA, (semi-)statisch, geen securityreleases" | Het is een Next.js 16-serverapp. Publieke pagina's worden vooraf gerenderd en na een save in de admin ververst. Er draait wel echte serverlogica: login en sessies, server actions, een schrijf-API met bearer-token, multipart-uploads en een GitHub-webhook. Het aanvalsoppervlak is dus kleiner dan bij Drupal, maar niet nul, en Next.js en Node hebben ook een patchritme. |
| "Kantelt bij niet-git-auteurs, relaties, filters, runtime-data" | Het meeste daarvan bestaat al. Er zijn redacteuren zonder git. Relaties worden bewaakt met RelationRules, die je in de admin bewerkt en die een write weigeren bij een verwijzing naar niet-bestaande content. De `list`- en `planning`-widgets zijn views op data. Er is een lees- en schrijf-API. Wat echt nog ontbreekt: formulieren (S10), publieke accounts en commerce. Commerce is ook geen doel. |
| "Vergelijk met Keystatic, Decap of Tina" | Dat zijn CMS'en die content in git bewaren, en dat is Imprint niet. De dichtstbijzijnde vergelijking is waarschijnlijk **Payload**: TypeScript, draait in Next.js, schema's in code, een gegenereerde admin, versies en drafts. |

## Waar het wél klopt, maar preciezer

**Contentmodel in code.** Klopt: de typen zijn zod-schema's in `packages/content-core`, en een wijziging betekent commit en deploy. Maar:
- Er is één generieke `content_items`-tabel, dus een nieuw type vraagt **geen DB-migratie**.
- Uit datzelfde schema komen de validatie, de admin-formulieren, de JSON Schema-export op `/api/meta` en de V3-metamodel-export.
- Dat je in Drupal geen velden bij kunt klikken is een bewuste keuze ("geen click-ops-drift", eis B1).
- Wel eerlijk zijn: Drupal kan zijn configuratie ook naar git exporteren, dus het verschil is kleiner dan het klinkt.

**Multisite.** De richting klopt, maar het is nog niet af:
- Er zijn nu twee sites, elk met een eigen database (MariaDB en Postgres).
- Alleen de contracten staan al gedeeld in `content-core`. Renderer, admin, studio, autorisatie en de widgetcatalogus staan nog in `sites/musicbrain`. Fase 1 t/m 4 van het revisievoorstel moeten die eruit halen.
- Het gekozen model is "gedeelde code, aparte app en database per site, geen multitenant admin".
- Dat lijkt meer op Drupal-multisite dan de chat suggereert. Het echte verschil: elke Imprint-site bouwt en deployt apart, terwijl Drupal-multisite één codebase deelt die alle sites tegelijk upgradet.

## Het eigenlijke verschil met Drupal

**Waar Imprint iets heeft wat Drupal niet standaard heeft:**
- **Tijd als leesparameter.** Met `asOf` zie je de site zoals hij op elk moment was of wordt, op beide tijdassen. Geplande publicatie volgt vanzelf uit valid time. Drupal heeft revisies en een contrib-module voor planning, maar geen "toon de site zoals op datum X".
- **Verwisselbare opslag achter één contract.** File, MariaDB en Postgres doorstaan dezelfde contracttests, en het bitemporele register (Omnium) kan er later achter.
- **Machine-aanlevering als volwaardige route.** Hardwareprojecten posten componenten, releases en board-specs met assets. Die gaan door dezelfde validatie en krijgen dezelfde historie als werk van een redacteur.
- **Autorisatie via één poortje met een verwisselbare beslisser** (AuthZEN-achtig). Die opzet is flexibel, maar de huidige regelset is simpel.

**Waar Drupal ruim voorloopt:**
- velden toevoegen via de UI, Views, taxonomie;
- een mediabibliotheek met afbeeldingsvarianten (S8 staat open);
- moderatie-workflows (Imprint heeft alleen een draft-vlag);
- vertaalbeheer (de basis ligt er, met `lang` en terugval op EN, maar er is nog geen UI);
- rechten per item (`ContentUser` staat in het schema maar wordt niet afgedwongen);
- publieke gebruikersaccounts, formulieren (Webform), zoeken;
- twintig jaar ecosysteem en een securityteam, tegenover een pre-1.0-project met één ontwikkelaar.

**Plugins.** De chat noemde dit niet, maar het is relevant. Imprint kiest voor build-time plugins zonder marktplaats en zonder installatie via de browser (revisievoorstel §6.3). Dat ligt dichter bij Drupal (modules via Composer) dan bij WordPress. Het verschil: in Drupal zet een beheerder een module aan, in Imprint doet een ontwikkelaar dat in `imprint.config.ts`. Het pluginsysteem bestaat nog niet; dat is Fase 5.

## Samenvatting in één zin

Imprint is geen sitegenerator. Het is een **CMS met contentschema's in code, bitemporele historie en een eigen visuele studio**, op weg naar een engine met plugins, en inhoudelijk het best te vergelijken met Payload. Tegenover Drupal onderscheidt het zich door tijdreizen, verwisselbare opslag en machine-aanlevering, en loopt het achter op redactionele breedte: media, workflow, vertaling, formulieren en rechten.

Wil je dat ik dit als positioneringsparagraaf in `docs/README.md` of `docs/architecture.md` zet?

---

## 👤 Gebruiker (2)

ja, graag

Wil je daarna nog eens in detail kijken naar de verhouding tot Payload?

Is Payload even open source, overigens? Ik dacht het niet, namelijk. Of deels.
> 🔧 `ToolSearch`
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/README.md
> 🔧 `Bash` — Show top of changelog
> 🔧 `WebSearch`
> 🔧 `WebSearch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `Bash` — Look up latest Payload npm version
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebSearch`
> 🔧 `WebFetch`
> 🔧 `Write` — /Users/mark/Documents/GitHub/imprint-engine/docs/positionering.md
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/docs/README.md
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/CHANGELOG.md
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/docs/positionering.md
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/docs/backlog.md

**🤖 Claude:**

Payload is gewoon **open source**: de kern valt sinds mei 2022 onder de MIT-licentie. Daarvóór was het betaalde software, dus je herinnering klopt voor die periode. Je "deels" klopt ook, want het is open core. Een paar features krijg je alleen met Payload Enterprise: SSO, goedkeuringsworkflows, de Visual Editor, A/B-testing en AI-functies. Figma heeft Payload in juni 2025 overgenomen; de licentie is gebleven, maar hun managed hosting neemt geen nieuwe projecten meer aan.

## Wat ik heb aangepast

- **Nieuw: [docs/positionering.md](docs/positionering.md)**, met de misverstanden uit die chat, Imprint naast Drupal, en Imprint naast Payload in twee tabellen: wat hetzelfde is en waar ze uiteenlopen. Het is een los document geworden, niet een paragraaf in `docs/README.md` of `docs/architecture.md`, omdat het Payload-deel te groot werd voor een paragraaf.
- **Verwijzing** in [docs/README.md](docs/README.md) onder "Ik wil begrijpen waarom het zo is gebouwd".
- **Een regel in [CHANGELOG.md](CHANGELOG.md)** onder Unreleased.
- **Backlogpunt** in [docs/backlog.md](docs/backlog.md): "Bouwen of lenen vóór Fase 3" (uitleg hieronder).

Ik heb niets gecommit.

## Imprint naast Payload

**Wat hetzelfde is:**
- TypeScript en Next.js.
- Het contentmodel staat in code en de admin wordt eruit gegenereerd.
- Drizzle als databaselaag.
- Versies, drafts en restore.
- Plugins die bij de build worden gekozen.

**Wat Payload niet heeft en Imprint wel:**
- **Tijd.** Payload bewaart per document momentopnames, dus alleen wanneer iets is opgeslagen. Imprint legt vast wanneer iets gold én wanneer het is opgeslagen, en kan de hele site tonen zoals op een datum. Gepland publiceren is bij Payload een achtergrondtaak die een status omzet en een draaiende job-runner nodig heeft; bij Imprint volgt het vanzelf uit de geldigheidsdatum.
- **Pagina-opbouw.** Een Payload-block is alleen een schema; de frontend-developer rendert het, en live preview laadt die frontend in een iframe. Een Imprint-widget heeft een schema én een eigen viewer, dus de studio laat de echte pagina zien. De visuele editor is bij Payload juist een betaalde feature.
- **Meerdere sites.** Payloads multi-tenant-plugin gebruikt één database met een tenantveld per document. Imprint geeft elke site een eigen app en database.
- **Opslag.** Payload ondersteunt officieel MongoDB, Postgres en SQLite, maar geen MySQL of MariaDB. Voor MusicBrain, dat op MariaDB draait, is dat relevant.

**Waar Payload ver vooruit is:** rechten per operatie en per veld (die ook filters kunnen teruggeven), media met afbeeldingsformaten en S3-opslag, vertalen per veld met een taalkeuze in de admin, en officiële plugins voor formulieren, zoeken, SEO en redirects. Juist dat werk staat voor Imprint nog open: Fase 3 (generieke admin), S8 (media), S9 (meertaligheid) en S10 (formulieren).

## Wat ik ervan vind

Wat Imprint uniek maakt, is smal maar echt: bitemporele opslag achter een verwisselbaar contract, een studio met echte viewers, en isolatie per site. Payload als backend achter `ContentStore` gebruiken kan technisch, maar dan ben je de geldigheidsdatum kwijt, en daarmee precies wat Imprint onderscheidt.

Het generieke admin-werk overlapt wel sterk met Payload. Daarom de backlogregel: besluit vóór Fase 3 per onderdeel of Imprint het zelf bouwt of ideeën van Payload overneemt.

Sources:
- [Payload is now completely free and open source (2022)](https://payloadcms.com/posts/blog/open-source)
- [payload/LICENSE.md](https://github.com/payloadcms/payload/blob/main/LICENSE.md)
- [Welcoming Payload to the Figma Team](https://www.figma.com/blog/payload-joins-figma/)
- [Payload is joining Figma (GitHub discussion)](https://github.com/payloadcms/payload/discussions/12843)
- [Payload Enterprise](https://payloadcms.com/enterprise)
- [Payload Enterprise: Publishing Workflows](https://payloadcms.com/enterprise/publishing-workflows)
- [Payload CMS Pricing 2026 (Build with Matija)](https://www.buildwithmatija.com/payload-cms-pricing)
- [Payload CMS 4.0: Latest Status (Build with Matija)](https://www.buildwithmatija.com/blog/payload-4-0)
- [Payload 4.0: Admin UI Redesign, TanStack, MCP, and More](https://payloadcms.com/posts/blog/payload-40-admin-ui-redesign-tanstack-mcp-and-more)
- Payload-documentatie: [versies](https://payloadcms.com/docs/versions/overview), [drafts](https://payloadcms.com/docs/versions/drafts), [databases](https://payloadcms.com/docs/database/overview), [Postgres](https://payloadcms.com/docs/database/postgres), [plugins](https://payloadcms.com/docs/plugins/overview), [multi-tenant](https://payloadcms.com/docs/plugins/multi-tenant), [live preview](https://payloadcms.com/docs/live-preview/overview), [access control](https://payloadcms.com/docs/access-control/overview), [localisatie](https://payloadcms.com/docs/configuration/localization), [relaties](https://payloadcms.com/docs/fields/relationship), [blocks](https://payloadcms.com/docs/fields/blocks)

---

## 👤 Gebruiker (3)

zouden payload plugins in imprint te gebruiken zijn? Heeft dat zin?

**🤖 Claude:**

Ik kijk even hoe Payload-plugins technisch aan Payload vastzitten, en naast wat het Imprint-pluginvoorstel verwacht.
> 🔧 `Bash` — Inspect Payload plugin package dependencies
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/engine-instance-plugin-architectuur.md
> 🔧 `Bash` — Search for write hooks and revalidation call sites
> 🔧 `Bash` — Find revalidation call sites and store write entry
> 🔧 `WebFetch`
> 🔧 `WebFetch`

**🤖 Claude:**

Kort antwoord: nee, rechtstreeks gebruiken kan niet, en een tussenlaag bouwen heeft ook geen zin. Wat wél zin heeft: hun datamodellen overnemen, en één les voor het Imprint-pluginvoorstel.

## Waarom rechtstreeks niet werkt

Een Payload-plugin is een functie die een Payload-configuratie ombouwt: hij voegt collections, velden, hooks, admin-componenten en endpoints toe. Alle vijf de plugins die ik bekeek eisen exact `payload@3.89.0` als peer dependency; de meeste trekken ook `@payloadcms/ui` mee. Ze werken alleen binnen Payloads eigen runtime:

- **Hooks bij opslaan en verwijderen.** De zoekplugin houdt zijn index bij met `beforeChange` en `afterDelete`. De formulierplugin verstuurt mail vanuit een `beforeChange`-hook met `payload.sendEmail`.
- **De Local API en REST-endpoints**, zoals `POST /api/form-submissions`.
- **Admin-componenten** die in Payloads eigen admin draaien, zoals de SEO-preview.

Imprint heeft geen van die drie. Een adapter die dat nabootst is in feite Payload opnieuw bouwen.

**Een losse Payload-app naast Imprint**, bijvoorbeeld alleen voor formulieren, kan technisch wel. Dan krijg je er alleen een tweede admin, tweede gebruikersbeheer, tweede database en tweede updateritme bij. Bovendien overlapt het met het Omnium-formulierspoor dat S10 al invult. Dat raad ik niet aan.

## Wat wél zin heeft: de modellen overnemen

De plugins zijn MIT, dus code overnemen mag, zolang de copyrightvermelding meegaat. Het meeste nut zit in het ontwerp:

| Payload-plugin | Wat Imprint ervan kan leren | Backlog |
|---|---|---|
| **form-builder** | Een formulier als content met velden als blokken, een bevestiging (tekst of redirect) en mailsjablonen met `{{veld}}`. Inzendingen horen **niet** in de bitemporele store: net als bij users wil je die kunnen wissen (AVG). Payload heeft zelf ook geen spambescherming. | S10, W1, W4 |
| **search** | Een aparte index-collectie met alleen de doorzoekbare velden en een prioriteit, bijgehouden bij elke save. Het zoeken zelf doet de database. | `search`-widget |
| **redirects** | Redirects als contenttype plus middleware; handig zodra slugs veranderen. | nieuw |
| **seo** | Metavelden in het paginaschema. | W13 |
| **nested-docs** | Kruimelpaden; de wiki heeft al een mappenboom, dus weinig winst. | — |

## De les voor het pluginvoorstel

Bijna elke Payload-plugin draait op **hooks bij opslaan en verwijderen**. Imprint heeft die niet:
- `WritableContentStore.putItem` meldt niemand iets.
- De cache wordt op 8 losse plekken ververst: admin-, studio-, wiki-, planning- en users-actions, de ingest-route, de content-API en de GitHub-webhook.
- Het pluginmanifest in [revisievoorstel §6.4](docs/design/engine-instance-plugin-architectuur.md#L343-L365) heeft `jobs`, maar geen `hooks`.

Een zoekindex, redirects, formuliermails en het backlogpunt "seed triggert revalidatie" vragen allemaal om hetzelfde: een `afterPut`/`afterDelete` op store-niveau.

Daarbij zit een eigenaardigheid die Payload niet kent. Bij Imprint levert content die "geldig wordt" (een geplande publicatie) **geen schrijfactie** op. Een hook bij opslaan ziet dat moment dus niet. Een zoekindex of cache-verversing heeft daarom óók een tijdgestuurde job nodig die de grenzen van de geldigheid afloopt. Payload zet op dat moment met een job de status om, en daar vuurt de hook gewoon.

Payloads vorm ("functie die de config ombouwt") zou ik niet overnemen. Het declaratieve manifest van Imprint laat de engine de hele combinatie controleren bij de build (§6.3 punt 6); plugins die elkaars config ombouwen maken dat lastig. Dat manifest houden en er hooks aan toevoegen lijkt me de goede combinatie.

Zal ik de hooks-les (inclusief de geldigheids-events) in §6.4 van het revisievoorstel en in de backlog zetten, en een korte plugin-alinea toevoegen aan [docs/positionering.md](docs/positionering.md)?

Sources:
- [Payload plugins overview](https://payloadcms.com/docs/plugins/overview)
- [Form Builder plugin](https://payloadcms.com/docs/plugins/form-builder)
- [Search plugin](https://payloadcms.com/docs/plugins/search)
- [payload/LICENSE.md](https://github.com/payloadcms/payload/blob/main/LICENSE.md)

---

## 👤 Gebruiker (4)

Misschien waren plugins wat te diep in het systeem liggende dingen. Ik dacht eigenlijk aan widgets (de meer grafische dingen) , maar noemde het plugins. Is daar hergebruik mogelijk? Het is ook react, toch?

**🤖 Claude:**

Payload kent geen "widgets" zoals Imprint die bedoelt. Ik kijk wat er het dichtst bij komt (de blocks in hun website-template) en hoe het Imprint-widgetcontract eruitziet.
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebSearch`
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/widget-standaarden.md
> 🔧 `Bash` — Inspect MusicBrain widget registry and viewer signatures
> 🔧 `Bash` — Show widget viewer type and callout/hero schemas
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `Read` — /Users/mark/Documents/GitHub/imprint-engine/sites/musicbrain/src/widgets/components.tsx

**🤖 Claude:**

Ja, allebei React, en de stacks liggen dicht bij elkaar: Payloads website-template draait ook op Next.js 16 en Tailwind v4. Toch levert het weinig op. Payload heeft geen widgetbibliotheek die je kunt installeren, en hun voorbeeldblokken zijn zo met Payloads eigen datamodel verweven dat overnemen neerkomt op herschrijven. Zelf kopiëren kost bijna even veel.

## Wat Payload heeft dat op widgets lijkt

1. **Blocks in hun website-template** (MIT): Archive, Banner, CallToAction, Code, Content, Form, MediaBlock en RelatedPosts. Dit is voorbeeldcode die je in je eigen project kopieert, geen npm-package.
2. **Dashboard-widgets** (sinds 3.69): alleen voor het startscherm van hun admin. Ze halen data via de Payload-instantie, dus ze zijn niet bedoeld voor de publieke site.
3. **`@payloadcms/ui`**: de componenten van de admin zelf. Die hangen aan Payloads formuliercontext.

Alleen het eerste komt in de buurt van wat jij bedoelt.

## Waarom zo'n blok niet overdraagbaar is

Neem hun `CallToAction`. De JSX is ongeveer 25 regels Tailwind, maar alles wat erin gaat is Payload-specifiek:
- de props zijn het gegenereerde type uit `@/payload-types`;
- de tekst is Lexical-JSON, weergegeven met hun `RichText` uit `@payloadcms/richtext-lexical`;
- de knoppen komen uit `CMSLink`, dat met Payloads link-veld werkt (verwijzing naar een document óf een URL);
- de kleuren zijn shadcn-tokens (`bg-card`, `border-border`).

Imprints `callout` heeft `markdown`, `tone`, `buttonLabel` en `buttonUrl`. De viewer is een async server-component `(props: { config, subject? })` die zelf de store mag lezen ([components.tsx:72](sites/musicbrain/src/widgets/components.tsx#L72)). Als je props, tekstformaat, links en tokens vervangt, blijft alleen wat Tailwind-opmaak over.

## Naast de Imprint-catalogus

| Payload-blok | In Imprint |
|---|---|
| CallToAction, Banner | `callout` (met `tone`) |
| Content (kolommen) | het rijen-en-cellen-model zelf |
| MediaBlock | `image`, `video` |
| Archive, RelatedPosts | `posts`, `list` |
| **Code** | ontbreekt; klein om te maken |
| **Form** | ontbreekt (S10) |

Alleen Code en Form ontbreken. Het Form-blok is het enige dat de moeite waard is om te bestuderen:
- velden worden via hun `blockType` aan een component gekoppeld;
- het formulier gebruikt `react-hook-form`;
- het POST de inzending naar een endpoint;
- daarna volgt een bevestiging of een redirect.

Neem die opbouw over voor S10, niet de code.

## Waar hergebruik van grafische widgets wél zit

Dat staat grotendeels al in je onderzoek van juli ([widget-standaarden.md](docs/design/widget-standaarden.md)): er is geen standaard, en Imprints model is de hoofdstroom. Voor de grafische kant is het praktische antwoord **gewone React-componentbibliotheken**, niet CMS-blokken:

- **Het patroon heb je al**: een dunne server-viewer met een `"use client"`-eiland erin. De kaart-widget (Leaflet) en de 3D-tab (`<model-viewer>`, een webcomponent) werken zo.
- **shadcn/ui en Radix** voor accordion, tabs, dialog en carousel. shadcn is broncode die je kopieert, en werkt ook met Tailwind v4 en CSS-variabelen. Je moet hun tokennamen wel op de Imprint-tokens afbeelden (geen losse hexkleuren).
- **Een grafiekbibliotheek** zoals Recharts voor data-widgets, en Leaflet (heb je al) voor kaarten.
- **Puck** (MIT) heeft vrijwel hetzelfde contract als Imprint (`fields` plus `render`). Daar zou uitwisseling in beide richtingen mechanisch kunnen; dat stond al in het onderzoek.

Mijn advies: sla de Payload-blokken over. Bouw nieuwe grafische widgets als Imprint-viewer met een eiland uit een generieke React-bibliotheek, en gebruik Payloads Form-blok als referentie voor S10.

Zal ik een korte paragraaf "Payload-blocks nader bekeken" toevoegen aan [widget-standaarden.md](docs/design/widget-standaarden.md)?

Sources:
- [Payload website-template blocks](https://github.com/payloadcms/payload/tree/main/templates/website/src/blocks)
- [Website-template package.json](https://raw.githubusercontent.com/payloadcms/payload/main/templates/website/package.json)
- [CallToAction Component.tsx](https://raw.githubusercontent.com/payloadcms/payload/main/templates/website/src/blocks/CallToAction/Component.tsx) · [config.ts](https://raw.githubusercontent.com/payloadcms/payload/main/templates/website/src/blocks/CallToAction/config.ts)
- [Form Component.tsx](https://raw.githubusercontent.com/payloadcms/payload/main/templates/website/src/blocks/Form/Component.tsx)
- [Dashboard Widgets | Payload](https://payloadcms.com/docs/custom-components/dashboard)
- [New in Payload: Dashboards, Developer Control, and Next.js 16](https://payloadcms.com/posts/releases/new-in-payload-dashboards-developer-control-and-nextjs-16)
- [New in Payload: Admin, Rich Text, and Extensibility](https://payloadcms.com/posts/releases/new-in-payload-admin-rich-text-and-extensibility)
- [[RFC] Modular Dashboards](https://github.com/payloadcms/payload/discussions/11862)
- [Payload CMS 3.69: Modular Dashboards (MadeWithPayload)](https://madewithpayload.com/videos/payload-cms-369-introducing-modular-dashboards-for-enhanced-admin-ux)
- [Create a flexible admin panel with Modular Dashboard (YouTube)](https://www.youtube.com/watch?v=fXF34Ef6G84)
- [payload-admin-ui-pro (community)](https://github.com/pOwn3d/payload-admin-ui-pro)
- [Customizing Views | Payload](https://payloadcms.com/docs/custom-components/custom-views)
- [Dashboard docs source (GitHub)](https://github.com/payloadcms/payload/blob/main/docs/custom-components/dashboard.mdx)

---

## 👤 Gebruiker (5)

ja, graag

Wil je daarna eens naar NL design system componenten kijken? Hebben we in het formulieren deel in het bitemporal project (omnium nu) al wat mee gedaan.

**🤖 Claude:**

Het Payload-blok komt in widget-standaarden.md. Tegelijk zoek ik het Omnium-/bitemporal-project lokaal op.
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/widget-standaarden.md
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/widget-standaarden.md
> 🔧 `Bash` — List local GitHub repos, find Omnium
> 🔧 `Bash` — Find NL Design System references in Omnium repo
> 🔧 `Bash` — List Omnium packages and NLDS dependencies
> 🔧 `Bash` — Check Imprint, Pleio and CMS repos for NLDS references
> 🔧 `WebFetch`
> 🔧 `WebSearch`
> 🔧 `Bash` — List Utrecht/NLDS imports across Omnium source
> 🔧 `Bash` — Identify which folder is the live Omnium app
> 🔧 `Bash` — Extract NLDS passages from Omnium form plans
> 🔧 `Bash` — Inspect Omnium theme CSS and NLDS usage in form field
> 🔧 `Bash` — Check licenses and NLDS npm package status
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `WebSearch`
> 🔧 `Bash` — Detail NLDS usage in Omnium source and form docs
> 🔧 `Bash` — Download Utrecht React package and inspect exports and RSC readiness
> 🔧 `Bash` — List Imprint design-token names
> 🔧 `WebFetch`
> 🔧 `WebFetch`
> 🔧 `Bash` — Trace how Omnium form renderer depends on Utrecht and Omnium
> 🔧 `Bash` — Check hook usage in Utrecht React bundle
> 🔧 `Bash` — Show Omnium commits about Imprint reuse and handover
> 🔧 `Bash` — Check Omnium form field dependencies on its API
> 🔧 `Bash` — Extract NLDS/renderer passages from Omnium Imprint doc
> 🔧 `Bash` — Extract relevant passages from Omnium forms handover
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/CHANGELOG.md

**🤖 Claude:**

Het Payload-blok staat in [widget-standaarden.md](docs/design/widget-standaarden.md), met een regel erbij in de changelog.

Over NL Design System: in Omnium gebruik je het al, maar anders dan je misschien denkt. Het React-package van Utrecht is geïnstalleerd, maar geen enkel bestand importeert het. De formulieren gebruiken alleen de **CSS-klassen en tokens** van Utrecht op eigen markup. Voor Imprint is dat juist de handige route.

## Wat Omnium al doet (`bitemp_register_v06/web/vite`)

- **Keuze** (Forms plan 01, maart 2026): `react-hook-form` met een eigen veldcomponent. RJSF en form.io vielen af. Later (plan F1, april) nam je het "UI Schema"-idee van JSON Forms over, zonder de library zelf.
- **Hoe NLDS erin zit:** 14 bestanden zetten Utrecht-klassen op eigen HTML, zoals `utrecht-form-field`, `utrecht-form-label`, `utrecht-textbox--html-input` en `utrecht-form-field-error-message` (met `role="alert"`). Nergens staat `import … from "@utrecht/component-library-react"`.
- **Thema:** [common-ground-theme.css](../Bitemporal_2026/bitemp_register_v06/web/vite/src/styles/common-ground-theme.css) (554 regels) overschrijft de `--utrecht-*`-tokens met Common Ground-kleuren.
- **Renderer:** `CustomFormulierRenderer` (231 regels) rendert groepen, rijen, velden, voorwaarden en herhaalbare lijsten. De visuele formuliereditor draait als activiteit in Omnium Studio en staat op main.
- **Zoekveld:** `RefCombobox` is gebouwd met `downshift`, omdat de Select Combobox bij NLDS nog "Help Wanted" is.
- **Over Imprint:** in juli schreef je [imprint-contentmodel-v3.md](../Bitemporal_2026/bitemp_register_v06/docs/imprint-contentmodel-v3.md), over hoe de formuliereditor een V3Model voor Imprint kan gebruiken.
- **Aandachtspunten:**
  - Omnium draait op React 18 met Utrecht React `^13`; de actuele versie is 15.0.0.
  - De CSS-bundel is 553 KB (49 KB gzip); dat staat als F15 in de Omnium-backlog.
  - De renderer zit vast aan Omnium: `useSchema()`, `validatieMeldingVoorVeld` uit `ActionFormParts`, en `RefCombobox` haalt opties op via `/api/viz/reflijst/…`.

## Stand van NL Design System (september 2026)

- **Geen enkele bibliotheek, maar een estafettemodel:** Help Wanted → Community → Candidate → Hall of Fame. Er bestaan implementaties per organisatie (Utrecht, Amsterdam, Den Haag en andere), en de meeste componenten zijn Community.
- **Candidate-packages zijn nog basaal.** De React-packages die ik vond: button, heading, paragraph, link, skip-link, code, code-block, data-badge en number-badge. Formuliercomponenten zitten er nog niet bij; form-field is Community.
- **Voor formulieren blijft Utrecht de praktische bron.** `@utrecht/component-library-react@15.0.0` (augustus 2026) heeft FormField, FormLabel, FormFieldDescription, FormFieldErrorMessage, Textbox, Textarea, Select, Checkbox, RadioButton, Fieldset, Combobox, Calendar, Button, Alert, Table en Accordion. Het werkt met React 18 en 19.
- **Licentie:** de code is EUPL-1.2, Imprint is MIT. Als ongewijzigde dependency is dat geen probleem; aanpassingen aan hún code vallen onder EUPL.
- **De formulierrichtlijnen** zijn misschien het meest waardevol, los van de componenten: labels, foutmeldingen, fieldsets, formulieren in stappen, placeholders en verplichte velden.

## Hoe het in Imprint past

- **Server-components.** Ik heb het package gedownload en bekeken. De bundel `dist/index.mjs` heeft geen `"use client"` en gebruikt `useState`, `useId` en `useRef`. Rechtstreeks importeren in een Next.js server-component gaat daardoor waarschijnlijk mis (niet getest). De Omnium-aanpak, alleen de CSS-klassen, werkt wel zonder JavaScript en past bij Imprints patroon: een server-viewer met een client-eiland alleen waar nodig.
- **Minder CSS.** Utrecht levert ook losse CSS-packages per component (`@utrecht/form-field-css`, `@utrecht/textbox-css` enzovoort). Door alleen die te laden in plaats van de hele bibliotheek los je ook F15 in Omnium op.
- **Tokens.** Imprint heeft zo'n tien algemene tokens (`--background`, `--surface`, `--border`, `--foreground`, `--accent`, …) die per `data-theme` wisselen. Utrecht heeft honderden tokens per component. Een brugbestand dat de `--utrecht-*`-tokens aan Imprint-tokens koppelt, laat NLDS-velden meekleuren met elk thema, ook donker. Het Common Ground-thema is daar het sjabloon voor, maar dan met tokens in plaats van hexkleuren.
- **De twee sporen sluiten op elkaar aan.** Imprint publiceert al een V3Model op `/api/meta?format=v3`, en de Omnium-renderer leest V3. Een `form`-widget voor S10 is dus: de renderer als client-eiland, schema en optiebron van buitenaf aangereikt in plaats van `useSchema()` en `fetch`, en de NLDS-klassen met de tokenbrug.
- **Waar het niet voor is:** NLDS vervangt de widgetcatalogus niet. Het gaat om formulieren, typografie en navigatie, niet om galerijen, kaarten of borden. Voor MusicBrain (eigen merk, standaard donker) is het vooral de formulierlaag. Bij een imprint voor een gemeente of Common Ground wordt NLDS bijna een vereiste.

## Wat ik zou doen

1. **S10 via deze route:** de renderer uit Omnium losmaken als package zonder Omnium-koppelingen, en in Imprint een `form`-widget bouwen met de losse Utrecht-CSS en een tokenbrug.
2. **Utrecht in Omnium eerst van 13 naar 15 bijwerken**, zodat beide projecten dezelfde versie gebruiken.
3. **De NLDS-formulierrichtlijnen als checklist** gebruiken, ook voor de `SchemaForm` in Imprints admin.

Zal ik dit vastleggen als `docs/design/nl-design-system.md` en het backlogpunt "Formulier-renderer als widget" hiermee aanscherpen?

Sources:
- [NL Design System — componenten](https://nldesignsystem.nl/componenten/)
- [NL Design System — Form Field](https://nldesignsystem.nl/form-field/)
- [NL Design System — richtlijnen formulieren](https://nldesignsystem.nl/richtlijnen/formulieren/)
- [nl-design-system/candidate (GitHub)](https://github.com/nl-design-system/candidate)
- [nl-design-system/utrecht (GitHub)](https://github.com/nl-design-system/utrecht)
- [@nl-design-system-candidate/skip-link-react](https://www.npmjs.com/package/@nl-design-system-candidate/skip-link-react) · [skip-link-react (socket.dev)](https://socket.dev/npm/package/@nl-design-system-candidate/skip-link-react) · [code-react](https://www.npmjs.com/package/@nl-design-system-candidate/code-react) · [link-react](https://www.npmjs.com/package/@nl-design-system-candidate/link-react) · [paragraph-react](https://www.npmjs.com/package/@nl-design-system-candidate/paragraph-react) · [heading-react](https://www.npmjs.com/package/@nl-design-system-candidate/heading-react) · [data-badge-react](https://www.npmjs.com/package/@nl-design-system-candidate/data-badge-react) · [code-block-react](https://www.npmjs.com/package/@nl-design-system-candidate/code-block-react)
- [NL Design System (GitHub-organisatie)](https://github.com/nl-design-system)
- Algemene zoekresultaten over React/Tailwind-designsystemen (niet NLDS-specifiek): [Medium — React + Tailwind](https://medium.com/@mernstackdevbykevin/react-tailwind-building-scalable-component-libraries-that-actually-ship-a7b00d07f260) · [Medium — themed design system](https://medium.com/@andriy.vl/building-a-themed-design-system-with-tailwind-and-css-variables-for-react-and-next-js-apps-2df0ff783440) · [MadHouseLabs/design-system](https://github.com/MadHouseLabs/design-system) · [freeCodeCamp](https://www.freecodecamp.org/news/how-a-design-system-in-next-js-with-tailwind-css-and-class-variance-authority/) · [DEV Community](https://dev.to/devinschumacher/the-best-component-libraries-for-react-nextjs-tailwind-ui-8l1)

---

## 👤 Gebruiker (6)

ja, graag
> 🔧 `Bash` — Locate form renderer backlog item
> 🔧 `Write` — /Users/mark/Documents/GitHub/imprint-engine/docs/design/nl-design-system.md
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/docs/backlog.md
> 🔧 `Edit` — /Users/mark/Documents/GitHub/imprint-engine/CHANGELOG.md
> 🔧 `Bash` — Verify Utrecht token names used in the bridge example

**🤖 Claude:**

The ontwerpdocument staat in [docs/design/nl-design-system.md](docs/design/nl-design-system.md). De `--utrecht-*`-tokennamen in het voorbeeld van de tokenbrug heb ik gecontroleerd; ze bestaan alle zes in de Utrecht-CSS-packages.

**Wat erin staat:**
- **Wat Omnium al doet.** Utrecht-CSS-klassen en het Common Ground-thema, maar geen imports van de React-bibliotheek. Verder de renderer en de formuliereditor, en waar de renderer aan Omnium vastzit (`useSchema()` en de `/api/viz/…`-fetch).
- **Stand van NL Design System.** Het estafettemodel, de candidate-packages (nog zonder formuliercomponenten), Utrecht 15.0.0, de EUPL-licentie en de formulierrichtlijnen.
- **Hoe het in Imprint past.** CSS-klassen in plaats van de React-bibliotheek, omdat die geen `"use client"` heeft maar wel hooks gebruikt. Losse CSS-packages per component, een tokenbrug `nlds-bridge.css` met voorbeeld, en een diagram van de `form`-widget.
- **Volgorde:** Utrecht in Omnium bijwerken → de renderer losmaken → de widget bouwen → de richtlijnen afvinken.

**Verder aangepast:**
- [docs/backlog.md](docs/backlog.md): het punt "Formulier-renderer als widget" onder S10 is opgesplitst in vijf stappen. Twee daarvan liggen bij Omnium.
- [CHANGELOG.md](CHANGELOG.md): een regel onder Unreleased.

Twee dingen heb ik niet getest:
- dat het React-package van Utrecht in een Next.js server-component echt misgaat;
- of Tailwinds preflight de Utrecht-basisstijlen verstoort.

Beide staan als aandachtspunt in het document.

Ik heb niets gecommit. Er staan nu vier documentatiewijzigingen uit dit gesprek, plus de wijzigingen die intussen via een andere sessie binnenkwamen (onder andere composition root Fase 1).


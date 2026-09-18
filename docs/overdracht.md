# Overdracht — verder werken op een andere machine

Geschreven juli 2026, bij de overstap desktop → laptop. Bedoeld als
startpunt voor een nieuwe chatsessie: waar staat het project, hoe krijg je
het draaiend, en waar liggen de valkuilen. De inhoudelijke docs blijven
leidend — dit is de kaart, niet het gebied.

**Bijgewerkt 16 september 2026** bij de overstap laptop → Windows-desktop:
§0 hieronder is nieuw en gaat vóór de rest. §3 beschrijft de situatie van
juli en klopt niet meer; wat daar staat is bewaard als "hoe het werkte op
Plesk", omdat die stappen bij de verhuizing terugkomen.

## 0. Stand op 16 september 2026 — lees dit eerst

### 0.1 MusicBrain is offline sinds 1 september

Quickhost (shared hosting, Plesk) heeft per 1 september Node.js en Passenger
serverbreed uitgezet. Sindsdien geeft **musicbrain.nl een Apache 403**, net
als volksgebouwzeist.nl en psycholog.pi-utrecht.nl. Er is niets kapot in
Imprint; de deploy van 31 augustus was toevallig de eerste die er last van
had. Statisch werkt nog: **editor.musicbrain.nl geeft 200**. De GitHub-
webhooks uit §3 doen niets nuttigs meer.

Er is intussen een VPS: **vps1.paratmos.nl** (mijn.host, Ubuntu 26.04,
Caddy als reverse proxy, alles in Docker). Omnium draait er al op
(app.omnium-ide.nl). Hoe die machine in elkaar zit staat in het
Bitemporal-repo: `bitemp_register_v06/docs/VPS_DEPLOYMENT.md` (runbook) en
`docs/plans/2026-09-16 Handover naar desktop — hosting, VPS en toegang vanaf
Windows.md` (keuzes, stand, Windows-toegang). **Regel eerst je SSH-sleutel
vanaf Windows op die VPS** (§4 van dat document) voordat je hier iets
deployt.

### 0.2 Verhuizing MusicBrain naar de VPS — nog niet gedaan

Volgorde, ongeveer een dagdeel werk:

1. **Data van Quickhost halen zolang het nog kan** (via Plesk, want SSH/Node
   doet het niet meer): databaseexport van de MariaDB (volledige historie +
   users), de repo-root `.env` en `sites/musicbrain/.env.local`
   (`SESSION_SECRET`, `INGEST_TOKEN`, `GITHUB_WEBHOOK_SECRET`), en de
   assetmap waar `ASSET_ROOT` naar wijst. Eén tar van alles is genoeg.
2. **Backend kiezen.** Sinds fase 0 kan Imprint op Postgres draaien
   (`DATABASE_URL=postgres://…`), maar users/admin-login, backup en assets-gc
   zijn nog MariaDB-only. Voor MusicBrain dus **MariaDB in een container
   naast de bestaande Postgres** op de VPS, met de export uit stap 1
   ingeladen. Postgres voor MusicBrain is werk voor later, niet voor de
   verhuizing.
3. **Image bouwen.** Er is nog geen Dockerfile voor de Next-app; Plesk
   bouwde op de server. Nodig: multi-stage build (`npm ci`, `npm run
   build`, `next start`), `.env.local` als env-vars, `ASSET_ROOT` als
   volume. Model: `deploy/vps/` in het Bitemporal-repo.
4. **Caddy**: het blok voor `musicbrain.nl` staat al als commentaar in de
   Caddyfile op de VPS; `editor.musicbrain.nl` kan als statische map mee.
   DNS van musicbrain.nl naar de VPS omzetten (A-record; geen AAAA naar
   een parkeeradres, dat breekt Let's Encrypt).
5. **Deploy in plaats van webhook**: `scp` + `docker compose pull/up`, zoals
   bij Omnium. GitHub Actions kan later.
6. Daarna: volksgebouwzeist.nl en psycholog.pi-utrecht.nl op dezelfde manier,
   en Quickhost opzeggen.

README.md §"Deploy naar Plesk" en de Plesk-stappen in §3 hieronder zijn dan
historie; opruimen na de verhuizing.

### 0.3 Wat er in het repo is veranderd sinds juli (allemaal op `main`)

Versie staat nog op 0.10.2; alles hieronder zit onder `## [Unreleased]` in
`CHANGELOG.md` en is niet gereleased en niet gedeployed (er is niets om op
te deployen).

- **Opdrachtbrief** `docs/design/opdracht-engine-bibliotheek-backend-site.md`:
  Imprint in vier lagen — engine, bibliotheek, backend, site.
- **Fase 0** (commit `d7b1606`): architectuurcontract in `docs/architecture.md`
  §0, `npm test` met een `ContentStore`-contractsuite (file-store, en met
  `TEST_DATABASE_URL` ook MariaDB/Postgres via `npm run test:db`),
  karakterisatietests van gedrag dat niet mag veranderen.
- **Postgres als tweede backend** (zelfde commit): `PgContentStore`, eigen
  migraties (`drizzle-pg/`, `npm run db:migrate:pg`), `openContentDatabase(url)`
  kiest op het URL-schema. De Imprint-productsite (`sites/imprint`) draait
  lokaal op Postgres; MusicBrain op MariaDB. `docker compose` heeft nu ook
  Postgres 17 op poort 5434.
- **Fase 1** (`3930ffb`): package `@imprint/extension-api` met
  `defineImprint()`/`createImprint()`; elke site heeft een
  `imprint.config.ts` (composition root). Gedrag ongewijzigd.
- **Tailwind-fix** (`17d51da`): koude compile van minuten naar seconden
  (`@source not` voor `public/` en `.assets/`).
- **Positionering**: `docs/positionering.md` (Imprint naast Drupal en
  Payload), `docs/design/nl-design-system.md` (wat Omnium met NL Design
  System doet en hoe dat in Imprint past), vervolg in
  `docs/design/widget-standaarden.md`.
- Drie chat-exports in `doc/ai-chats/exports/` staan nog **ongecommit** in
  de werkboom (3, 10 en 15 september). Redigeer accountnamen/hostnamen
  voordat ze in een publiek repo gaan, dan committen.

De opdrachtbrief zegt wat er ná fase 1 komt (bibliotheek als eigen begrip,
backend als eigen laag). Open vragen staan in `docs/architecture.md` §0 en
`docs/backlog.md`.

### 0.4 Windows-specifiek voor dit repo

- Repo op Windows staat onder `D:\Git\` (andere padnaam dan op de laptop;
  begin daar een verse Claude-sessie, de laptopsessie past niet).
- Node 21+ en Docker Desktop zoals in §2; `npm run db:up` start MariaDB
  **en** Postgres 17 (5434). Poorten vrijhouden.
- `.env` en `sites/musicbrain/.env.local` overzetten (staan niet in git);
  zie §2. Zolang Quickhost nog bestaat is de Plesk-env de bron van de
  live-waarden.
- Chat-export: de gedeelde kopie van het exportscript op Windows
  (`D:\Git\_VScode-scripts`) is de oude versie; zie het Bitemporal-
  handover-document, Deel 2 punt 8.

## 1. Waar vind je wat

| Vraag | Document |
|---|---|
| Wat kan een redacteur? | `docs/handleiding.md` (én live als Help-wiki, zie §5) |
| Hoe zit het technisch in elkaar? | `docs/architecture.md` (mermaid-diagrammen) |
| Wat is er af / wat komt er nog? | `docs/backlog.md` |
| Wat kwam er per versie bij? | `CHANGELOG.md` |
| Eisen (W*/S*-nummers) | `docs/website-requirements.md` |
| Installeren, deployen, servercommando's | `README.md` |
| Werkafspraken voor Claude/Copilot | `CLAUDE.md` |
| Ontwerpen die nog niet af zijn | `docs/design/*.md` (o.a. `wiki.md`) |

Stand bij het schrijven: versie **0.10.2**, alles gecommit en gepusht op
`main` (github.com/MarkWestbroek/imprint-engine).

## 2. De laptop opzetten

Nodig: Node 21+ (zelfde major als Plesk), Docker Desktop (voor de lokale
MariaDB), git.

```bash
git clone https://github.com/MarkWestbroek/imprint-engine.git
cd imprint-engine
npm ci                 # workspaces: root + packages/content-core + sites/musicbrain
```

**Secrets staan niet in git** — die moet je overzetten of opnieuw maken.
Kopieer `.env.example` naar twee plekken en vul ze:

- `/.env` (repo-root; voor drizzle-kit, seed, backup)
- `/sites/musicbrain/.env.local` (voor de Next-app)

Minimaal nodig: `DATABASE_URL` (lokaal de docker-compose-URL uit
`.env.example`) en een echte `SESSION_SECRET`. Optioneel:
`SEED_ADMIN_USER`/`SEED_ADMIN_PASSWORD` (eerste admin), en — alleen lokaal
— `PUBLISH_URL` + `PUBLISH_TOKEN` als je wiki's naar live wilt kunnen
publiceren (token = het `INGEST_TOKEN` van de live-omgeving, te vinden in
de Plesk-env of in de `.env.local` op de server).

```bash
npm run db:up          # MariaDB 10.11 in docker
npm run db:migrate     # schema
npm run db:seed        # basiscontent uit sites/musicbrain/content/ + eerste admin
npm run dev            # http://localhost:3000, admin op /admin
```

**Let op — de lokale database is niet de live database.** De seed vult
alleen wat als bestand in git staat. Content die alleen in een database
leeft (o.a. **alle wiki's**, dus de Help-wiki en Deepdive in Cortex) is er
op een verse machine dus níet. Opties: opnieuw aanmaken in de studio, of de
inhoud uit live halen via de lees-API (`https://musicbrain.nl/api/content/...`)
en er lokaal items van maken. Een echte "pull van live" bestaat nog niet.

De **editor** is een apart repo (`MarkWestbroek/MusicBrain`, map `editor/`)
— alleen nodig als je aan de editor zelf werkt. Deploy-doc daar:
`doc/editor-deploy.md`; huisstijl: `doc/styleguide.md`.

## 3. Wat er live draait (stand juli 2026 — sinds 1 september NIET meer, zie §0)

- **musicbrain.nl** — de Imprint-site (Next.js onder Passenger + MariaDB op
  Plesk), admin op `/admin`, Help-wiki op `/help`.
- **editor.musicbrain.nl** — de MusicBrain browser-editor/simulator
  (statische Vite-build uit het MusicBrain-repo).

Beide hebben een **GitHub-webhook**: pushen naar `main` = automatisch
deployen (pull → `npm ci`/`install` → build → herstart). Je hoeft dus niets
handmatig te deployen; alleen te wachten (3–10 min).

**Wat níet automatisch gaat: content.** De productie-database is de bron van
waarheid. Seed-bestanden uit git komen er alleen in als je ze draait:

```
cd imprint && export PATH=/opt/plesk/node/21/bin:$PATH && npm run db:seed -- --only=page,menu
```

via Plesk → Scheduled Tasks (type "Run a command", Notify: Every time).
**Volgorde telt:** seed vóór build, anders bakt de build de oude inhoud in
de statische pagina's. Kwam de build er toch eerder overheen: één
willekeurige **Save in de admin** leegt de cache alsnog.

## 4. Valkuilen die ons al een keer hebben gepakt

- **Niet dubbel bouwen.** Twee Turbopack-builds tegelijk (bijv. `npm run
  build` naast een draaiende `next dev`, of naast een webhook-deploy) eet
  het geheugen op en laat beide crashen. Valideer naast een dev-server met
  `npm run typecheck` + `npm run lint`; bouw alleen als de rest stil is.
  Na een crash: `.next` weggooien en opnieuw starten.
- **Nieuw contenttype = vijf plekken.** `ContentType` staat in losse
  allowlists (admin-action, list/edit/history-routes, INGESTABLE in de
  content-API). Vergeet je er één, dan krijg je pas bij het opslaan een
  cryptisch "Unknown content type". Staat als opruimpunt op de backlog.
- **`lang` doet mee in lookups.** `getItem` zoekt standaard op `en`; content
  die met `lang=nl` is aangemaakt is daarmee onvindbaar. De wiki-lookup is
  daarom taal-tolerant gemaakt; hou het in de gaten bij nieuwe queries.
- **Plesk past een docroot-wijziging traag toe** — een 403 met "No matching
  DirectoryIndex" betekent meestal "config nog niet herbouwd", niet
  "bestanden fout".
- **`npm ci` faalt op de server** als de lockfile net iets anders oplost dan
  de server-npm verwacht; voor de editor gebruiken we daarom `npm install`.
- **Hydration-waarschuwing over `data-theme`** in de dev-overlay is bekend en
  onschuldig: het thema-script zet het attribuut vóór de eerste paint.

## 5. Waar we gebleven zijn

Drie grote dingen zijn recent afgerond:

1. **"Open brain"-huisstijl** — Amber is het default-thema (het palet van het
   oorspronkelijke ontwerp-artifact), met dot-grid-textuur, mono-eyebrows,
   patch-brain-logo en de verhalende copy. Thema's zijn content: kleuren en
   fonts bewerk je in de admin.
2. **Editor live** op editor.musicbrain.nl, in dezelfde huisstijl (licht
   werkinstrument, amber accenten), met `/editor` als landingspagina.
3. **Wiki + autorisatie** — drie contenttypen (wiki/folder/page), een
   publieke route met navigatieboom, een studio met slepen, inline
   hernoemen en cascade-delete, en een publiceer-knop (lokaal → live). De
   redacteurshandleiding is er het eerste gedogfood van: hij leeft als
   Help-wiki op `/help`. Autorisatie loopt door één centraal **PEP**
   (`lib/authorize.ts`) met een inplugbaar `PolicyDecisionPoint` — het
   AuthZEN-snijvlak, zodat later policies-als-content of een ODRL-taal kan
   inpluggen. Ontwerp: `docs/design/wiki.md`.

Ook recent (andere sessie): default views per contenttype echt bewerkbaar
gemaakt met subject-widgets, en een themaswitcher in de studio.

## 6. Wat er klaarligt

Kleine acties (geen code):

- **Explore opruimen op live**: `db:seed -- --only=menu` + `/explore` één
  keer deleten in de live admin. Het seed-bestand is al geparkeerd.
- **Help members-only?** `/help` staat nu op `public`; één veld in de
  wiki-studio maakt hem alleen zichtbaar voor ingelogde gebruikers.
- **Reflex- en Relay-specs** vertellen nog het oude MIDI-verhaal, terwijl
  hun kaartteksten de nieuwe positionering hebben. Redactiewerk.

Code-eindjes staan in `docs/backlog.md`; de scherpste zijn: publiceren
spiegelt niet (verwijderingen reizen niet mee), een wiki verwijderen kan
nog nergens, de typelijsten consolideren, en kiezen welke bron van de
handleiding leidend is (md-bestand of Help-wiki).

## 7. Werkafspraken

Staan in `CLAUDE.md` en gelden onverkort. De belangrijkste in één adem:
alles via de `ContentStore` (nooit kale SQL), schema's in
`packages/content-core/src/schemas.ts`, admin-formulieren komen uit die
schema's, geen losse hexkleuren (design-tokens in `globals.css`), en bij
elke wijziging: handleiding + architecture + een regel onder
`## [Unreleased]` in de changelog. Releasen gaat met
`npm run release -- <versie>`.

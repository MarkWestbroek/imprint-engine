# Overdracht — verder werken op een andere machine

Geschreven juli 2026, bij de overstap desktop → laptop. Bedoeld als
startpunt voor een nieuwe chatsessie: waar staat het project, hoe krijg je
het draaiend, en waar liggen de valkuilen. De inhoudelijke docs blijven
leidend — dit is de kaart, niet het gebied.

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

## 3. Wat er live draait

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

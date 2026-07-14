# Imprint

Eén publicatie-motor, meerdere merk-sites — zoals een uitgeverij meerdere
*imprints* voert: elk met een eigen gezicht, allemaal op dezelfde machinerie.
Geen klassiek CMS dus. Eerste imprint: **MusicBrain** (werknaam).
Requirements: zie [docs/website-requirements.md](docs/website-requirements.md).

## Opzet

npm-workspaces-monorepo, gefaseerd volgens §C van het requirements-doc:

- **v0:** statische site, content als bestanden in git. Werkt nog steeds:
  zonder `DATABASE_URL` valt de site terug op de file-store.
- **v1 (nu):** MariaDB met **bitemporal-light**-tabellen (§B3:
  `valid_from/valid_to/tx_from/tx_to` — elke wijziging is een nieuwe rij,
  historie en terugrollen gratis) + admin-UI met widget-composer op
  `/admin`. Alleen de `ContentStore`-implementatie wisselde; de pagina's
  bleven ongewijzigd. Doel-hosting: Plesk (Node.js-app + MariaDB).

```
packages/
  content-core/        Zod-schemas + ContentStore-interface + widget-model
                       (PageLayout, WidgetTypeRegistry) + twee stores:
                       file-store (v0, git) en db-store (v1, bitemporal-light)
sites/
  musicbrain/          Next.js 16-site (App Router, Tailwind v4, dark)
    content/           v0-content (files) — ook de seed-bron voor de DB
    src/widgets/       De widget-catalogus van deze site:
                       registry.ts (configschema's) + components.tsx
    src/app/admin/     Admin-UI: login, lijsten, formulieren uit zod-schema's,
                       widget-composer, versiehistorie met restore
drizzle/               Gegenereerde SQL-migraties (in git; nooit handmatig)
scripts/seed.ts        Contentbestanden + eerste admin-user → database
docs/
  website-requirements.md
```

## Lokaal draaien (from scratch)

Onderstaande volgorde brengt de v1-opzet (MariaDB + admin) van niets naar een
draaiende site met content en een admin-login. Duurt een paar minuten.

**Vereisten**

- **Node ≥ 20** (`node -v`).
- **Docker Desktop** geïnstalleerd én *draaiend* — de lokale database is een
  container. Check: `docker info` mag geen fout geven. Geen Docker? Dan kan de
  site nog steeds in v0-modus draaien (zie onderaan), maar zonder admin.

**Stappen**

```bash
# 1. Dependencies (eenmalig, vanuit de repo-root)
npm install

# 2. Env-bestanden. Er zijn er twee: de root-.env voor de db-tooling
#    (drizzle-kit, seed) en .env.local voor de Next.js-app zelf.
cp .env.example .env
cp .env.example sites/musicbrain/.env.local
```

Open daarna beide bestanden en vul in (in *allebei* hetzelfde):

- `DATABASE_URL` — de default matcht al met docker-compose, lokaal
  onveranderd laten.
- `SESSION_SECRET` — genereer er een:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SEED_ADMIN_PASSWORD` — **verplicht als je wilt inloggen.** Blijft dit leeg,
  dan maakt de seed géén admin-user aan (`user ! ...` in de output) en kun je
  niet in `/admin`. `SEED_ADMIN_USER` is de bijbehorende naam (default `mark`).

```bash
# 3. Database-container starten (= docker compose up -d --wait, MariaDB 10.11).
#    Dankzij de healthcheck blokkeert dit tot MariaDB écht klaar is (~7s),
#    zodat de volgende stap er nooit te vroeg op loopt.
npm run db:up

# 4. Tabellen aanmaken. Er is géén los SQL-script: dit past de gecommitte
#    migratie in drizzle/ toe (schema komt uit db-schema.ts).
npm run db:migrate

# 5. Content (uit sites/musicbrain/content/) + de admin-user importeren.
npm run db:seed

# 6. Dev-server. → http://localhost:3000 en http://localhost:3000/admin
npm run dev
```

Log in op `/admin` met `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD`. Elke save is
een *nieuwe versie* (transaction time); niets wordt overschreven — "History"
bij elk item toont alles en kan terugrollen. "Validity" plant publicatie (valid
time, S6).

**Zonder Docker/DB (v0-modus):** laat `DATABASE_URL` leeg (of sla stap 2–5
over) en draai alleen `npm install && npm run dev`. De site valt dan terug op
de file-store: content uit `sites/musicbrain/content/`, geen admin.

## Commando's (referentie)

```bash
npm run dev        # dev-server musicbrain (http://localhost:3000)
npm run build      # productie-build
npm run lint
npm run typecheck

npm run db:up      # lokale MariaDB 10.11 (docker compose), zelfde major als Plesk
npm run db:generate  # schema gewijzigd? → nieuwe SQL-migratie in drizzle/
npm run db:migrate   # migraties toepassen op de DB uit DATABASE_URL
npm run db:seed      # contentbestanden + admin-user importeren (idempotent)
```

Handig: `docker compose down` stopt de db-container, `docker compose down -v`
gooit óók het datavolume weg (schone lei — daarna weer migrate + seed).

**Schema-sync dev → Plesk:** migraties staan in git (`drizzle/`); op de
server is bijwerken `git pull` + `npm run db:migrate`. Content wordt niet
gesynct: de productie-DB is de bron van waarheid, de seed is eenmalig.

## Content-API

Dezelfde `ContentStore` als de pagina's, maar dan als JSON over HTTP —
voor externe consumenten (andere sites, scripts, product-projecten).

**Lezen (GET, publiek, alleen gepubliceerde content):**
```
GET /api/content                    index van endpoints
GET /api/content/site               site-config
GET /api/content/products[/slug]    producten
GET /api/content/components[/slug]  componenten (herbruikbaar, kunnen nesten)
GET /api/content/board-specs[/slug] bord-documentatie (?component=…)
GET /api/content/releases           releases (?project=… of ?product=…)
GET /api/content/itinerary/<prod>   afgeleide component-itinerary van een product
GET /api/content/pages[/slug]       pagina's incl. widget-layout (?prefix=posts/)
GET /api/content/menus/<naam>       menu
```
Overal bruikbaar: `?lang=nl` (fallback EN), `?asOf=2026-01-01` (tijdreizen,
S5) en `?drafts=1` (alleen met admin-sessie).

**Schrijven (POST, voor product-projecten):** stuur
`Authorization: Bearer <INGEST_TOKEN>` (zie `.env.example`). De write-API staat
**standaard uit**: zolang `INGEST_TOKEN` leeg is, wordt elke POST geweigerd. Zet
het token in de omgeving van de dráaiende app (`.env.local` of Plesk-env) én
herstart de app (Passenger leest env alleen bij opstarten). Board-assets landen
onder `ASSET_ROOT` — op Plesk een map **buiten** de app-map, anders overleeft
een upload de volgende deploy niet. De how-to voor consumers staat in
[docs/mmb-ingest-guide.md](docs/mmb-ingest-guide.md).
```
POST /api/content/<type>/<slug>   één item (body = de content)
POST /api/content                 bundle: { product?, components?, releases? }
POST /api/ingest/board-spec       multipart: doc (JSON) + de asset-bestanden
```
Ingestbare types: `product`, `component`, `board-spec`, `release`, `page`.
Elke post loopt door de zod-validatie en wordt een nieuwe bitemporale versie
(dus volledige historie + rollback, ook voor machine-posts). Voorbeeld: een
hardware-repo post in één keer zijn product, zijn (geneste) componenten en een
release met per component de meegeleverde versie.

**Assets** (bord-renders, pinout-SVG's) gaan via de multipart-ingest: de
`doc`-JSON verwijst naar bestandsnamen, de backend slaat elk bestand op via de
**AssetStore** en herschrijft de namen naar URL's. De AssetStore **content-hasht**
de bestandsnaam (`render-top.<sha8>.png`), dus her-publiceren met nieuwe bytes
geeft een nieuwe URL — de lange `immutable`-cache blijft daardoor correct én
vers. De file-backend schrijft naar `ASSET_ROOT` en serveert via
`/api/assets/...`; MinIO/S3 later is een config-wissel (`.env`), geen
herschrijving.

## Deploy naar Plesk (musicbrain.nl)

Model: **dezelfde repo als lokaal**, maar de app draait onder Passenger
(Plesk Node.js-extensie) tegen een MariaDB op de server. De secrets komen uit
`.env`-bestanden die je **éénmalig op de server** zet — die zijn git-ignored en
blijven dus staan bij elke `git pull`, precies zoals lokaal.

Passenger kan geen npm-scripts starten; het start één JS-bestand
(`sites/musicbrain/server.js`), dat een gebouwde `.next` nodig heeft. De build
gebeurt daarom op de server, als deployment-action na de git-pull.

**Eenmalig instellen** (volgorde is belangrijk — DB en env moeten er zijn
vóór de eerste migrate):

1. **Database** — Plesk → *Databases* → MariaDB-database + gebruiker aanmaken.
   Noteer db-naam, gebruiker en wachtwoord.
2. **Env-bestanden op de server** (Plesk File Manager of SSH), buiten git —
   maak in de deploy-map zowel `/.env` (root, voor migrate/seed) als
   `sites/musicbrain/.env.local` (voor de app), met:
   - `DATABASE_URL=mysql://<db-user>:<pass>@localhost:3306/<db-naam>`
   - een verse `SESSION_SECRET`
     (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - optioneel `INGEST_TOKEN` (write-API) en `ASSET_ROOT` (map **búiten** de
     app, zodat uploads een redeploy overleven).
3. **Git** — Plesk → *Git* → koppel déze repo, branch `main`, in een map
   (bijv. `imprint/`). Zet als *additional deployment action* (draait na de
   pull, vanuit de repo-root):
   ```
   export PATH="/opt/plesk/node/21/bin:$PATH" && \
     npm ci --include=dev && npm run db:migrate && npm run build && \
     mkdir -p sites/musicbrain/tmp && touch sites/musicbrain/tmp/restart.txt
   ```
   **Volgorde is essentieel:** `db:migrate` moet vóór `build` — de publieke
   pagina's zijn SSG en `next build` bevraagt tijdens de build de database
   (`generateStaticParams`). Bestaan de tabellen nog niet, dan faalt de build
   met `Table '…content_items' doesn't exist`.
   De `export PATH=...` is nodig omdat de deploy-shell `npm` niet op PATH heeft
   (je krijgt anders `nodenv: npm: command not found` of `npm: command not
   found`). Plesk zet z'n Node-binaries in `/opt/plesk/node/<major>/bin/` —
   gebruik dezelfde major als in het Node.js-paneel (hier `21`).
   `npm ci` draait in de repo-root (npm-workspaces hoisten `node_modules`
   daarheen). `--include=dev` is nodig omdat `next build` én
   `db:migrate`/`db:seed` de devDependencies gebruiken (typescript/tailwind
   resp. drizzle-kit/tsx); zonder die vlag slaat een `production`-omgeving ze
   over en faalt de build.
   **Eerste deploy:** voeg éénmalig `&& npm run db:seed` ná `db:migrate` toe
   (vóór `build`), zodat de build met echte content prerendert; haal het er
   daarna weer af (anders voegt elke deploy een nieuwe content-versie toe).
4. **Node.js-extensie** — Plesk → *Node.js*: Application root =
   `imprint/sites/musicbrain`, startup file = `server.js`, Node ≥ 20,
   mode `production`. **Document Root** moet ónder de Application Root liggen,
   dus zet 'm op `imprint/sites/musicbrain/public` (niet `httpdocs` — anders:
   "document root is not a subchild of application root").
   (Env-vars mag je hier óók zetten i.p.v. `.env.local` — kies één plek.)
   Deploy de git-repo naar een eigen map (`imprint/`), **niet** in `httpdocs`;
   de Node-app zit in de submap. Gebruik **niet** Plesk's per-app *"NPM
   install"*-knop: dat installeert alleen in de submap, terwijl de workspaces
   hun `node_modules` in de repo-root hoisten — de `npm ci` uit de
   deployment-action (stap 3) doet dat correct.
5. **Seed** (eenmalig) — startcontent + admin-user (heeft
   `SEED_ADMIN_PASSWORD` nodig):
   - **met SSH:** `npm run db:seed` vanuit de repo-root.
   - **zonder SSH:** Plesk → *Scheduled Tasks* → een eenmalige taak
     `cd <repo-root> && npm run db:seed` (of plak `&& npm run db:seed` één keer
     aan de deployment-action en haal het er daarna weer af).

**Volgende deploys:** `git push` → Plesk pullt, bouwt, migreert, herstart
(de nieuwe `restart.txt` triggert Passenger). Content blijft in de DB; de seed
is eenmalig, de productie-DB is de bron van waarheid.

**Als de site de Passenger-foutpagina toont** ("We're sorry, but something went
wrong") — kijk in Plesk → *Logs* (of het Passenger-log) en check op volgorde:
- **Build ontbreekt** (`.next` niet gebouwd) of verkeerde startup-file → is de
  deployment-action gedraaid en geslaagd? Staat `server.js` als startup file?
- **DB-connectie faalt** → is `DATABASE_URL` zichtbaar voor de app
  (`.env.local` of Node-env) en kloppen de creds?
- **`next build` valt om (out of memory)** → shared hosting heeft soms te
  weinig geheugen voor een Next-build. Dan is `output: "standalone"` in
  `next.config.ts` + lokaal/CI bouwen het alternatief (lichter voor Passenger).

## Content bewerken (v0)

Alles onder `sites/musicbrain/content/`; zod valideert bij de build, dus een
kapot bestand breekt de build in plaats van stil verkeerde output te geven.

- **Product:** `content/products/<slug>.json` — naam, tagline, status
  (`in-development | beta | available | discontinued`), specs als lijst.
- **Release:** `content/releases/<naam>.json` — later automatisch gevuld
  via GitHub-webhook (S7).
- **Pagina/post:** `content/pages/**/*.md` — frontmatter + markdown.
  `draft: true` verbergt; `publishedAt` in de toekomst = nog niet zichtbaar
  (file-versie van S5/S6).
- **Widget-pagina:** `content/pages/<slug>.json` — meta + `layout`
  (`template` + `widgets[]`). Elke widget is `{ type, region, config }`;
  de config wordt gevalideerd tegen het schema dat de site voor dat type
  registreert. Zie `pages/explore.json` voor een voorbeeld (treeview links,
  API-content in het midden).
- **Menu:** `content/menus/<naam>.json` — nestbare items die naar een
  pagina (`page: <slug>`) of URL wijzen; `main` stuurt de header-nav.
- **Vertaling (S9):** zelfde bestand met `lang: nl` ernaast; EN is fallback.

## Widgets (vrije bouwblokken)

Pagina's kunnen worden *gecomponeerd* uit widgets op een layout-template
(`single`, `sidebar-left`, `sidebar-right`, `three-column`). De motor kent
geen concrete widgets; elke site declareert zijn eigen catalogus:

1. configschema toevoegen in `src/widgets/registry.ts` (zod),
2. component toevoegen in `src/widgets/components.tsx` (server component,
   mag de `ContentStore` gebruiken of externe API's fetchen).

Meegeleverd in musicbrain: `text` (markdown), `treeview` (handmatige boom
en/of automatisch uit pagina-slugs), `api` (JSON-endpoint → lijst met
veldselectie), `releases`, `products`.

## Nog te doen

- [ ] CI (GitHub Actions: build + lint bij PR)
- [ ] Deploy naar Plesk: Node.js-extensie aanzetten, MariaDB aanmaken,
      `DATABASE_URL`/`SESSION_SECRET` zetten, migrate + seed draaien
- [ ] Nieuwsbrief-signup met double opt-in (W1) — heeft backend/dienst nodig
- [ ] GitHub-webhook → releases (S7)
- [ ] Users-beheer in de admin (nu alleen via seed); rollen afdwingen per item
      (ContentUser) zit in het schema maar wordt nog niet gehandhaafd
- [ ] Placeholder-content (productteksten, links, domein) vervangen
- [ ] Later: DB-store migreren naar het echte bitemporal register (§B3)

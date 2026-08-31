# Imprint

**Imprint is een publicatieplatform voor meerdere zelfstandige merk- en
productsites.** Zoals een uitgever verschillende imprints heeft, kan één
Imprint-installatie meerdere sites aandrijven: elk met een eigen naam,
vormgeving, navigatie en inhoud, maar met dezelfde betrouwbare motor eronder.

De eerste site die op Imprint draait is [MusicBrain](https://musicbrain.nl),
een productsite voor een modulair muziekinstrument. Imprint is nog volop in
ontwikkeling en is op dit moment vooral het platform achter deze site, geen
kant-en-klaar SaaS-product.

## Wat kun je ermee?

Met Imprint kan een klein team zonder code te wijzigen:

- pagina's samenstellen uit rijen, vakken en herbruikbare widgets;
- producten, componenten, releases, downloads en technische documentatie
  publiceren;
- wiki's, menu's, thema's en planning-borden beheren;
- publicatie vooruit plannen en de site bekijken zoals die vroeger was of in
  de toekomst zal zijn;
- elke wijziging als een nieuwe versie bewaren, vergelijken en terugzetten;
- content via een API laten aanleveren door andere projecten.

Pagina's worden in een visuele studio bewerkt, in de echte vormgeving van de
site. De onderliggende contentregels genereren de beheerformulieren en bewaken
verwijzingen tussen bijvoorbeeld producten, componenten en releases. Zo kan
een imprint zijn eigen inhoud en uitstraling hebben zonder een eigen CMS te
hoeven bouwen.

## Een voorbeeld

MusicBrain gebruikt Imprint voor meer dan losse webpagina's. Producten bestaan
uit herbruikbare hardware- en softwarecomponenten; releases leggen vast welke
versie van elk component is meegeleverd. Een hardwaretool kan automatisch
borddocumentatie, afbeeldingen en 3D-modellen publiceren. Redacteuren kunnen
diezelfde informatie vervolgens gebruiken in productpagina's, wiki's en
samengestelde pagina's.

Bekijk de [live site](https://musicbrain.nl) om het publieke resultaat te zien.
De beheeromgeving staat achter een login en is beschreven in de
[handleiding voor redacteuren](docs/handleiding.md).

## Waar begin je?

| Je wilt... | Begin hier |
|---|---|
| begrijpen wat redacteuren kunnen | [Handleiding voor redacteuren](docs/handleiding.md) |
| het project lokaal bekijken of eraan ontwikkelen | [Lokaal draaien](#lokaal-draaien-from-scratch) |
| begrijpen hoe Imprint technisch werkt | [Architectuur](docs/architecture.md) |
| alle documentatie per onderwerp vinden | [Documentatieoverzicht](docs/README.md) |
| zien wat af is en wat nog openstaat | [Changelog](CHANGELOG.md) en [backlog](docs/backlog.md) |
| de oorspronkelijke doelen en eisen lezen | [Website-requirements](docs/website-requirements.md) |

## Hoe zit de repository in elkaar?

Imprint is een npm-workspaces-monorepo. De gedeelde publicatiemotor staat in
`packages/content-core`; iedere site staat apart onder `sites`. De eerste
imprint, MusicBrain, is een Next.js-site met een publieke website en een
beheeromgeving op `/admin`.

```text
packages/content-core/  contentmodel, validatie, historie en opslag
sites/musicbrain/       publieke MusicBrain-site en beheeromgeving
drizzle/                database-migraties
docs/                   functionele en technische documentatie
```

Content kan uit MariaDB komen of, zonder database, rechtstreeks uit bestanden
in de repository. Publieke pagina's spreken altijd dezelfde `ContentStore`
aan. Daardoor kan de opslag veranderen zonder dat iedere sitepagina moet
worden herschreven. De technische uitwerking staat in de
[architectuurdocumentatie](docs/architecture.md).

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
  Beide zijn **alleen** voor `db:seed`; de draaiende app leest ze niet. Na de
  eerste seed mag je ze weer weghalen (de user staat dan in de DB) — je hebt ze
  alleen weer nodig om een verse/lege database te seeden. `DATABASE_URL` (met
  het echte DB-wachtwoord) en `SESSION_SECRET` blíjven wél nodig.

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
time, S6). Verdere gebruikers beheer je daarna onder **/admin → Users**;
wachtwoord kwijt? Zie [Wachtwoord kwijt](#wachtwoord-kwijt).

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

npm run user -- list                     # gebruikers + rollen
npm run user -- add <naam> [rol] [ww]    # toevoegen (rol default editor)
npm run user -- passwd <naam> [ww]       # wachtwoord zetten
npm run user -- role <naam> <rol>        # admin | editor | reader
npm run user -- delete <naam>            # verwijderen
```

Laat `[ww]` weg en er wordt er één gegenereerd en één keer getoond — dan komt
je wachtwoord niet in je shell-historie terecht. Dagelijks beheer gaat
makkelijker via **/admin → Users**; de CLI is er vooral voor als dat niet
meer kan (zie hieronder).

### Wachtwoord kwijt

Er is geen "wachtwoord vergeten"-mail: de site heeft geen mail-infra, en die
route zou een publiek reset-endpoint toevoegen voor een handvol gebruikers.
De weg terug loopt daarom over de server, waar `DATABASE_URL` al staat:

```bash
npm run user -- passwd <naam>     # print een nieuw wachtwoord; op Plesk via SSH
```

Daarna inloggen op `/admin` en bij **Users → Change my password** zelf iets
kiezen. De laatste admin kan zichzelf niet degraderen of verwijderen, dus het
scherm kan je er niet uit sluiten.

**Alle sessies direct verlopen** (bijv. een account is gecompromitteerd): een
sessiecookie is stateless en blijft na een reset nog tot 12u geldig. Vervang
`SESSION_SECRET` in `sites/musicbrain/.env.local` (op Plesk: de env-vars van
de Node.js-app) en herstart — elk bestaand cookie valideert dan niet meer, dus
iedereen moet opnieuw inloggen. Genereer er een met
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

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

**Servercommando's zonder SSH — het Scheduled-Task-patroon** (in de praktijk
bewezen bij de 0.9.0-update): elk npm-commando uit deze README is op de server
te draaien als taak van het type *Run a command*, met Notify **Every time**
(anders zie je de uitvoer niet) en de knop **Run Now**:

```
cd imprint && export PATH="/opt/plesk/node/21/bin:$PATH" && npm run db:seed -- --only=themes
```

De `cd imprint` (het deployment-pad, relatief vanaf home) én de
`export PATH=...` zijn allebei verplicht: een scheduled task start in je
home-directory en heeft npm niet op het pad. Zet de taak daarna op inactief
(of verwijder hem) — als "Yearly" blijven staan betekent één overbodige
(onschuldige) run per jaar. Zelfde patroon werkt voor `npm run user -- passwd
<naam>` (wachtwoord-reset) en `npm run db:migrate`.

**Volgende deploys:** `git push` → Plesk pullt, bouwt, migreert, herstart
(de nieuwe `restart.txt` triggert Passenger). Content blijft in de DB; de seed
is eenmalig, de productie-DB is de bron van waarheid. Controleer daarna met
`npm run smoke -- https://<domein>` (read-only checks: home, admin, API).

Dat automatische pullen hangt aan een **webhook**: kopieer de *Webhook URL*
uit Plesk (Git-repo-instellingen, `…/modules/git/public/web-hook.php?uuid=…`)
naar GitHub → repo → *Settings* → *Webhooks* (push events, content type json).
Zónder die webhook doet "Automatic" niets uit zichzelf en moet je in Plesk op
**Pull now** klikken — de map `…/imprint` is géén git-checkout (Plesk pullt
naar een eigen repo-kopie en kopieert de bestanden), dus `git pull` in die map
werkt niet.

> **Niet dubbel bouwen.** Nu de webhook actief is, start elke push al een
> deploy (npm ci + build). Draai er dus **geen** handmatige build-taak
> doorheen: twee gelijktijdige `next build`-runs vreten het geheugen op en
> geven een Turbopack-`FATAL`-panic. De `&&`-keten stopt dan vóór de
> `restart.txt`-touch, dus de vorige goede build blijft draaien (de site
> blijft heel) — maar de rebuild is mislukt. Wachten tot de deploy klaar is
> en dan pas eventueel opnieuw.

**Nieuwe seed-content na een update** (bijv. de thema's van 0.9.0): seed
gericht bij met `npm run db:seed -- --only=themes` — dat raakt alleen dat
type en laat je bewerkte productie-content met rust. **Volgorde telt:** seed
vóór de build, want de publieke pagina's zijn prerendered en `db:seed`
schrijft rechtstreeks in de DB zónder de Next-cache te legen. Kwam de build
er toch eerder (zoals bij een push-deploy): draai de deployment-action
nogmaals, óf doe een willekeurige **Save in de admin** (die revalideert de
cache) — dan verschijnt de nieuwe content pas.

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

## Op een andere machine verder werken

**[docs/overdracht.md](docs/overdracht.md)** is het startpunt: laptop
opzetten (incl. de secrets die niet in git staan), wat er live draait, de
valkuilen die ons al een keer pakten, en waar we gebleven zijn.

## Nog te doen

De volledige lijst met open punten staat in **[docs/backlog.md](docs/backlog.md)**
(widgets, studio/admin, contentmodel, deploy, open requirements en de
beslissingen die nog gemaakt moeten worden). De eerstvolgende dingen:

- [x] ~~Deploy naar Plesk~~ — live op https://musicbrain.nl sinds juli 2026
- [ ] CI (GitHub Actions: build + lint + typecheck per PR)
- [ ] Placeholder-content (productteksten, links, domein) vervangen

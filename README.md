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

## Commando's

```bash
npm install        # eenmalig, vanuit de repo-root
npm run dev        # dev-server musicbrain (http://localhost:3000)
npm run build      # productie-build
npm run lint
npm run typecheck

npm run db:up      # lokale MariaDB 10.11 (docker compose), zelfde major als Plesk
npm run db:generate  # schema gewijzigd? → nieuwe SQL-migratie in drizzle/
npm run db:migrate   # migraties toepassen op de DB uit DATABASE_URL
npm run db:seed      # contentbestanden + admin-user importeren (idempotent)
```

## Database & admin (v1)

1. Kopieer `.env.example` naar `.env` (root, voor de tooling) én naar
   `sites/musicbrain/.env.local` (voor de app); vul `DATABASE_URL`,
   `SESSION_SECRET` en `SEED_ADMIN_*`.
2. `npm run db:up && npm run db:migrate && npm run db:seed`
3. `npm run dev` → **http://localhost:3000/admin** en log in.

Elke save is een *nieuwe versie* (transaction time); niets wordt
overschreven — "History" bij elk item toont alles en kan terugrollen.
"Validity" op een item plant publicatie (valid time, S6). Zonder
`DATABASE_URL` draait de site in v0-modus op de files in git.

**Schema-sync dev → Plesk:** migraties staan in git (`drizzle/`); op de
server is bijwerken `git pull` + `npm run db:migrate`. Content wordt niet
gesynct: de productie-DB is de bron van waarheid, de seed is eenmalig.

## Content-API (read-only)

Dezelfde `ContentStore` als de pagina's, maar dan als JSON over HTTP —
voor externe consumenten (andere sites, scripts, tools):

```
GET /api/content                  index van endpoints
GET /api/content/site             site-config
GET /api/content/products[/slug]  producten
GET /api/content/releases         releases (?project=…)
GET /api/content/pages[/slug]     pagina's incl. widget-layout (?prefix=posts/)
GET /api/content/menus/main       menu
```

Overal bruikbaar: `?lang=nl` (fallback EN), `?asOf=2026-01-01` (tijdreizen,
S5) en `?drafts=1` (alleen met admin-sessie). Alleen gepubliceerde content —
precies wat de site zelf toont.

## Deploy naar Plesk

De **hele repo** kan naar de server (Plesk Git-extensie of eigen sync);
de app wijst gewoon naar de submap:

1. **Git:** koppel de repo aan een map op de server (bijv. `imprint/`);
   zet als "additional deployment action" (script na de pull):
   `npm ci && npm run build && npm run db:migrate && touch sites/musicbrain/tmp/restart.txt`
2. **Node.js-extensie:** Application root = `imprint/sites/musicbrain`,
   startup file = `server.js` (Passenger start geen npm-scripts, wél dit
   bestand), Node ≥ 20. Zet `DATABASE_URL` en `SESSION_SECRET` als
   environment-variabelen in de Node.js-instellingen (dan is er geen
   `.env.local` op de server nodig).
3. **Eenmalig:** database aanmaken in Plesk (zie `.env.example` voor de
   URL-vorm) en `npm run db:seed` draaien voor de startcontent + admin-user.

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

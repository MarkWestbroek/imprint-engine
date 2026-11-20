# paratmos.nl

De zakelijke site van Paratmos: modelgedreven werken, data-architectuur,
training. Vervangt de WordPress-site zodra de teksten af zijn; tot die tijd
staat hij op `noindex` (`src/app/layout.tsx`).

- **Pagina's en menu** komen uit de contentstore (`content/pages`,
  `content/menus/main.json`); de startpagina is de pagina `home`.
- **Blog** (`/blog`), **kennisbank** (de wiki `kennisbank`, `/kennisbank/…`)
  en **begrippenlijst** (`/terms/<slug>`, overzicht op de pagina `begrippen`)
  zijn plugins. Hun inhoud staat alleen in de database: zonder `DATABASE_URL`
  zijn ze leeg. De beginteksten staan in `content/items/<type>/`.
- **Eigen widgets** (`src/components/`, stijlen in `globals.css`):
  `doorbraak` (de opening van de voorpagina: het beeld uit het logo, groot;
  `.db-*`), `drie-eenheid` (gegevens, processen en regels als driehoek, met
  eromheen wat die basis omgeeft; `.de-*`), `afleiding` (één model en wat
  eruit volgt; `.afl-*`) en `contact` (het contactformulier, mailt naar
  `CONTACT_TO`).
- **Huisstijl**: de merkrichtlijnen van Paratmos (versie 1.0, juni 2026):
  inkt en blauw, Montserrat voor koppen, de logo's in `public/brand`; tokens
  in `src/app/globals.css`.

De teksten in `content/` zijn concepten op basis van Marks cv en de oude site.
Na de eerste keer laden bewerk je ze in de admin; `put:content` slaat alles
over wat daar is aangepast.

Lokaal, zonder database (alleen de pagina's):

```bash
npm run dev:paratmos           # http://localhost:3900
```

Met een eigen database (eenmalig aanmaken in de lokale Postgres):

```bash
docker exec -it imprint-engine-pg-1 psql -U imprint -c "CREATE DATABASE paratmos"
export DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/paratmos
npm run db:migrate:pg
npm run db:seed -- --site=paratmos --only=site,menu --lang=nl
npm run put:content --workspace=paratmos     # pagina's, kennisbank, begrippen, blog
npm run user -- add <naam> admin
```

Zet daarna dezelfde `DATABASE_URL` en een `SESSION_SECRET` in
`sites/paratmos/.env.local` (voorbeeld: `.env.example`).

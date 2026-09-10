# Productsite van Imprint

Dit is de tweede site in de monorepo: de publieke website voor Imprint zelf.
De eerste versie onderzoekt positionering, huisstijl en drie logorichtingen.
De publieke routes zijn statisch en de siteconfig loopt via `ContentStore`.
Lokaal gebruikt de site een eigen **Postgres**-database via zijn eigen
`DATABASE_URL` (`postgres://…`, de tweede backend achter `ContentStore`);
zonder die variabele valt hij terug op `content/`. Hij deelt nadrukkelijk
niet de contentdatabase van MusicBrain (die op MariaDB blijft). De overige
pagina-inhoud staat in deze eerste versie nog in code en er is nog geen admin.

Eigen database lokaal inrichten (`npm run db:up` start de Postgres-container
op poort 5433 en maakt de database `imprint` aan):

```bash
npm run db:up
npm run db:migrate:pg
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5433/imprint \
	npm run db:seed -- --site=imprint --only=site
```

Zet dezelfde URL in `sites/imprint/.env.local` (zie `.env.example`).

Start vanuit de repository-root:

```bash
npm run dev:imprint
```

MusicBrain blijft op poort 3000; dit commando start de Imprint-site vast op
poort 3100. De productsite afzonderlijk controleren:

```bash
npm run lint --workspace=@imprint/site
npm run typecheck --workspace=@imprint/site
npm run build --workspace=@imprint/site
```

De drie exporteerbare logo's staan onder `public/brand`. Rationale, kleuren en
het voorkeursadvies staan in [het merkdocument](../../docs/design/brand.md).

Belangrijkste bestanden:

- `src/app/page.tsx` - inhoud en paginastructuur;
- `src/app/globals.css` - huisstijl en responsieve presentatie;
- `src/components/brand-mark.tsx` - de drie logo's als React-componenten;
- `public/brand/` - zelfstandige SVG-assets.

# Productsite van Imprint

Dit is de tweede site in de monorepo: de publieke website voor Imprint zelf.
De eerste versie onderzoekt positionering, huisstijl en drie logorichtingen.
De publieke routes zijn statisch en de siteconfig loopt via `ContentStore`.
Lokaal gebruikt de site een eigen MariaDB-database via zijn eigen
`DATABASE_URL`; zonder die variabele valt hij terug op `content/`. Hij deelt
nadrukkelijk niet de contentdatabase van MusicBrain. De overige pagina-inhoud
staat in deze eerste versie nog in code en er is nog geen admin.

Eigen database lokaal inrichten:

```bash
docker compose exec -T db mariadb -uroot -pimprint-root -e \
	"CREATE DATABASE IF NOT EXISTS imprint; GRANT ALL ON imprint.* TO 'imprint'@'%';"
DATABASE_URL=mysql://imprint:imprint-dev@localhost:3306/imprint npm run db:migrate
DATABASE_URL=mysql://imprint:imprint-dev@localhost:3306/imprint \
	npm run db:seed -- --site=imprint --only=site
```

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

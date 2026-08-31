# Productsite van Imprint

Dit is de tweede site in de monorepo: de publieke website voor Imprint zelf.
De eerste versie onderzoekt positionering, huisstijl en drie logorichtingen.
Hij is bewust statisch en gebruikt nog geen `ContentStore`, admin of database.
Een toekomstige volledige instantie krijgt een eigen `DATABASE_URL` en eigen
MariaDB-database; hij deelt nadrukkelijk niet de contentdatabase van MusicBrain.

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

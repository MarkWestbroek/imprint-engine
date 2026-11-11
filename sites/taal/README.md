# Taaltraining

Een Poolse site die het lespakket Nederlands aanbiedt (ontwerp:
`docs/design/taaltraining/README.md`). Tijdelijk adres:
taal.imprint-engine.nl.

Het adres is `/<ui>/<pakket>/<les>`: eerst de taal van de site (`pl`, `nl`),
dan het pakket (de taal die je leert, `nederlands`), dan de les.
`/` stuurt door naar `/pl/nederlands`.

De lessen zijn het contenttype `les` van `@imprint/plugin-taal` en staan
alleen in de database. Zonder `DATABASE_URL` leest de site `content/` (menu,
pagina's) en heeft hij geen lessen.

Lokaal (eenmalig een database aanmaken in de lokale Postgres, `npm run db:up`):

```bash
docker exec -it imprint-engine-pg-1 psql -U imprint -c "CREATE DATABASE taal"
cp sites/taal/.env.example sites/taal/.env.local      # en SESSION_SECRET invullen
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/taal npm run db:migrate:pg
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/taal \
	npm run db:seed -- --site=taal --only=site,page,menu
npm run import:lessen --workspace=taal                # de vijf lessen van fase 0
npm run dev --workspace=taal                          # http://localhost:3700
```

Audio: zet `AZURE_TTS_KEY` (en zo nodig `AZURE_TTS_REGION`) in
`sites/taal/.env.local` en klik in de admin onder Taal → Audio per les op
*Genereer*. Alleen ontbrekende zinnen worden aangevraagd. Zonder sleutel of
zonder opname leest de browser de zin zelf voor.

De Poolse teksten (de vaste teksten in `packages/plugin-taal/src/i18n.ts`,
het menu en de pagina *O metodzie*) zijn een eerste vertaling en moeten nog
door iemand die Pools spreekt worden nagelezen. Tot die tijd staat de site op
`noindex` (`src/app/layout.tsx`).

Op de VPS: zie "Een site erbij" in `docs/deploy-vps.md`.

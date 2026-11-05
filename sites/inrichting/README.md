# Inrichting

Een besloten werkplek die laat zien hoe e-diensten zijn ingericht. De gegevens
komen rechtstreeks uit het Omnium-register; ontwerp in
`docs/design/omnium-inrichting.md`. Imprint bewaart alleen de eigen pagina's,
templates, het menu en de accounts. Van de inrichtingsgegevens maakt het geen
kopie.

- **Toegang**: elke pagina vraagt een sessie; zonder sessie ga je naar
  `/admin`, waar je inlogt.
- **Pagina's per record**: `/inrichting/<sleutelpad>`, bijvoorbeeld
  `/inrichting/ediensten/<naam of code>/versies/0.1.0`. Ze tonen de
  studio-template `_view/omnium-<pad>`, of de ingebouwde weergave van
  `@imprint/plugin-omnium`.
- **Overzicht**: de pagina `home`, met de widgets `omnium-lijst`.

Lokaal draait de site op poort 3600. Het register bereik je dan via een
port-forward naar Fundament:

```bash
kubectl -n tnt-cg--omnium port-forward svc/omnium-api 8080:8080
# .env.local: OMNIUM_REGISTER_URL=http://127.0.0.1:8080 en OMNIUM_REGISTER_TOKEN (eigen leestoken)
docker exec -it imprint-engine-pg-1 psql -U imprint -c "CREATE DATABASE inrichting"
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/inrichting npm run db:migrate:pg
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/inrichting \
	npm run db:seed -- --site=inrichting --only=site,page,menu
npm run dev --workspace=inrichting
```

Uitrollen op Fundament: zie `docs/deploy-fundament.md`.

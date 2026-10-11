# Omnium-informatiesite

Nederlandstalige informatiesite over Omnium, de modelwerkbank (canoniek model,
MDA, bitemporeel register, samenwerken). Opzet, toon en paginainhoud:
`bitemp_register_v06/docs/plans/2026-10-11 Omnium-site Imprint opzet.md`. De
teksten zijn een concept; Mark stelt ze bij in de studio.

Alles komt uit de contentstore: de startpagina is de pagina `home`, het menu is
`main`, de overige pagina's lopen via `src/app/(site)/[...slug]`. De
beginteksten staan in `content/` (pages, menus, site.json). Zonder
`DATABASE_URL` leest de site die map direct; met een database seed je ze één
keer en bewerk je daarna in de admin. Schermafbeeldingen van de Studio en de
logo's staan onder `public/shots` en `public/brand` (uit
`web/omnium-studio/assets`). Zolang de teksten concept zijn, staat de site op
`noindex` (`src/app/layout.tsx`).

Lokaal, zonder database (leest `content/`):

```bash
npm run dev --workspace=omnium      # http://localhost:3500
```

Met een eigen database (eenmalig aanmaken in de lokale Postgres):

```bash
docker exec -it imprint-engine-pg-1 psql -U imprint -c "CREATE DATABASE omnium"
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/omnium npm run db:migrate:pg
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/omnium \
	npm run db:seed -- --site=omnium --only=site,page,menu
```

Op de VPS: `./deploy.sh migrate omnium`, `./deploy.sh seed omnium --only=site,page,menu`
en `SITES=omnium ./deploy.sh` (zie docs/deploy-vps.md).

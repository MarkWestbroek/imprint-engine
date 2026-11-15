# markwestbroek.nl

Marks persoonlijke site: één plek van waaruit je bij alles komt wat hij doet.
De voorpagina is de widget `patchbay` (een rack met een bronmodule en per
activiteit een module, verbonden met bewegende patchkabels;
`src/components/patchbay.tsx`, schema in `src/widgets/registry.ts`, kleuren en
maten als `--pb-*`-tokens in `src/app/globals.css`).

Alles komt uit de contentstore: de startpagina is de pagina `home`, het menu is
`main`, de overige pagina's lopen via `src/app/(site)/[...slug]`. De
beginteksten staan in `content/`. Zonder `DATABASE_URL` leest de site die map
direct; met een database seed je ze één keer en bewerk je daarna in de admin.

Tijdelijke projecten zijn secties van deze site, geen eigen instantie. De
woonwagen staat onder `/woonwagen`; `woonwagen.markwestbroek.nl` stuurt daarheen
door (Caddy, `deploy/vps/Caddyfile.snippet`).

Zolang de site niet af is, staat hij op `noindex` (`src/app/layout.tsx`).

Lokaal, zonder database (leest `content/`):

```bash
npm run dev:markwestbroek      # http://localhost:3800
```

Met een eigen database (eenmalig aanmaken in de lokale Postgres):

```bash
docker exec -it imprint-engine-pg-1 psql -U imprint -c "CREATE DATABASE markwestbroek"
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/markwestbroek npm run db:migrate:pg
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/markwestbroek \
	npm run db:seed -- --site=markwestbroek --only=site,page,menu
```

Op de VPS: zie "markwestbroek.nl" in `docs/deploy-vps.md`.

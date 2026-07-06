# Imprint

Eén publicatie-motor, meerdere merk-sites — zoals een uitgeverij meerdere
*imprints* voert: elk met een eigen gezicht, allemaal op dezelfde machinerie.
Geen klassiek CMS dus. Eerste imprint: **MusicBrain** (werknaam).
Requirements: zie [docs/website-requirements.md](docs/website-requirements.md).

## Opzet

npm-workspaces-monorepo, gefaseerd volgens §C van het requirements-doc:

- **v0 (nu):** statische site, content als bestanden in git — geen database,
  wél al de definitieve componenten en het definitieve contentmodel.
- **v1 (later):** database (Plesk MySQL of Postgres/Neon) + admin-UI
  erachter schuiven. Alleen de `ContentStore`-implementatie wisselt; de
  pagina's blijven ongewijzigd. De bitemporal-light-kolommen
  (`valid_from/valid_to/tx_from/tx_to`, §B3) horen bij die stap.

```
packages/
  content-core/        Zod-schemas + ContentStore-interface + file-store
                       (herbruikbaar voor elke volgende site)
sites/
  musicbrain/          Next.js 16-site (App Router, Tailwind v4, dark)
    content/           De content: site.json, products/*.json,
                       releases/*.json, pages/**/*.md
docs/
  website-requirements.md
```

## Commando's

```bash
npm install        # eenmalig, vanuit de repo-root
npm run dev        # dev-server musicbrain (http://localhost:3000)
npm run build      # productie-build (volledig statisch, 11 pagina's)
npm run lint
npm run typecheck
```

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
- **Vertaling (S9):** zelfde bestand met `lang: nl` ernaast; EN is fallback.

## Nog te doen (v0 → v1)

- [ ] Repo naar GitHub; CI (build bij PR)
- [ ] Deploy-doel kiezen: statische export naar Plesk, of Vercel/Netlify
- [ ] Nieuwsbrief-signup met double opt-in (W1) — heeft backend/dienst nodig
- [ ] GitHub-webhook → releases (S7) — heeft de DB-stap nodig
- [ ] Admin-UI + auth (v1)
- [ ] Placeholder-content (productteksten, links, domein) vervangen

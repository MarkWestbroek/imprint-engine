# Imprint — werkafspraken

- Projectnaam is **Imprint**: één publicatie-motor, sites zijn "imprints"
  (de map heet mogelijk nog CMS2026; de naam in code/docs is Imprint).

- npm-workspaces-monorepo: `packages/content-core` (schemas + ContentStore),
  `sites/musicbrain` (Next.js 16, App Router, Tailwind v4). Requirements in
  `docs/website-requirements.md` zijn leidend (eisnummers W*/S* worden in
  code-comments aangehaald).
- Sites praten uitsluitend via de `ContentStore`-interface
  (`packages/content-core/src/store.ts`) met content — nooit rechtstreeks
  bestanden of de database lezen vanuit paginacode. Met `DATABASE_URL`
  draait de site op de `DbContentStore` (MariaDB, bitemporal-light §B3:
  elke wijziging is een nieuwe rij); zonder valt hij terug op de
  file-store (v0). Schrijven kan alleen via `WritableContentStore`
  (de admin), nooit met kale SQL — anders klopt de historie niet meer.
- DB-workflow: schemawijziging in `db-schema.ts` → `npm run db:generate`
  (migratie in `drizzle/`, committen) → `npm run db:migrate`. Lokale DB:
  `npm run db:up` (MariaDB 10.11-container, zelfde major als Plesk).
  Secrets in `.env` (root) + `sites/musicbrain/.env.local` — nooit committen.
- Content is zod-gevalideerd; schemawijzigingen horen in
  `packages/content-core/src/schemas.ts`, niet ad hoc in een site.
- Widget-model (UML-contentmodel): pagina's zijn composeerbaar als
  `PageLayout` = rijen → cellen (met `span`-breedte) → widgets
  `{ type, config }`; het oude template/regio-formaat parseert nog en
  wordt via `layoutRows()` (site, `src/widgets/templates.ts`) omgezet.
  De kern (`packages/content-core/src/widgets.ts`) kent géén concrete
  widgets; elke site declareert zijn catalogus in `src/widgets/registry.ts`
  (configschema's, geen React/store-imports — de store valideert hiermee)
  + `src/widgets/components.tsx` (viewers, server) + optioneel
  `src/widgets/editors.tsx` (custom editor; default is het formulier uit
  het schema). Nieuwe widget = één schema + één viewer.
- Pagina's bewerk je in de studio (`/admin/page/edit/...`): canvas met
  echte viewers in de echte SiteChrome, sidebar per widget, wijzigingen in
  een serverside draft (`src/lib/page-draft.ts`); pas "Save" maakt een
  versie. Mutatielogica is puur in `src/lib/layout-ops.ts`.
- Mark exporteert af en toe handmatig chat-sessies (script) naar
  `doc/copilot-chats/exports/` — die bestanden verschijnen dus "opeens"
  (nieuw of gewijzigd) in de werkboom. Niet van schrikken: ze gaan over het
  lopende werk en mogen gewoon mee in commits en releases.
- Documentatie hoort bij elke wijziging, gescheiden naar publiek:
  **functioneel** (wat kan de redacteur ermee) in `docs/handleiding.md`,
  **technisch** (hoe zit het in elkaar) in `docs/architecture.md` (mermaid),
  plus een regel onder `## [Unreleased]` in `CHANGELOG.md`. Open punten
  staan in `docs/backlog.md`; streep af/vul aan als er iets af of bij komt.
- Versies: semver via git-tags (pre-1.0: minor = capability, patch = fix);
  de drie `package.json`-versies lopen gelijk met de tag. Zet bij elke
  noemenswaardige wijziging een regel onder `## [Unreleased]` in
  `CHANGELOG.md`. Releasen = `npm run release -- <versie>` (bumpt versies,
  verplaatst de changelog-notities, commit + tag); zie `docs/releasing.md`.
- Design-tokens staan in `sites/musicbrain/src/app/globals.css` (@theme);
  geen losse hexkleuren in componenten.
- Build verifiëren met `npm run build` vanuit de root. Publieke pagina's
  blijven prerendered (SSG + revalidatie na admin-saves); alles onder
  `/admin` is per definitie dynamisch.
- Admin-formulieren worden gegenereerd uit de zod-schema's
  (`src/lib/admin-schemas.ts` → `SchemaForm`); een nieuw contentveld hoort
  dus in het schema, niet als los formulierveld in de admin.
- Relaties tussen contenttypen zijn zachte slug-referenties; integriteit
  wordt bewaakt door RelationRules (`content-core/src/relations.ts`),
  opgeslagen als `type: "relations"` en bewerkbaar in `/admin/relations`.
  `DbContentStore.putItem` weigert een enforced verwijzing naar niet-
  bestaande content. Nieuw type met refs = een regel toevoegen, geen code.

# Imprint — werkafspraken

- Projectnaam is **Imprint**: één publicatie-motor, sites zijn "imprints"
  (de map heet mogelijk nog CMS2026; de naam in code/docs is Imprint).

- npm-workspaces-monorepo. Packages: `content-core` (schema's, ContentStore,
  backends), `extension-api` (composition root: `defineImprint`),
  `runtime-admin` (renderer, `WidgetContext`; later de gedeelde admin) en
  `widgets-standard` (bibliotheek: standaardwidgets). Sites:
  `sites/musicbrain` (Next.js 16, App Router, Tailwind v4, MariaDB) en
  `sites/imprint` (productsite, Postgres). Requirements in
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
  wordt via `layoutRows()` (engine, `@imprint/runtime-admin/layout`) omgezet.
  De kern (`packages/content-core/src/widgets.ts`) en de renderer
  (`@imprint/runtime-admin`) kennen géén concrete widgets. Elke site stelt
  haar catalogus samen in `src/widgets/registry.ts` (configschema's, geen
  React/store-imports — de store valideert hiermee) + `src/widgets/components.tsx`
  (viewers, server), uit standaardwidgets van `@imprint/widgets-standard`
  (`/schemas` + `/viewers`, per widget te kiezen) en eigen domeinwidgets.
  Viewers lezen content alleen via de aangereikte `WidgetContext` (lint).
  Optioneel `src/widgets/editors.tsx` (custom editor; default is het
  formulier uit het schema). Nieuwe widget = één schema + één viewer:
  generiek in `widgets-standard`, domeingebonden in de site; een rijke
  editor hoort bij zijn widget (`widgets-standard/src/editors.tsx` voor
  standaardwidgets, `src/widgets/editors.tsx` in de site voor eigen widgets).
  De studio zelf staat in `@imprint/runtime-admin` en krijgt per site
  viewers, chrome en editor via `AdminContext.studio`. Een nieuw
  engine-package met markup vraagt een `@source`-regel in `globals.css`.
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
  De stand van de engine-revisie staat in §12 van
  `docs/design/engine-instance-plugin-architectuur.md`: werk die tabel bij
  bij elke afgeronde stap.
- Versies: semver via git-tags (pre-1.0: minor = capability, patch = fix);
  alle `package.json`-versies (root en elke workspace) lopen gelijk met de tag. Zet bij elke
  noemenswaardige wijziging een regel onder `## [Unreleased]` in
  `CHANGELOG.md`. Releasen = `npm run release -- <versie>` (bumpt versies,
  verplaatst de changelog-notities, commit + tag); zie `docs/releasing.md`.
- Productie is de VPS (Plesk is vervallen): één container-image per site uit
  de root-`Dockerfile` (build-arg `SITE`), alleen Postgres, Caddy ervoor;
  alles in `deploy/vps/`, runbook in `docs/deploy-vps.md`. De SSG-build leest
  de database, dus de VPS bouwt zelf (`deploy.sh`). Een nieuwe site of een
  nieuw workspace-package vraagt een `COPY`-regel in de Dockerfile.
- Design-tokens staan in `sites/musicbrain/src/app/globals.css` (@theme);
  geen losse hexkleuren in componenten.
- Build verifiëren met `npm run build` vanuit de root. Publieke pagina's
  blijven prerendered (SSG + revalidatie na admin-saves); alles onder
  `/admin` is per definitie dynamisch.
- Admin-formulieren worden gegenereerd uit de zod-schema's
  (`@imprint/runtime-admin/forms` → `SchemaForm`); een nieuw contentveld hoort
  dus in het schema, niet als los formulierveld in de admin. De generieke
  admin-clientcomponenten (dialoog, formulier, markdown-editor, login, menu-,
  thema-, gebruikers-, relatie- en itemeditor) staan in
  `@imprint/runtime-admin/admin` en krijgen server actions als prop; de
  schermen en action-implementaties van de admin in
  `@imprint/runtime-admin/admin-server`, met de `AdminContext` als eerste
  argument. De site bouwt die context één keer (`src/lib/admin.ts`), houdt
  dunne routebestanden onder `app/admin/` en één-regel `"use server"`-wrappers
  (`app/admin/actions.ts`); nieuwe admin-schermen van de site komen in het
  menu via `contributions`.
- Relaties tussen contenttypen zijn zachte slug-referenties; integriteit
  wordt bewaakt door RelationRules (`content-core/src/relations.ts`),
  opgeslagen als `type: "relations"` en bewerkbaar in `/admin/relations`.
  `DbContentStore.putItem` weigert een enforced verwijzing naar niet-
  bestaande content. Nieuw type met refs = een regel toevoegen, geen code.

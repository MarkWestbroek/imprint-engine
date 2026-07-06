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
  + `src/widgets/components.tsx` (componenten). Nieuwe widget = één schema
  + één component.
- Ontwerp gedocumenteerd in `docs/architecture.md` (mermaid) — bijwerken
  als het contentmodel, de stores of de deploy-opzet wijzigen.
- Design-tokens staan in `sites/musicbrain/src/app/globals.css` (@theme);
  geen losse hexkleuren in componenten.
- Build verifiëren met `npm run build` vanuit de root. Publieke pagina's
  blijven prerendered (SSG + revalidatie na admin-saves); alles onder
  `/admin` is per definitie dynamisch.
- Admin-formulieren worden gegenereerd uit de zod-schema's
  (`src/lib/admin-schemas.ts` → `SchemaForm`); een nieuw contentveld hoort
  dus in het schema, niet als los formulierveld in de admin.

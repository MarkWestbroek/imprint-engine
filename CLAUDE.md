# Imprint — werkafspraken

- Projectnaam is **Imprint**: één publicatie-motor, sites zijn "imprints"
  (de map heet mogelijk nog CMS2026; de naam in code/docs is Imprint).

- npm-workspaces-monorepo: `packages/content-core` (schemas + ContentStore),
  `sites/musicbrain` (Next.js 16, App Router, Tailwind v4). Requirements in
  `docs/website-requirements.md` zijn leidend (eisnummers W*/S* worden in
  code-comments aangehaald).
- Sites praten uitsluitend via de `ContentStore`-interface
  (`packages/content-core/src/store.ts`) met content — nooit rechtstreeks
  bestanden of straks de database lezen vanuit paginacode. v1 vervangt de
  file-store door een DB-store (bitemporal-light, §B3).
- Content is zod-gevalideerd; schemawijzigingen horen in
  `packages/content-core/src/schemas.ts`, niet ad hoc in een site.
- Design-tokens staan in `sites/musicbrain/src/app/globals.css` (@theme);
  geen losse hexkleuren in componenten.
- Build verifiëren met `npm run build` vanuit de root (moet volledig
  statisch blijven in v0).

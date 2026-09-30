# Common Ground op Imprint (showcase)

De derde site in de monorepo: een showcase van **Common Ground** op Imprint,
als verkenning van Imprint als alternatief voor Pleio
([design/communities.md](../../docs/design/communities.md)). De vormgeving is
die van commonground.nl: logo linksboven, het hoofdmenu ernaast (met
uitklapmenu's), rechts zoeken, mededelingen en de ingelogde gebruiker, een
lichtblauwe footer met witte kaarten, en voor redacteuren een potlood
rechtsonder dat de pagina in de studio opent. Die vormgeving is van Common
Ground zelf, niet van Pleio.

Alles komt uit de store en is dus te bewerken: elke pagina (ook `home`), het
menu `main`, en de footer (de pagina `_footer`). De inhoud komt uit de
publieke Pleio-site via de GraphQL-API: `scripts/import-pleio.ts`.

## Lokaal

```bash
npm run db:up                                   # Postgres op 5434
docker compose exec -T pg psql -U imprint -d imprint -c "CREATE DATABASE commonground;"
cp sites/commonground/.env.example sites/commonground/.env.local   # en vul SESSION_SECRET
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/commonground npm run db:migrate:pg
DATABASE_URL=postgres://imprint:imprint-dev@localhost:5434/commonground npm run user -- add <naam> admin
npm run import:pleio --workspace=commonground   # pagina's, menu en footer uit commonground.nl
npm run dev:commonground                        # http://localhost:3300
```

`import:pleio` kan opnieuw: ongewijzigde pagina's slaat hij over, de rest wordt
een nieuwe versie (de historie blijft). Opties: `--dry-run` (alleen omzetten en
tonen), `--cache=<map>` (GraphQL-antwoorden bewaren en hergebruiken),
`--base-url=https://…` (het adres van deze site), `--origin=https://…` (een
andere Pleio-site).

## Wat de import doet

- Publieke, gepubliceerde pagina's op siteniveau (niet die in groepen) worden
  een `page`; de slug komt uit de Pleio-URL (`/page/view/<guid>/<slug>`), de
  startpagina wordt `home`.
- Rijen → cellen → widgets: de 12-koloms breedtes worden `span`s;
  `text` → tekst (een gekleurd blok → callout), knoppen in de tekst → een
  knoppenwidget, `lead` → hero, `callToAction` → callout, `linkList` →
  kaarten, een iframe in een `html`-widget → embed. Overzichten van
  Pleio-inhoud (nieuws, agenda, groepen, activiteit, zoeken) worden een
  callout met een knop naar het origineel, tot die inhoud meekomt.
- Rich text (TipTap-JSON) → Markdown.
- Wiki's (plugin-wiki): een knoop met kinderen wordt een map met de eigen
  tekst als eerste pagina, een blad een pagina.
- Groepen (de zichtbare; een "Copy: …"-groep is Pleio's kopie) → `group`
  (plugin-groups) op `/groups/<slug>`, met per groep één wiki (de wiki's van
  de groep samen, slug = groepsslug; "Common Ground publicatiesite" heet
  `wiki`) en haar pagina's als `groups/<slug>/<pagina>`.
- Termen (Pleio's `custom_term`) → `term` (plugin-glossary), met de
  samenvatting (excerpt) voor de kaart en de tag-categorie als tags; de
  overzichten erop (`objects`-widgets over `custom_term`) → de widget `glossary`.
- Links naar geïmporteerde pagina's, wikipagina's en termen worden Imprint-paden; al het andere
  (nieuws, agenda, groepen, bestanden, afbeeldingen) wijst naar commonground.nl.

## Bestanden

- `src/components/site-chrome.tsx`: header en footer; `user-tools.tsx`: de
  ingelogde gebruiker (via `/api/me`, zodat pagina's statisch blijven) en het
  potlood.
- `src/components/page-view.tsx`: een pagina uit de store, en de footer.
- `src/app/(site)/`: `/` (pagina `home`), `/<slug>`, `/search` (met
  `/zoeken` als doorstuurroute die de zoekterm meeneemt); de aliassen
  `groep` en `term` staan in de site-config en sturen door.
- `src/widgets/components.tsx`: de viewers, elk in een `data-widget`-element,
  zodat `globals.css` per widgettype de Common Ground-stijl kan geven.
- `src/app/globals.css`: de huisstijl (kleuren uit het logo en het Pleio-thema).

De pagina's staan op `noindex`: het is een showcase naast de echte site.

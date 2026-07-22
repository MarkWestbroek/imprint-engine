# Backlog — Imprint

Open punten, bij elkaar geharkt uit de README, de requirements
([website-requirements.md](website-requirements.md), eisnummers `W*`/`S*`) en de
ideeën die onderweg in de bouwsessies langskwamen. Geen planning — een lijst om
uit te kiezen.

Maat: **S** ≈ een uurtje · **M** ≈ een dagdeel · **L** ≈ groter/meerdaags.

---

## 1. Widgets

De catalogus nu: `text`, `table`, `image`, `gallery`, `carousel`, `album`,
`map`, `video`, `hero`, `accordion`, `divider`, `downloads`, `posts`,
`itinerary`, `board`, `boardspec`, `template`, `list`, `callout`, `embed`,
`treeview`, `api`, `releases`, `products`, `kanban`, `planning`.

### Planning-borden (nieuw in 0.11.0)
- [x] ~~**Planning als content**~~ — `planning` + `planning-item` contenttypen,
      admin-bord met drag&drop + edit-drawer, `planning`-widget (board- én
      generieke modus), `component.phase`-veld. Elke move = bitemporale versie.
- [ ] **Fasen-editor** voor de generieke widgetmodus — de `phases`-lijst is nu
      een JSON-box in de widget-config; verdient een rij-editor. _(S)_
- [ ] **Kaart-body echte rich text** — nu markdown-textarea; de WYSIWYG-editor
      (zie §7) zou hier ook passen, met een content-picker voor interne links
      (`[[type/slug]]`-autolink). _(chat-idee; M)_
- [ ] **Kaart-body-template configureerbaar** — bij het kiezen van een
      component vult een lege body nu vast met `Werken aan [naam](/…)`. Een
      per-bord of per-widget sjabloon met velden (`{{component}}`,
      `{{component.description}}`) zou dit vrij definieerbaar maken (à la de
      template-widget). _(chat-idee; M)_
- [ ] **Generieke modus verschuifbaar** — nu read-only; een gemachtigde
      gebruiker zou ook een component tussen fasen mogen slepen (zet
      `component.phase`). Meestal doet het project dit via de API. _(idee; M)_
- [ ] **Board as-of in de widget** — de widget leest `listItems` (huidig); de
      publieke weergave reist nog niet mee met time-travel (de historie zelf
      wél, via de item-versies). _(S)_

### Custom editors (het editor-seam bestaat, wordt nog nauwelijks benut)
- [ ] **Specs-editor** voor `product.specs` — nu een JSON-box, verdient hetzelfde
      grid als de table-widget. _(chat-idee; S)_
- [ ] **Downloads-editor** voor `release.downloads` (label/url/checksum). _(S)_
- [ ] **API-widget-editor** met een apart **zoekterm**-veld i.p.v. de query in de
      lange URL verstoppen — dit maakte de "Kraftwerk"-verwarring. _(chat-idee; S)_
- [ ] **Menu-items** in de `treeview`-widget: nu nog een JSON-box. _(S)_

### Nieuwe widgettypen
- [x] ~~**`itinerary`**~~ — gedaan in 0.8.0.
- [x] ~~**`gallery` / media**~~ — gedaan in 0.8.0 (gallery-widget + lightbox;
      `product.media` wordt op de productpagina gerenderd). Voor W3 rest **video**.
- [x] ~~**foto-carrousel**~~ — gedaan in 0.8.0.
- [x] ~~**externe foto-repo / Lightroom-view**~~ — gedaan in 0.8.0; de
      Lightroom-provider loopt sinds 0.8.1 de echte share-API af en is
      geverifieerd met Marks "@2020 Street"-album (11 foto's).
- [x] ~~**interactieve kaart**~~ — gedaan in 0.8.0 (Leaflet/OSM).
- [x] ~~**kanban-bord**~~ — gedaan in 0.8.0.
- [x] ~~**`downloads`**~~ — gedaan in 0.9.0 (W7).
- [x] ~~**`posts` / nieuws-feed**~~ — gedaan in 0.9.0 (W6-deel; RSS staat nog open).
- [x] ~~**`accordion` / FAQ**~~ — gedaan in 0.9.0.
- [x] ~~**`hero`**~~ — gedaan in 0.9.0.
- [x] ~~**`divider` / spacer**~~ — gedaan in 0.9.0.
- [x] ~~**`video`**~~ — gedaan in 0.9.0 (YouTube/Vimeo privacy-embed of bestand;
      rest van W3).
- [ ] **`search`** — zoeken in content (vergt eerst een zoekindex). _(idee; L)_
- [ ] **Lijst-varianten** — de `list`-widget kan alleen links; Pleio doet ook
      *feed* en *slider* als weergavevorm. _(idee; M)_

### Widget-contract
- [ ] **`help` als markdown** i.p.v. één regel, met een "meer info"-uitklap in de
      sidebar. _(chat-idee; S)_
- [ ] **Widget-versie pinnen** — het contract kent `version`, maar content kan er
      (nog) niet tegen pinnen. Pas nodig als er breaking widget-wijzigingen komen.
      _(chat-idee; M)_

---

## 2. Studio & admin

- [x] ~~**As-of-preview**~~ — gedaan in 0.10.0: "Time travel" op het
      admin-dashboard (draft mode + `asOf`-cookie; `currentRows` reist nu op
      beide tijdassen). Sinds 0.11.0 reizen ook de widgets met eigen
      store-reads (posts, list, releases, boardspec, itinerary, downloads,
      products) mee.
- [ ] **Preview-URL voor drafts** (S5: draft → preview-URL → publish). Nu wel
      draft-vlag + studio-concept, geen deelbare preview-link. _(S5; M)_
- [ ] **Drafts in een tabel** i.p.v. procesgeheugen — een niet-opgeslagen
      studio-concept overleeft nu geen serverherstart. _(bekend; M)_
- [x] **Users-beheer in de admin** — `/admin/users` (admins: toevoegen, rol,
      wachtwoord resetten, verwijderen; iedereen: eigen wachtwoord wijzigen),
      plus `npm run user` als noodingang via SSH. _(README)_
- [ ] **Sessie intrekken bij reset/rol/verwijderen** — de sessiecookie is
      stateless (HMAC, 12u), dus een gereset of gedegradeerde gebruiker blijft
      tot 12u ingelogd in een browser die al openstond. Vraagt een
      `session_epoch`-kolom die `getSession()` meeneemt. _(M)_
- [ ] **Wachtwoord vergeten zonder SSH** — nu is de CLI de enige weg terug.
      Wacht op mail-infra op Plesk; dan liever meteen de magic-link uit de
      requirements (§C) dan een reset-token-flow. _(S10-afhankelijk; M)_
- [ ] **Rollen per content-item** (`ContentUser`: creator/owner/contributor) staan
      in het schema maar worden niet gehandhaafd; S3 vraagt ook een
      *product-editor*-rol. _(S3; M)_
- [ ] **Default views uitbreiden** — het mechanisme staat; er zijn nog geen
      ingerichte views. **Bewust geparkeerd** (juli 2026): een meegeleverd
      `_view/<type>`-sjabloon zou de goede hand-gecodeerde fallbacks
      (product-/component-/releasepagina) direct overrulen — startsjablonen
      zijn pas nuttig mét een "gebruik sjabloon"-keuze per type in de admin.
      _(S→M)_
- [ ] **Media-bibliotheek** met automatische varianten (thumbnail/OG/hero). De
      AssetStore is er; upload-UI en varianten niet. _(S8; L)_
- [ ] **Chrome-varianten** — de grove pagina-indeling (logo-positie,
      header/footer-variant) parameteriseren per site, als server-side laag
      naast de client-side thema-tokens (zie architecture.md §3c). _(M)_
- [~] **Editor-demo online** (`/editor`, eis A1) — de MusicBrain-editor is een
      zelfstandige Vite/React-SPA zonder database (draait een complete synth
      in simulatiemodus). **Gekozen (juli 2026): eigen subdomein**
      `editor.musicbrain.nl` als aparte Plesk-vhost, gedeployd uit het
      MusicBrain-repo op eigen release-tempo; de editor is puur statisch
      (geen Node/Passenger, `vite base` blijft `/`). Imprint's `/editor`
      linkt erheen — geen ContentStore-koppeling.
      - [x] Imprint-kant: `/editor`-landingspagina gebouwd
        (`content/pages/editor.json`: hero + scope-divider + specs + CTA naar
        `editor.musicbrain.nl`). Nog **niet** in het hoofdmenu (geen dode link
        vóór het subdomein leeft) — menu-item + seed = de "aanzetten"-stap.
      - [ ] MusicBrain-repo: editor stylen met de tokens uit `doc/styleguide.md`
        en een deploy-action (`cd editor && npm ci && npm run build`, docroot =
        `editor/dist`).
      - [ ] Plesk: subdomein `editor.musicbrain.nl` (statische docroot op
        `editor/dist`), git-deploy uit MusicBrain-repo + webhook.
      _(A1; M)_

---

## 3. Contentmodel, API & opslag

- [ ] **Documentatie differentiëren** — `docs` is nu één optioneel veld (pagina-slug
      of inline markdown). Het UML liet `Documentation` bewust vaag; board-spec was
      de eerste uitwerking. _(open ontwerp; M)_
- [x] ~~**Asset-opruiming**~~ — gedaan in 0.11.0: `npm run assets:gc`
      (dry-run default, `--delete` om echt op te ruimen). Verwijdert alleen
      bestanden waar geen énkele historische rij naar wijst — History en
      time travel behouden hun assets.
- [ ] **MinIO/S3 AssetStore** — de interface is er, alleen de implementatie +
      config-wissel ontbreekt. _(D7; M)_
- [ ] **Migratie naar het bitemporal-register** (bitemporal2026) achter de
      `ContentStore`. _(README/§B3; L)_
- [x] ~~**RSS-feed**~~ — gedaan in 0.11.0: `/feed.xml` (W6-rest), met
      `rel=alternate` in de metadata.
- [ ] **sitemap.xml + robots.txt**; OG-images per pagina genereren. _(W13; M)_

---

## 4. Board/MMB-spoor

- [x] ~~**Overige 12 borden publiceren**~~ — gedaan: MMB heeft de volledige set
      gepubliceerd (incl. gswitch-serie), sinds 0.10.x mét 3D-modellen.
- [x] ~~**Hotspot-punten meesturen**~~ — gedaan: de specs komen met `points`
      binnen (de interactieve modus staat overal aan).
- [ ] **Herpost met `kind` + GLB naar live** — wacht op de Plesk-pull van
      v0.10.2; daarna één herpost-run van MMB (editors → "Software",
      3D-tabs live). _(MMB; S aan hun kant)_
- [x] ~~**Boards-index**~~ — gedaan in 0.10.0: `/boards`, kaartenraster met
      render, component en versie.
- [x] ~~**Componentpagina: gepinde versie prominent**~~ (MMB-testcase assert 4
      + vraag 4) — gedaan in 0.10.0: de door de nieuwste release gepinde
      versie is de hoofdweergave (met "pinned by"-badge naar de release,
      kanaalweging stable > beta > dev); overige versies ingeklapt onder
      "Other versions". Zonder pins: vlakke lijst zoals voorheen.

---

## 5. Website (requirements die nog open staan)

- [ ] **W1** Nieuwsbrief-signup met double opt-in (staat nu als "coming soon").
      Vergt S10. _(must; M)_
- [x] ~~**W2/S7** Release-feed automatisch uit GitHub~~ — gedaan in 0.11.0:
      `POST /api/webhooks/github` (HMAC-signature, `GITHUB_WEBHOOK_SECRET`);
      repo→project/product-mapping in de site-config (`releaseSources`).
      Nog te doen aan jouw kant: secret zetten + webhook aanmaken in de
      GitHub-repo('s) + mapping invullen.
- [ ] **W4** Beta-/interesse-aanmelding per product (formulier → lijst). _(must; M)_
- [ ] **S10** Formulieren → DB + notificatie-mail + spam-bescherming (de basis
      onder W1/W4). _(must; L)_ **Spooraanpassing (juli 2026)**: Mark bouwt in
      het bitemporal-project (Omnium) een metamodel-gedreven formuliereditor +
      React-renderer. Imprint levert de datakant:
      - [x] ~~metamodel uitleesbaar~~ — gedaan in 0.11.0: `GET /api/meta`
            (JSON Schema 2020-12 per contenttype, uit dezelfde zod-schema's,
            plus de relatieregels als referentietypen en de afgeleide
            itinerary).
      - [x] ~~**V3-formaat**~~ — gedaan in 0.11.0: `GET /api/meta?format=v3`
            levert het geneste `V3Model` (spec: design/v3-metamodel-spec.md;
            mapping: `v3-export.ts` — GE/relatie-splitsing, velden óp de
            relatie zoals Release↔Component-versie, centrale enums,
            datatypes Slug/Versienummer/Markdown/Kleur/AssetUrl/Json).
      - [ ] **Formulier-renderer als widget** — de Omnium-renderer (React)
            inpluggen als `form`-widget: configschema verwijst naar een
            formulierdefinitie, submits → S10-opslag. _(na renderer; M)_
- [ ] **W3** Foto/video op de productpagina (zie gallery-widget). _(must; M)_
- [ ] **W5/S9 Meertaligheid** — het fundament bestaat (elk item heeft `lang`,
      EN→NL-fallback in beide stores, `?lang=` op de API), maar er is nog
      geen gezicht: geen taal-switcher op de site, geen NL-content, en in de
      admin geen taalkeuze-flow (vertaling maken = zelfde slug met
      `lang: nl` opslaan, maar geen knop "vertaal dit item"). Ook nog open:
      `hreflang`/URL-strategie. **Ontwerp ligt klaar** (beheer-flow, fasering):
      [design/meertaligheid.md](design/meertaligheid.md). _(should; L)_
- [ ] **W8** Press kit als downloadbare zip. _(should; S)_
- [ ] **W11** Community: links + GitHub Discussions embed. _(should; S)_
- [ ] **W12** Privacy-vriendelijke analytics (Plausible/Umami). _(should; S)_
- [ ] **W9** Embedded demo van de editor. **Ontwerp ligt klaar** (aparte
      demo-imprint met nachtelijke reset; open vragen voor Mark):
      [design/editor-demo.md](design/editor-demo.md). _(could; M)_
- [ ] **W10** Dealer-portal achter login. _(later; L)_
- [ ] **Placeholder-content vervangen** — productteksten, links, domein zijn nog
      door mij verzonnen. _(README; M — jouw tekst)_

---

## 6. Deploy & beheer

- [x] ~~**Deploy naar Plesk**~~ — live op https://musicbrain.nl sinds juli 2026;
      update-flow bewezen bij 0.9.0 (pull → gericht bijseeden → rebuild →
      `npm run smoke`). Servercommando's zonder SSH via Scheduled Tasks
      (patroon in de README).
- [x] ~~**CI**~~ — gedaan in 0.10.0: GitHub Actions draait typecheck + lint +
      build (file-store, geen DB) bij elke push/PR.
- [ ] **Seed triggert revalidatie** — `db:seed` schrijft rechtstreeks in de
      DB en leegt de Next-cache niet; geseede content verschijnt pas na een
      rebuild óf een willekeurige admin-save (juli 2026 live gebleken bij de
      "open brain"-uitrol: build vóór seed = oude content in de statische
      pagina's). Seed zou na afloop de revalidate-hook moeten aanroepen, dan
      is de volgorde niet meer belangrijk. _(S)_
- [x] ~~**Backups**~~ — gedaan in 0.11.0: `npm run backup` (hele bitemporale
      historie + users + assets, retentie 14, Node-only dus Plesk-Scheduled-
      Task-klaar); zie [backups.md](backups.md). Nog te doen: de dagelijkse
      taak aanmaken op Plesk + af en toe een backup van de server halen.

---

## 7. Open beslissingen (vragen aan Mark)

- [ ] **`image` en `board` samenvoegen?** Beide zijn "afbeelding + punten"; je wilde
      ze voorlopig apart houden omdat de board-kant zich apart kan ontwikkelen
      (pinouts zijn SVG's op de render → beeld-op-beeld).
- [ ] **Echte WYSIWYG-markdown?** Nu contentEditable + marked/turndown met een
      Markdown-tab. Een zwaardere editor (Milkdown/TipTap) kan op dezelfde plek
      inpluggen als je meer wilt.
- [ ] **Postgres of MariaDB?** S11 noemt PostgreSQL; we koersen bewust op MariaDB
      (Plesk). Prima keuze, maar het staat nog als afwijking in de requirements.
- [x] ~~**Relations aanzetten**~~ — gedaan: de default-regels staan aan in de
      dev-DB (op Plesk straks nogmaals via /admin/relations → Load defaults).

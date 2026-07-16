# Backlog — Imprint

Open punten, bij elkaar geharkt uit de README, de requirements
([website-requirements.md](website-requirements.md), eisnummers `W*`/`S*`) en de
ideeën die onderweg in de bouwsessies langskwamen. Geen planning — een lijst om
uit te kiezen.

Maat: **S** ≈ een uurtje · **M** ≈ een dagdeel · **L** ≈ groter/meerdaags.

---

## 1. Widgets

De catalogus nu: `text`, `table`, `image`, `board`, `boardspec`, `template`,
`list`, `callout`, `embed`, `treeview`, `api`, `releases`, `products`.

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

- [ ] **As-of-preview** — "toon de site zoals hij op datum X was/wordt". De store
      kan het al (`asOf`), er is alleen geen knop. Mooie demo van bitemporal.
      _(chat-idee; M)_
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
      ingerichte views (de hand-gecodeerde fallback doet het werk). Eventueel een
      set startsjablonen meeleveren. _(S)_
- [ ] **Media-bibliotheek** met automatische varianten (thumbnail/OG/hero). De
      AssetStore is er; upload-UI en varianten niet. _(S8; L)_
- [ ] **Chrome-varianten** — de grove pagina-indeling (logo-positie,
      header/footer-variant) parameteriseren per site, als server-side laag
      naast de client-side thema-tokens (zie architecture.md §3c). _(M)_

---

## 3. Contentmodel, API & opslag

- [ ] **Documentatie differentiëren** — `docs` is nu één optioneel veld (pagina-slug
      of inline markdown). Het UML liet `Documentation` bewust vaag; board-spec was
      de eerste uitwerking. _(open ontwerp; M)_
- [ ] **Asset-opruiming** — content-hashing laat oude bestanden achter bij elke
      her-publicatie. Onschuldig qua omvang, maar een GC-script is netjes. _(S)_
- [ ] **MinIO/S3 AssetStore** — de interface is er, alleen de implementatie +
      config-wissel ontbreekt. _(D7; M)_
- [ ] **Migratie naar het bitemporal-register** (bitemporal2026) achter de
      `ContentStore`. _(README/§B3; L)_
- [ ] **RSS-feed** voor de devlog. _(W6; S)_
- [ ] **sitemap.xml + robots.txt**; OG-images per pagina genereren. _(W13; M)_

---

## 4. Board/MMB-spoor

- [ ] **Overige 12 borden publiceren** — wacht op akkoord na de review van
      `busboard-v2`. _(MMB; S aan hun kant)_
- [ ] **Hotspot-punten meesturen** — zonder `points` blijft de interactieve
      board-modus uit. Beslis dit vóór de batch, anders is de set inconsistent.
      _(beslissing; S)_
- [ ] **Boards-index** — een overzichtspagina van alle board-specs (nu alleen
      bereikbaar via hun component). _(chat-idee; S)_
- [ ] **Componentpagina: gepinde versie prominent** (MMB-testcase assert 4):
      toon de versie die de nieuwste release pint als hoofdweergave en oudere
      versies ingeklapt als archief. Basis werkt al (alle versies zichtbaar);
      zie docs/testcases/oude-releases-blijven-benaderbaar.md. _(MMB; S)_

---

## 5. Website (requirements die nog open staan)

- [ ] **W1** Nieuwsbrief-signup met double opt-in (staat nu als "coming soon").
      Vergt S10. _(must; M)_
- [ ] **W2/S7** Release-feed automatisch uit GitHub (webhook → release-item).
      _(must; M)_
- [ ] **W4** Beta-/interesse-aanmelding per product (formulier → lijst). _(must; M)_
- [ ] **S10** Formulieren → DB + notificatie-mail + spam-bescherming (de basis
      onder W1/W4). _(must; L)_
- [ ] **W3** Foto/video op de productpagina (zie gallery-widget). _(must; M)_
- [ ] **W5/S9 Meertaligheid** — het fundament bestaat (elk item heeft `lang`,
      EN→NL-fallback in beide stores, `?lang=` op de API), maar er is nog
      geen gezicht: geen taal-switcher op de site, geen NL-content, en in de
      admin geen taalkeuze-flow (vertaling maken = zelfde slug met
      `lang: nl` opslaan, maar geen knop "vertaal dit item"). Ook nog open:
      `hreflang`/URL-strategie (pad-prefix `/nl/` of cookie). _(should; L)_
- [ ] **W8** Press kit als downloadbare zip. _(should; S)_
- [ ] **W11** Community: links + GitHub Discussions embed. _(should; S)_
- [ ] **W12** Privacy-vriendelijke analytics (Plausible/Umami). _(should; S)_
- [ ] **W9** Embedded demo van de editor. _(could; M)_
- [ ] **W10** Dealer-portal achter login. _(later; L)_
- [ ] **Placeholder-content vervangen** — productteksten, links, domein zijn nog
      door mij verzonnen. _(README; M — jouw tekst)_

---

## 6. Deploy & beheer

- [x] ~~**Deploy naar Plesk**~~ — live op https://musicbrain.nl sinds juli 2026;
      update-flow bewezen bij 0.9.0 (pull → gericht bijseeden → rebuild →
      `npm run smoke`). Servercommando's zonder SSH via Scheduled Tasks
      (patroon in de README).
- [ ] **CI** — GitHub Actions: build + lint + typecheck per PR. _(README; S)_
- [ ] **Backups** van de DB + assets op Plesk. _(niet eerder genoemd; S)_

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

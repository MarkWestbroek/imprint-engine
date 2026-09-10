# Opdrachtbrief — Imprint lostrekken in engine, bibliotheek, backend en site

> Datum: 2026-09-10 · Voor: een nieuwe werksessie (chat) over de Imprint-engine
> Opdrachtgever: Mark · Status: opdracht, geen ontwerp — het ontwerp bestaat al
> Tijdsbudget: beperkt; kleine, afgeronde stappen die elk apart committeerbaar zijn

## 1. Waar dit over gaat

Imprint is bedoeld als één publicatiemotor voor meerdere sites ("imprints"),
maar de motor zit nog grotendeels in `sites/musicbrain`. Op 31 augustus is
daar een uitgebreid revisievoorstel voor geschreven:
[`engine-instance-plugin-architectuur.md`](engine-instance-plugin-architectuur.md).
Deze brief voegt daar twee begrippen aan toe, legt vast wat al besloten is, en
geeft de eerste concrete opdracht. **Lees het voorstel eerst; herontwerp het
niet.**

Context die meeweegt: Imprint wordt niet gedemonstreerd op 14–15 september,
dus hier mag rustig aan gewerkt worden. De shared hosting (Quickhost/Plesk)
is verlaten omdat die Node.js heeft laten vallen; Imprint draait straks op
dezelfde VPS als Omnium (`vps1.paratmos.nl`, mijn.host, Ubuntu, Docker,
Caddy). Het argument "MariaDB omdat shared hosters dat bieden" is daarmee
vervallen.

## 2. Lees eerst, in deze volgorde

1. `CLAUDE.md` — werkafspraken (ContentStore-only, zod in content-core,
   docs + changelog per wijziging, versies via tags).
2. `docs/architecture.md` §1–§4 — wat er nu is, met name §4 bitemporal-light.
3. `docs/design/engine-instance-plugin-architectuur.md` — het voorstel;
   §2, §4, §7, §17, §18 zijn het minimum.
4. `docs/backlog.md`, item *"Engine en instanties werkelijk scheiden"*.
5. Deze brief.

## 3. Het uitgangsmodel — vier lagen

Marks formulering, naast de begrippen uit het voorstel:

| Laag (brief) | In het voorstel | Inhoud |
|---|---|---|
| **Engine** | core + runtime + admin + extension-API (§4.1–4.5) | contentcontracten, opslaghistorie, renderer, publieke API, de admin/studio ("editor-motor") |
| **Bibliotheek** *(nieuw begrip)* | extensions (§5–§6): `widgets-standard`, `plugin-*` — nog zonder verzamelnaam | widgets, plugins (bestaan nog niet als package) en **mogelijk** herbruikbare vormgevingen |
| **Backend** *(nieuw als eigen laag)* | zit nu impliciet in core (`FileContentStore`, `DbContentStore`) | opslagimplementaties achter het `ContentStore`-contract: file, MariaDB, **Postgres**, later het bitemporele register |
| **Site** | Imprint-instantie (§4.2, §19) | gekozen engineversie + gekozen bibliotheekonderdelen + gekozen backend + inhoud + eigen merk/SiteChrome/secrets |

De formule uit §19 blijft staan, alleen met de backend expliciet:

```text
Site = engineversie + bibliotheekkeuze + backendkeuze + instantieconfig
     + inhoud + eigen merk/SiteChrome + eigen DB/assets/secrets
```

## 4. Wat al besloten is (§18 van het voorstel — overnemen, niet heropenen)

- Gedeelde code, **aparte app en database per instantie**. Geen multitenant
  admin in deze fase.
- Beginnen met **composition root en dependency injection**, niet met
  bestanden verplaatsen.
- Eerst één `@imprint/runtime-admin`-package; splitsen als de grens
  aantoonbaar stabiel is.
- Plugins zijn **build-time** en onder ontwikkelaarscontrole; geen
  WordPress-installatiemodel.
- De Imprint-productsite is de tweede architectuurtest: wat alleen in
  MusicBrain werkt, is nog geen enginecode.
- Planning is de eerste proefplugin.

## 5. Te beslissen in de nieuwe sessie

Uit §17 van het voorstel, nog open:

- [ ] Blijven product/component/release voorlopig in core, of vroeg naar
      `plugin-catalog`?
- [ ] Standaardwidgets individueel kiesbaar, of één versieerbare bundel met
      uitsluitingen?
- [ ] Onbekende/uitgeschakelde widget: buildfout (huidig) of placeholder
      voor beheerders?
- [ ] Pluginconfig code-only, of ook gevalideerde beheerconfig als content?

Nieuw door deze brief:

- [ ] **Reikwijdte van de bibliotheek.** Horen vormgevingen erin? Voorstel om
      te toetsen: de bibliotheek levert *basisthema's/presets* (design-tokens,
      een neutrale SiteChrome), de instantie blijft eigenaar van haar eigen
      merk. Dus: herbruikbaar = bibliotheek, identiteit = site. Beslis ook of
      "bibliotheek" een package-groep is (`packages/library-*`) of alleen een
      naam voor de bestaande `widgets-standard` + `plugin-*`.
- [ ] **Backend als contractlaag, Postgres eerst.** Drie feiten uit de code:
      `db-store.ts` (370 regels) gebruikt drizzle zonder raw SQL; het schema is
      54 regels `mysqlTable`; er is één migratie. Een Postgres-implementatie
      is dus klein: een `pg-core`-schema naast het MySQL-schema, een store op
      `drizzle-orm/node-postgres`, een eigen migratiejournal per dialect.
      Winst: `jsonb` i.p.v. de MariaDB-JSON-als-LONGTEXT-omweg (`db-store.ts`
      regel 73), en `tstzrange`/exclusion constraints maken de stap van
      bitemporal-light naar echt bitemporeel klein. **MariaDB blijft**
      ondersteund via hetzelfde contract, voor wie het wil.
- [ ] **Vierde backend, later:** een `BitempContentStore` op de API van het
      bitemporele register (Omnium). Niet nu bouwen; wel zorgen dat het
      `ContentStore`-contract er niet aan in de weg staat (formele + materiële
      tijd als leesparameters). Zie Bitemporal_2026 `docs/BACKLOG.md` §27.2.

## 6. Eerste opdracht (afgerond en committeerbaar in kleine stappen)

**A. Fase 0 uit §12 — architectuurcontract.** Leg in `docs/architecture.md`
de vier lagen en hun afhankelijkheidsregels vast (site → engine, nooit
andersom; engine kent geen `musicbrain`; backend alleen via `ContentStore`).
Neem de besluiten uit §5 waar dat zonder Mark kan, markeer de rest als
vraag. Karakterisatietests voor het huidige gedrag van de store en de
renderer, zodat extractie later aantoonbaar niets verandert.

**B. Backend-spike — Postgres naast MariaDB.** In `packages/content-core`:
`db-schema.pg.ts` + `db-store.pg.ts` (of een dialect-parameter, kies wat de
kleinste diff geeft), `drizzle.config` per dialect, `docker-compose` krijgt
een Postgres-service naast MariaDB, en de bestaande store-tests draaien
tegen beide. Acceptatie: `sites/imprint` draait op Postgres met
`DATABASE_URL=postgres://…`, `sites/musicbrain` ongewijzigd op MariaDB.

**C. Pas daarna** Fase 1 (composition root, `imprint.config.ts` per site).
Niet eerder beginnen met bestanden verplaatsen.

Volgorde is bewust: A maakt de grenzen expliciet, B is klein en verlaagt het
risico van de bitemporele route, C is het echte werk en heeft A nodig.

## 7. Randvoorwaarden

- Alle werkafspraken uit `CLAUDE.md` gelden onverkort. Sites praten
  uitsluitend via `ContentStore`; schrijven alleen via `WritableContentStore`.
- Per stap: `npm run build` groen vanuit de root, regel onder
  `## [Unreleased]` in `CHANGELOG.md`, functioneel in `docs/handleiding.md`
  waar de redacteur iets merkt, technisch in `docs/architecture.md`.
- Live MusicBrain-data moet elke schemawijziging overleven met een
  controleerbaar migratiepad (§14 van het voorstel).
- Commit alleen op vraag; niet rechtstreeks op `main` voor substantieel werk.
- Doel-hosting: één VPS, Caddy ervoor, per site een eigen proces en database
  (zie Bitemporal_2026 `docs/VPS_DEPLOYMENT.md` §11); `imprint-engine.nl` is
  beschikbaar als domein voor de productsite.

## 8. Wat níet

- Geen centraal multitenant beheerportaal.
- Geen runtime-plugininstallatie.
- Geen big-bang verplaatsing van `/admin`; geen kopie van MusicBrain als
  "tweede engine".
- Geen migratie van MusicBrain naar Postgres in deze ronde — dat is een
  aparte beslissing zodra B bewezen is.

## 9. Klaar wanneer

De eerste iteratie is af als (1) `docs/architecture.md` de vier lagen en de
afhankelijkheidsregels bevat, (2) karakterisatietests groen zijn op de
huidige code, en (3) `sites/imprint` op Postgres draait terwijl
`sites/musicbrain` op MariaDB ongewijzigd doorbouwt — met changelog en
backlog bijgewerkt.

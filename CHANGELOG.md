# Changelog

Alle noemenswaardige wijzigingen aan de Imprint-engine. Formaat volgt losjes
[Keep a Changelog](https://keepachangelog.com/); versies volgen semver
(pre-1.0: **minor** = nieuwe capability, **patch** = fix). Zie
[docs/releasing.md](docs/releasing.md) voor het release-ritueel.

## [Unreleased]
- **Front bij een patch** (patch-pool): het item `patch` heeft een optioneel
  veld `front` (asset, SVG): de speelkant van de patch zoals de MusicBrain-
  editor hem tekent (MusicBrain `doc/plans/patch-front.md` §7). De editor
  stuurt hem mee bij `POST /api/patches` (`front: "asset:…"`); `GET
  /api/patches` geeft `front` en `frontUrl` terug; de patchpagina toont hem
  als hoes boven de knoppen en de lijsten als kaartbeeld.
- **Privé-patches** (patch-pool): een vijfde pool `prive` voor patches die
  je voor jezelf bewaart. Inzenden met `kind: "private"`; alleen de inzender
  (en de redactie) ziet ze, ook via `GET /api/patches?pool=prive`; niet in
  zoeken of de openbare lijsten. `PATCH /api/patches/<slug>` met `kind:
  proposal | question` maakt er een voorstel of vraag van, alleen door de
  eigenaar en nooit hoger. CORS-origins van MusicBrain komen uit
  `MUSICBRAIN_MEDIA_CORS_ORIGINS` op de VPS.

## [0.14.0] - 2026-10-02
- **Leden zien elkaar** (G2b): op de pagina van een community staat voor
  leden de sectie *Leden* (namen en rollen, geen adressen); op het
  communities-overzicht staan je eigen communities bovenaan. Beide als
  eiland, de pagina's blijven statisch; de PDP beslist over de ledenlijst
  met de leesregel voor groepsinhoud (`access: group:<slug>`).
- **Leden plannen evenementen** (G3a+): op de pagina van een community
  staat onder *Agenda* "+ Evenement plannen" voor leden (titel, begin en
  einde in Nederlandse tijd, plaats, online, aanmelden, zichtbaarheid,
  beschrijving); op de pagina van het evenement "bewerken" en "verwijderen"
  voor wie het maakte (beheerders: verwijderen). Dezelfde ledenregel in de
  PDP als voor berichten; `event.author` is erbij gekomen. Evenementen
  alleen voor leden staan op de (statische) communitypagina via het eiland.
  De groepen-plugin kent de evenementen-plugin niet: de site geeft het
  eiland mee (`groupsPlugin({ agendaTools })`).
- **Berichten van leden, rijker** (G3a+): op de berichtpagina zelf staan
  voor de schrijver "bewerken" en "verwijderen" (beheerders: verwijderen);
  het formulier heeft de rijke editor (Visueel / Markdown) en een beeld
  bovenaan het bericht. Leden uploaden hun beeld zelf: `uploadImage` zet het
  via de upload-kern in de bibliotheek (map `communities/<groep>`), met
  dezelfde ledenregel in de PDP als voor een bericht; alleen rasterbeelden,
  hooguit 10 MB. `ingestFiles` kreeg daarvoor `policy` (eigenschappen voor
  de PDP) en `kinds`; de Markdown-editor een `pickImage`-prop. De site
  hangt `PostTools` boven een bericht (`ItemTools`), zoals de reactiedraad
  eronder.
- **Pleio-bestanden in de bibliotheek** (showcase): `npm run
  import:pleio-files --workspace=commonground` haalt de bestanden en
  beelden op waar de geïmporteerde inhoud naar linkt (1.200 stuks), zet ze
  via de gewone upload-kern in de beeldbibliotheek (map `pleio`, met de
  herkomst in `source`) en herschrijft de links naar `asset:<slug>`;
  `import:pleio` houdt die verwijzingen daarna vast. Herhaalbaar: wat er al
  is wordt niet opnieuw gehaald. `deploy.sh import-pleio-files <site>`
  draait het op de VPS, als de gebruiker en op het volume van de site.
  De upload-kern neemt per bestand een gewenste slug, titel en herkomst aan
  (`@imprint/runtime-admin/media-ingest`); beeldvelden van berichten,
  evenementen en groepen tonen ook `asset:`-verwijzingen (`mediaSrc`).

## [0.13.0] - 2026-10-02
- **Dagelijkse mededelingen-mail** (G3c stap 2): één mail per lid per dag
  met wat er sinds de vorige mail in zijn postvak kwam (titels met links,
  link naar het postvak, afmeldlink met eenmalig token). Voorkeur per lid
  (`users.digest`, migratie 0005; vinkje op *Mijn account*); zonder
  bevestigd adres of met "uit" wordt niets gestuurd en loopt er ook niets
  op. `POST /api/digest` (ingest-token) is de wekker; `deploy.sh digest
  <site> [--dry]` roept hem aan vanuit cron.
- **Patch-pool** (`@imprint/plugin-patches`, MusicBrain
  `doc/plans/patch-pool.md`): contenttype `patch` (het `.patch.json` en de
  `.syx` als library-assets, demo-takes als groepen, `requires`, `derivedFrom`
  als relatieregel, licentie CC BY 4.0 / CC0, pool `voorstel` ·
  `experimenteel` · `centraal` · `vraag`); `POST /api/patches` voor de editor
  (token met de nieuwe scope `patch:propose`; het lichaam zegt alleen
  `kind: proposal | question`, de PDP maakt er een voorstel van), `GET
  /api/patches?pool=&tag=&slug=`; pagina's `/patches`, `/patches/lab`,
  `/patches/vragen`, `/patches/<slug>` met demo (de take-widget van de site),
  downloads, "Open in de editor", vereisten en stamboom. Beleid in de kern:
  toegangsniveau **`private`** (de auteur en de redactie — een voorstel, een
  concept) en de regel *een voorstel maak je als jezelf; eigen werk blijft
  bewerkbaar zolang het een voorstel is*. `access` volgt `pool` in het
  schema; `centraal` eist CC0.
- **Mededelingen** (G3c, stap 1: het postvak): een lid hoort het als iemand
  reageert op zijn bericht of een kanttekening maakt, zijn reactie
  beantwoordt, een bericht wijzigt waar hij op reageerde of een
  kanttekening bij maakte, in zijn community schrijft, of zijn verzoek om
  lid te worden beslist; beheerders horen van verzoeken. De bel in de
  balk telt wat nieuw is, `/account/notifications` toont de lijst en
  markeert gelezen. Tabel `notifications` in de user store (migratie 0004,
  beide dialecten), `notify/notifyGroup/notifyManagers` in
  `runtime-admin/admin-server`, de plugin-haak `onItemChanged` plus
  `itemChanged()` zodat de annotatieplugin hoort dat een item wijzigde.
  Een annotatie onthoudt de pagina waarop ze gemaakt is (`source.href`).
  De maildigest is stap 2.

## [0.12.0] - 2026-10-01
- **Kanttekeningen in de kantlijn** (annotaties, stap 2): selecteer een
  passage in de tekst van een bericht, wikipagina of term → "Annoteren" →
  een ballon naast de passage (op smalle schermen een lijst onder de
  reacties); de passage is gemarkeerd (CSS Custom Highlight API, geen
  DOM-ingrepen), klikken erop licht de ballon op. Opgeslagen als W3C
  `TextQuoteSelector` + `TextPositionSelector` op het veld `body`;
  bij het tonen opnieuw verankerd in de huidige versie (`anchor.ts`, puur
  en getest: citaat, context en positie — nooit raden). Niet meer gevonden
  = "Bij een eerdere versie van de tekst", met het citaat. Per type aan te
  zetten (`targets: { post: { allow: "members", inline: true } }`); de
  viewer markeert zijn tekstveld met `data-annotation-field`.
  De markering is een thematoken (`--annotation-mark`, `-active`, `-draft`)
  met eigen waarden voor het donkere thema.
- **Reacties als annotaties** (`@imprint/plugin-annotations`, design
  [annotaties.md](docs/design/annotaties.md)): het contenttype `annotation`
  volgt het W3C Web Annotation-model (`target[]` met `source`, `field`,
  `selector[]` en `state` = de versie van toen; `body[]` als tekst of asset;
  `motivation`), in de kern als `annotation-model.ts`. Stap 1: de draad
  onder berichten, evenementen, termen en wikipagina's (pagina's zetten het per
  item aan met het veld `annotations`): reageren, beantwoorden, eigen
  reactie bewerken ("bewerkt" met eerdere versies) en verwijderen,
  beheerders en groepsbeheerders verbergen (een versie), en "de tekst is
  sindsdien gewijzigd" als het item na de reactie veranderde. Wie mag
  reageren is beleid: één generieke regel in de PDP ("maak iets óp een item
  dat je mag lezen, als dat item het toelaat"), gevraagd door het scherm én
  door de schrijfactie via `permit`. `PublicRouteResult.item` laat een
  plugin-route zeggen welk item ze toonde, zodat de site er iets onder kan
  hangen.
- **Eigen bericht bewerken** (groepen): "bewerken" bij je eigen berichten op
  de community-pagina opent hetzelfde formulier, vooringevuld; opslaan is een
  nieuwe versie met dezelfde slug. De regel in de PDP is nu generiek: een lid
  maakt in zijn eigen groep als zichzelf (`author`), houdt wat hij schreef
  bewerkbaar en verwijderbaar, en een beheerder verwijdert alles in zijn
  groep — voor elk type waar een plugin leden een formulier voor geeft.
- **Zoeken in de kern**: elk contenttype beschrijft zelf hoe het gevonden
  wordt (`ContentTypeDefinition.search`: soorten met voorvoegsels, en de
  documenten), de engine zoekt (`search()` in content-core: voorvoegsels
  zoals `community: archi`, `groep: arch`, `blog: togaf`, `term: api`,
  `agenda: fieldlab`, `wiki: register`; elke term moet voorkomen;
  titeltreffers eerst) door de store van de bezoeker, dus alleen wat die mag
  zien; `SearchPage` in runtime-admin is de standaardpagina die een site in
  zijn chrome zet. Pagina's (kern), posts (blog/nieuws/update), evenementen,
  communities, termen en wikipagina's doen mee; een nieuwe plugin zoekt mee
  door een `search`-blok op zijn type. De showcase gebruikt dit op `/search`.
- **Themakiezer als palet** (showcase): een knop die een paneeltje met
  tegels opent (kleurstaal per thema) in plaats van een keuzelijst; het menu
  past weer op één regel.
- **Leden schrijven zelf (G3a van communities.md)**: een actief lid plaatst
  vanaf de community-pagina een update of blog ("Schrijf een bericht"),
  voor de leden of voor iedereen, en verwijdert zijn eigen berichten; de
  beheerders van de community verwijderen elk bericht erin. De regel zit in
  de PDP (`create` op `post` in een eigen groep; `update`/`delete` van eigen
  werk; `delete` door wie de groep beheert — het subject draagt nu ook
  `manages`), niet in de UI.
- **Nieuws** (plugin-blog): een bericht kan `kind: news` zijn, met
  `featured` ("Uitgelicht") en `source` (bronlink); overzicht op `/news`; de
  widget `posts` kent `kind: news` en `featuredOnly`. De showcase importeert
  de 312 publieke nieuwsberichten; "Uitgelicht nieuws" en de nieuwsfeeds
  komen nu uit de eigen database in plaats van te verwijzen naar Pleio.
- **Updates in groepen** (plugin-blog): een bericht heeft een `kind`: `blog`
  of `update` (Pleio's status update, het korte bericht in de tijdlijn van
  een groep). Updates staan op de groepspagina en niet in `/blog`; de widget
  `posts` kiest met `kind`. De showcase importeert de 135 publieke updates
  per groep (titel = de eerste zin).
- **Aanmelden voor evenementen (agenda, stap b)**: leden kiezen op een
  evenement *ik kom / misschien / ik kom niet* (met de privacytekst erbij; de
  keuze is de toestemming), met een teller, een maximum (`maxAttendees`:
  "vol") en intrekken; de aanmeldingen staan op `/account`. De organisatie
  (redactie, of de beheerders van de groep van het evenement) ziet op
  `/events/<slug>/attendees` wie komt, met e-mailadres en een mailto-knop.
  In de kern: tabel `attendances` (beide dialecten) en
  `UserStore.attend/withdraw/attendeesOf/attendancesOf`; de testsuites
  ruimen nu ook de ledentabellen op vóór de migraties.
- **plugin-events (agenda, stap a)**: evenementen als contenttype (`event`:
  begin, einde, plaats, adres, links, organisatie, online, herhaling als
  tekst, tags, groep, beeld), de widget `events` (eerstvolgende van de site,
  een groep of een tag), de agenda `/events` (komend per maand, daarna
  "Eerder") en een pagina per evenement op `/events/<slug>`; een groepspagina
  toont haar komende evenementen. De showcase importeert de 315 publieke
  evenementen; "Agenda" in het menu is nu intern. Aanmelden volgt (stap b).
- **plugin-blog**: berichten als contenttype (`post`: titel, samenvatting,
  tekst, schrijver, datum, tags, groep, beeld), de widget `posts` (laatste
  berichten van de site, een groep of een tag), het overzicht `/blog` en
  een pagina per bericht op `/blog/<slug>`; een groepspagina toont haar
  berichten. De showcase importeert de 254 publieke blogs uit Pleio.
- **Drie zichtbaarheidsniveaus (G2 van communities.md)**: `access` kent naast
  `public` en `restricted` nu `group:<slug>`; de ingelogde gebruiker draagt
  zijn actieve groepen mee (`userSubject(name, role, groups)`), de
  in-process PDP laat groepsinhoud alleen aan die leden (en de redactie)
  zien. De admin biedt de groepen aan in het toegangsveld (itemeditor,
  studio, wiki-studio). De showcase heeft `/members/…`: niet-publieke
  inhoud per verzoek voor de ingelogde bezoeker; de publieke route stuurt
  ernaartoe, niet ingelogd gaat eerst naar de login.
- **Wachtwoord vergeten**: `/account/forgot` mailt een eenmalige link (2 uur),
  `/account/reset` zet het nieuwe wachtwoord; het antwoord verraadt niet of
  een adres bekend is, en de snelheidsgrens per IP geldt per doel.
- **Leden (G1 van communities.md)**: zelf registreren met e-mailadres en
  wachtwoord, bevestiging per maillink (eenmalige tokens), inloggen op de
  site zelf met naam of e-mailadres (`/account/login`), een accountpagina
  met je communities. In de kern: `email` op users, tabellen
  `email_tokens`, `memberships` en `invites` (migraties voor beide
  dialecten), `UserStore.register/verify/join/setMembership/createInvite/…`,
  en `mail` in `imprint.config.ts` (SMTP via nodemailer, design/mail.md).
- **Lid worden van groepen** (plugin-groups): open of op aanvraag; de
  beheerpagina `/groups/<slug>/manage` (aanvragen goedkeuren, leden en
  rollen, uitnodigingslinks van 30 dagen); `/groups/<slug>/join/<code>`
  maakt wie inlogt meteen lid. Pagina's blijven vooraf gerenderd: de knop
  vraagt in de browser wie er kijkt (`PublicRouteContext.call`).
- **MusicBrain-actualisatie (verzoek MusicBrain, 2026-09-30)**: homepage
  vertelt het platformverhaal (browserinstrumenten, gedeelde DSP op een
  Teensy, hybride hardware; analoog/digitaal-onderscheid, recall onder
  voorwaarden) met "Open the editor" + "Get started"; de footer toont alle
  `site.links` met eigen labels (source/docs/firmware/issues/editor); de
  header-navigatie wrapt op mobiel (was horizontale overflow). Seedcontent
  bijgewerkt: juiste GitHub-links, nieuwe pagina's `get-started` en
  `devlog`, herschreven About/Editor/Planning en producttekst van
  Cortex/Reflex/Relay zonder universele claims.
- **Productstatus `concept`**: nieuwe eerste fase vóór `in-development`
  (idee/architectuur, nog geen geverifieerd ontwerp), met eigen badge;
  Relay staat erop. Seed: release `firmware-0.5.78` (download van GitHub) en
  de placeholder-tekst van `simulator-0.1.0` vervangen.
- **Hardware terug op de productpagina's**: Cortex koppelt nu alle 16
  componenten van release v0.3 (busboard, functiekaarten, panelfronten,
  risers, matrix, FPGA voice, editor) en Reflex zijn drie borden + editor,
  zodat de `components`-widget ze met board-spec toont; de Cortex-tekst
  beschrijft de fysieke unit (Eurorack of standalone).
- **Widget `assembly` (MusicBrain)**: de hardware-unit zet zichzelf in 3D in
  elkaar — board-specs vliegen via hun KiCad-GLB (de "3D"-tab) op een
  tijdlijn naar hun plek, het frontpaneel wordt uit zijn SVG geëxtrudeerd
  (gaten incl.), rails erbij; play/pauze, scrubben, rondkijken, optioneel
  muziek (start alleen op klik). three.js lazy geladen in een client-eiland;
  coördinaten volgen `MusicBrainAssembly.FCMacro` zodat dezelfde choreografie
  een Blender-render kan sturen. Eerste choreografie op `/cortex`. Met
  `hold` (unit blijft aan het eind staan, trekt dan rustig uit elkaar en
  begint opnieuw) en `panel.accessories` (display, MIDI-DIN, USB-C, knoppen
  uit de paneeltekening, mee met het paneel; `audio`-gaten worden
  paneelbussen). Paneel **concept v3, 48 HP** (besluit 1 okt): breder dan
  het busboard, kolommen boven de echte slots (gemeten), jacks op 13,75 mm
  door de gaten, codec-audio rechts; 40 HP-schets met staand display bewaard.
- **Montagevideo (route A)**: `scripts/assembly-render/render_assembly.py`
  rendert met Blender dezelfde choreografie (page-config, board-spec-GLB's
  uit de site-API, paneel-SVG met accessoires) naar mp4 en mengt met ffmpeg
  een take eronder; `--stills` voor een snelle controle. README erbij.
- **plugin-groups (G0 van communities.md)**: groepen als contenttype (`group`:
  naam, samenvatting, introductie, tekst, beeld, tags, besloten/op aanvraag,
  wiki, ledental), de widget `groups` (kaarten met zoekveld), het overzicht
  `/groups` en een pagina per groep op `/groups/<slug>` met haar wiki en
  pagina's (`groups/<slug>/…`). Lid worden volgt (G1).
- **Common Ground-showcase: groepen**: `import:pleio` neemt de 41 zichtbare
  communities over, per groep één wiki (8) en de groepspagina's; "Onze
  communities" is de groups-widget, "Community" in het menu gaat naar
  `/groups`.
- **Engelse routes met Nederlandse aliassen**: plugins en routes heten
  Engels (`/groups`, `/terms/<slug>`, `/search`); de site-`aliases`
  (`groep`, `term`, `zoeken`) sturen door, met de query mee.
- **Thema's met breedte**: `ThemeSchema` kent `layout.width` (de breedte van
  de inhoudskolom, als CSS). De Common Ground-showcase heeft vier thema's
  (Common Ground, breed, Donker, Zonnig) met een keuzelijst in de header; de
  huisstijl loopt nu via de themakleuren, het logo kleurt mee.
- **Wiki-boom inklapbaar** (plugin-wiki, ook MusicBrain): mappen klappen in,
  alleen de eerste laag en het pad naar de huidige pagina staan open, met
  "Alles uitklappen"; een map met een gelijknamige pagina linkt daar zelf
  naartoe in plaats van hem nog eens te tonen.
- **Plugintypen altijd actief**: zet een site `contentTypes` (de keuze uit de
  kerntypen), dan zijn de typen van haar plugins en haar eigen definities er
  toch bij; voorheen gaf bv. `/admin/term` een 404 tot je ze er zelf bij zette.
- **plugin-glossary**: termen als contenttype (`term`: titel, samenvatting,
  tekst, tags), de widget `glossary` (kaarten met zoekveld, optioneel één
  tag) en een pagina per term op `/term/<slug>`.
- **Common Ground-showcase: wiki en termen**: `import:pleio` neemt ook de
  wiki van de groep "Common Ground publicatiesite" (39 pagina's, via
  plugin-wiki) en de 124 termen (plugin-glossary) over; links tussen
  pagina's, wiki en termen wijzen naar de Imprint-paden. Footerkaarten even
  hoog met de knop onderaan.
- **Showcase: Common Ground op Imprint** (`sites/commonground`, poort 3300):
  de vormgeving van commonground.nl (logo, menu met uitklapmenu's, zoeken,
  mededelingen, avatar van de ingelogde gebruiker, lichtblauwe footer met
  kaarten, potlood naar de studio) op de engine, met de publieke pagina's,
  het menu en de footer uit Pleio via `npm run import:pleio` (GraphQL,
  TipTap → Markdown, Pleio-rijen → Imprint-layout). Menu en footer zijn
  gewone content; `/zoeken` doorzoekt de pagina's. Op de VPS als
  `commonground` (`./deploy.sh import-pleio commonground`).
- **V3 model diagram getekend door Omnium**: met `OMNIUM_URL` haalt de
  `v3model`-widget de SVG bij Omnium (render-API): een model in Omnium op naam
  + versie + `asOf`, of geplakte/opgehaalde modelcode; weergave als opgeslagen
  diagram of één domein, plus `entiteiten`, `richting`, `afhankelijkheden` en
  `kleuren` (licht als figuur, of het sitethema). De SVG gaat gesaneerd
  (allow-list, `svg-sanitize.ts`) inline in de pagina; Omniums foutmelding
  (met het foute element, of de beschikbare diagrammen/domeinen) staat in de
  widget. Zonder `OMNIUM_URL` blijft de tijdelijke eigen tekenaar.
- **Eigen editor voor V3 model diagram**: eerst "welk model" (Omnium-model,
  code plakken of URL — alleen die velden zichtbaar), dan "wat tonen" als
  keuzelijst van de diagrammen en domeinen (uit Omnium of uit de geplakte
  code), kleuren, en de fijnafstelling ingeklapt onder "Meer"; knop om de
  huidige Omnium-versie vast te zetten.
- **Studio: leesbare fout bij opslaan** — een validatiefout (bv. een pagina
  zonder titel) staat er nu als `title: Too small: …` in plaats van als
  zod-JSON.

## [0.11.0] - 2026-09-29
- **SysEx (.syx) in de bibliotheek**: soort `data`, mime `application/x-sysex`,
  herkend aan de bytes (berichten F0 … F7 achter elkaar, databytes < 0x80);
  het detailpaneel toont het aantal berichten en het fabrikant-ID. Een take
  krijgt zo ook zijn patch als .syx in dezelfde groep (patch-editor).
- **Security-updates** (`npm audit`: 19 kwetsbaarheden, 1 kritiek → 9, alleen
  dev-tooling en eigen content). `next` 16.2.10 → 16.3.7 in beide sites (RCE in
  de Image Optimization API, server-action-DoS/SSRF, cache confusion),
  `sharp` 0.34 → 0.35.5 (libvips/libheif; de types zijn nu benoemde exports —
  `Exif`/`Metadata`), `drizzle-orm` 0.44 → 0.45.3 (SQL-injectie via
  identifiers), `eslint-config-next` mee, daarna `npm audit fix` (zonder
  `--force`: mysql2, postcss, js-yaml, nanoid, browserslist).
- **Fix (live): verkeerde adressen achter Caddy.** De ref-doorverwijzing voor
  bibliotheekbeelden in markdown en de absolute URL's uit `/api/media` wezen
  naar `http(s)://0.0.0.0:3000/…` (het eigen luisteradres van de server). De
  doorverwijzing is nu relatief; de API-URL's komen uit `X-Forwarded-Host`/
  `-Proto` of `Host` (`publicOrigin`).
- **Take-widget** (MusicBrain), samen met de patch-editor gebouwd: kies in de
  studio de wav van een opname; de .mid van dezelfde opname wordt een
  pianorol die de audio bedient (afspelen, springen, lusvenster, toetsen bij
  focus), in de kleuren van het thema, met duur en downloadlinks eronder. De
  rol is gekopieerd uit de editor (commit `44f2562`, zie de README).
- **`PUT /api/media/<slug>`**: de editor zet een aangepaste .mid terug in de
  bibliotheek — nieuwe versie van hetzelfde asset (historie blijft), zelfde
  soort vereist (415 anders). `GET /api/media` geeft `created` en `updated`.
- **Live: bestanden in MinIO** (29 september). Deploy van alles sinds
  `8bc9a95` naar musicbrain.nl en imprint-engine.nl; daarna een eigen MinIO
  op de VPS, buckets per site, MusicBrain's 389 bestanden verhuisd en beide
  sites omgezet (gecontroleerd: MinIO ziet de leesverzoeken, Range werkt).
  De nachtelijke backup neemt het MinIO-volume mee.
- **VPS: eigen MinIO voor Imprint** (besluit Mark). Dienst `minio` in de
  compose (alleen `imprint_net`, console via tunnel op 127.0.0.1:9011, start
  alleen als een site een S3-endpoint heeft); `deploy.sh s3-setup <site>`
  (bucket + gebruiker die alleen die bucket mag) en `deploy.sh s3-move <site>
  [--apply]` (volume → bucket). Draaiboek in `docs/deploy-vps.md`.
- **Fix: 500 op audio- en databestanden in een lopende dev-server** na de
  overstap op de nieuwe opslag. De bewaarde instantie hield het oude
  opslagobject (zonder `stat`/`read`). In dev krijgt de instantie nu een
  stempel van de nieuwste engine-broncode, en de vingerafdruk telt ook waar de
  bestanden staan (schijf/bucket) — na een engine-wijziging is er vanzelf een
  verse instantie, zonder herstart. Een onverwachte fout in `/api/assets`
  geeft nu een 500 mét CORS-header (de editor kan de status lezen) en wordt
  gelogd. Slugs uit bestandsnamen mogen 100 tekens lang zijn (de tijdstempel
  van een take-id blijft heel).
- **Bestanden in MinIO** (beeldbibliotheek stap 7). Nieuwe `S3AssetStore`
  naast de schijf-store; een site gebruikt zijn eigen bucket zodra
  `ASSET_S3_ENDPOINT/_BUCKET/_ACCESS_KEY/_SECRET_KEY` gezet zijn, anders
  schijf. URL's in content veranderen niet; serveren, toegang per formaat,
  Range en CORS werken hetzelfde (hele browsersuite groen op een bucket).
  `npm run assets:to-s3` verhuist bestaande bestanden (droog, dan
  `-- --apply`). Lokaal: buckets `imprint-musicbrain` en `imprint-imprint`
  in de bestaande MinIO, elk met een gebruiker die alleen zijn bucket mag;
  alle bestanden verhuisd. VPS: compose en `.env.example` voorbereid, runbook
  in `docs/deploy-vps.md`; welke MinIO daar is nog een beslissing.
- **Nieuwe teksteditor (TipTap)** — beeldbibliotheek stap 6. Overal waar je
  opgemaakte tekst schrijft: vet, cursief, koppen, lijsten, citaat, code,
  link, scheidingslijn, ongedaan maken, sneltoetsen en markdown-achtig typen,
  plus een **afbeeldingknop** die de bibliotheekkiezer opent (alt-tekst uit de
  bibliotheek). Opslag blijft markdown; een bibliotheekbeeld wordt
  `![alt](asset:<naam>)`, en de site toont het via een korte doorverwijzing
  (`/api/assets/_ref/<naam>`) naar de publieke versie — in álle markdown
  (tekst, paginatekst, wiki, planning). De tab *Markdown* blijft.
- Onderhoud: regexen met diakrieten gebruiken weer `\u0300-\u036f`-escapes in
  plaats van onzichtbare tekens (ook in de wiki-plugin).
- **Beeldbibliotheek stap 5: snel laden en focuspunt.** Bibliotheekbeelden
  krijgen `srcset`/`sizes` (alleen publieke versies), `width`/`height` (geen
  verspringende pagina) in Image, Hero, Media & text, Gallery, Carousel,
  lightbox, logo's en personen. Een **focuspunt** klik je op de foto in de
  bibliotheek; waar een beeld wordt bijgesneden (hero-achtergrond,
  galerijtegels, avatars) blijft dat punt in beeld. Beelden met een gewone
  URL veranderen niet.
- **Bestanden lezen vanaf toegestane origins**: `/api/assets/…` krijgt dezelfde
  CORS-allowlist als `/api/media` (alleen lezen, zonder cookies, Range
  toegestaan), zodat de patch-editor een take (.mid, .patch.json) met
  `fetch()` kan inlezen. Wat een bezoeker niet mag zien blijft 403.
- **Kiezen uit de bibliotheek** (beeldbibliotheek stap 3). Elk beeld- en
  bestandsveld heeft een kiezer (voorbeeld, *Choose from library* met zoeken,
  mappen en uploaden, *Clear*), in gegenereerde formulieren én de galerij-,
  carrousel- en bordeditor; productfoto's worden een lijst kiezers. Opgeslagen
  wordt `asset:<naam>` (een gewone URL blijft werken); de site toont de
  grootste publieke versie met alt-tekst en bijschrift uit de bibliotheek (die
  van de widget gaan voor). **Used in** in de bibliotheek, met een
  waarschuwing bij verwijderen. `npm run media:refs` zet oude links naar
  bibliotheekbestanden om. Velden: `assetSrc()` in content-core; viewers via
  `resolveMedia()`.
- Fix (studio): direct na *Add widget* toonde de zijbalk even de
  pagina-instellingen, tot de nieuwe widget van de server binnen was — een
  snelle klik kwam dan in het verkeerde formulier. Nu: "Loading widget…".
- Fix: een typefout in de browsertest van de media-API (Buffer als BlobPart).
- **Media-API voor programma's buiten de admin** (beeldbibliotheek stap 4,
  design §12.4). `POST /api/media` (multipart: `file[]`, `folder`, `tags[]`,
  `group`, `exif`) en `GET /api/media?folder=&tag=&group=`, met een
  **persoonlijke API-token** (`Authorization: Bearer`), scopes
  `media:upload`/`media:read` bovenop de rechten van de gebruiker, en een
  **CORS-allowlist** per site (`media.cors` in `imprint.config.ts`;
  MusicBrain: `https://editor.musicbrain.nl`, extra via `MEDIA_CORS_ORIGINS`).
  Uploads zijn alles-of-niets (413 te groot, 415 onbekend type). Tokens maak,
  bekijk en trek je in onder je account; alleen een SHA-256 wordt bewaard
  (nieuwe tabel `api_tokens`, migratie voor MariaDB én Postgres). Eerste
  gebruiker: de patch-editor (opname = wav + mid + patch als één groep).
- Mappen in de bibliotheek heten voor schermlezers naar hun volledige pad
  (twee mappen `opnames` op verschillende plekken zijn nu te onderscheiden).
- **Taglijsten bewerken**: tag hernoemen (typfout; bestanden gaan mee, naar
  een bestaande tag = samenvoegen), tag of hele lijst verwijderen (ook van de
  bestanden), lijst hernoemen — via ✎ in de bibliotheek.
- Fix: het detailpaneel van de bibliotheek hield na een wijziging elders (tag
  hernoemd, groep verplaatst) de oude waarden vast, en Save zou die
  terugschrijven. Het leest nu opnieuw in zodra het record verandert.
- **Fix: een draaiende dev-server bleef na een schemawijziging het oude
  contentmodel gebruiken** ("Unknown content type \"taglist\""). De instantie
  wordt per id bewaard (één databasepool over hot reloads heen); de sleutel
  bevat nu ook een vingerafdruk van contenttypen, schema's, plugins en
  widgets. Verandert die, dan komt er een verse instantie en sluit de oude na
  een minuut. Productie houdt één instantie.
- **Beeldbibliotheek, stap 2** (design/beeldbibliotheek.md §10, §12).
  **Taglijsten** als kern-contenttype, beheerd vanuit de bibliotheek (lijst
  maken, tag toevoegen, taggen per lijst of vrij), met filteren op tags,
  soort, camera, lens en locatie. **Nieuwe bestandssoorten** audio (WAV: duur,
  samplerate, bitdiepte, kanalen, afspelen in het paneel) en data (MIDI,
  JSON), herkend aan de inhoud, met een **limiet per soort** in
  `imprint.config.ts` (`media.maxBytes`; te groot = 413). **Groepen**: bestanden
  die bij elkaar horen (een opname: wav + mid + patch) worden één kaart;
  verplaatsen en verwijderen gelden voor de hele groep ("as one group" bij
  uploaden). Onder de motorkap: één upload-kern `ingestFiles` los van HTTP
  (voorbereiding op de externe API voor de patch-editor) en serveren met
  streams en HTTP Range. 10 nieuwe unit-tests, browsertests voor taglijsten
  en een opname als groep.
- **Architectuur- en productreview** (28 september 2026): codeonderbouwde
  beoordeling van kwaliteit, robuustheid, performance, webstandaarden en
  positionering in `docs/review-2026-09-28.md`, met verificatieresultaten en
  vervolgpunten in de backlog. Aangevuld met de letterlijke chatreview en
  bredere positionering: open source, React/TS, eigen WordPress-sites en
  fotografieportfolio's. `docs/design/opdracht-review-doorontwikkeling.md`
  geeft een architect/bouw-agent concrete onderzoeksopdrachten en
  acceptatiecriteria voor de Go-backend, migraties en mediapresentatie,
  aansluitend op de bestaande mediabesluiten. Geen wijzigingen aan
  applicatiegedrag.
- **Beeldbibliotheek, stap 1** (design/beeldbibliotheek.md). Nieuw
  kern-contenttype `asset` en het scherm **Content → Media**: uploaden met
  knop of slepen, mappen als een bestandssysteem, detailpaneel met alt-tekst,
  credit, licentie, bron, tags en toegang. Bij upload: type herkend aan de
  bytes (niet de extensie), EXIF uitgelezen (camera, lens, belichting,
  datum, fotograaf; locatie alleen op verzoek), WebP-webversies van 400–2400 px
  (nooit groter dan het origineel), met een EXIF-beleid per upload (alles /
  zonder locatie / niets); het origineel blijft onaangeroerd. **Toegang per
  formaat**: publiek tot een in te stellen breedte, grotere versies en het
  origineel alleen voor redacteuren — afgedwongen in de serveerroute via de
  PDP. Beide sites hebben de bibliotheek (`/admin/upload`, `/api/assets/…`
  via de engine). Browsertest van upload tot toegangscontrole over HTTP.
- Fix: de karakteriseringstest van de Imprint-site pinde nog de oude negen
  widgets.
- **Achttien nieuwe standaardwidgets** (design/plank-widgets-en-plugins.md
  §2): `quote`, `code` (shiki, server-side, licht/donker via `light-dark()`),
  `mermaid` (client-island, lazy), `v3model` (het V3-metamodel als SVG-schema:
  domeinkleur, `positie` of raster, relaties/overerving), `tabs`, `cards`,
  `buttons`, `logos`, `toc` (leest de koppen van de pagina; markdown-koppen
  krijgen nu een `id`), `breadcrumb` (de `WidgetContext` kent nu `page`),
  `audio`, `pdf`, `file`, `timeline`, `mediatext`, `people`, `testimonial`,
  `pricing`. Beide sites hebben ze in de catalogus; goldens per widget.
- **Plank**: `docs/design/plank-widgets-en-plugins.md` — de brainstorm over
  widgets/plugins elders, de bronnen-laag (views op andere data, SSRF-
  allow-list), agenda-standaarden (iCalendar/CalDAV), zoekopties, AI, backup
  en de beeldbibliotheek als kernfunctie.
- **Studio: meer ruimte voor het canvas.** Het instellingenpaneel klapt in
  (« / ») zodat de pagina op ware breedte te zien is; een klik op een widget
  klapt het weer uit. Ook het itemspaneel van de admin zelf klapt in («, of
  het actieve icoon in de activiteitenbalk; de browser onthoudt het), en de
  studio valt buiten de leesbreedte-kap van de admin — samen krijgt het
  canvas zo bijna het hele scherm. **View page ↗** in de bovenbalk opent de opgeslagen
  pagina op de site in een nieuw tabblad. De specs-strook (1 · 2 · 8) volgt
  de breedte van zijn vak in plaats van het scherm: in een smal vak stapelen
  de cijfers netjes.
- **Fix: de header van de Imprint-site liep in de studio over de admin heen.**
  De header is `position: absolute` (hij zweeft over de hero); de
  canvas-omlijsting van de site is nu de positionerende ouder met een eigen
  stapelcontext, zodat hij bovenin het canvas blijft.
- **Fase 6, eerste slice (hardening).** Een verkeerd geconfigureerde plugin
  faalt bij het opstarten met een bruikbare fout: ongeldige naam, ontbrekende
  versie, twee keer geconfigureerd, of een contenttype dat al bestaat (de
  fout noemt de plugin). `npm test` begint met een grenscontrole
  (`scripts/check-boundaries.mjs`): geen package importeert uit een site, en
  `content-core`/`extension-api` blijven vrij van React en Next. Het
  admin-dashboard toont onder **Extensions** de actieve plugins met versie,
  contenttypen en wat ze leveren.
- **Fase 5 af — stap 5, de exitproef.** De Imprint-site draait met
  `plugins: []` en kent planning noch wiki: niet in het menu, `/admin/planning`,
  `/admin/wiki` en `/help` zijn 404, het modeloverzicht toont de typen niet
  (Playwright-doorloop tegen de productiebuild, zonder console-errors).
  MusicBrain met beide plugins: 39 browsertests groen in productie en dev.
  Daarmee is het exitcriterium van het revisievoorstel gehaald: een
  capability is volledig plugin en is in een instantie weg te laten zonder
  enginecode te wijzigen.
- **Fase 5, stap 4: de wiki als plugin.** `@imprint/plugin-wiki` bevat de
  drie contenttypen met relatieregels (en de legacy-afbeelding van
  `visibility`), de boomstudio onder `/admin/wiki`, de acties (verplaatsen,
  verwijderen, publiceren naar live) en de publieke route: de derde haak.
  De publieke catch-all en `/members/…` vragen nu eerst de plugins
  (`pluginPublicRoute`): in de statische route antwoordt de wiki met een
  redirect voor beperkte inhoud, onder `/members` beslist hij met de PDP.
  `AdminTypeScreen` in het package kiest per `/admin/<segment>`: een plugin
  die het segment claimt wint (de wiki-studio boven de platte lijst), anders
  de generieke lijst; beide sites hebben dezelfde dunne route, en de
  Imprint-site heeft nu ook de plugin-haken. De kern kent wiki noch
  planning meer: `CoreContentType` telt nog negen typen. Vier browsertests
  voor de wiki (aanmaken, eigen URL, beperkt via /members, 404).
- **Fase 5, stap 2 en 3: het plugincontract, en planning als eerste plugin.**
  `ImprintPluginCore` (extension-api: contenttypen, widgetschema's, menu) en
  `definePlugin`/`ImprintPlugin` (runtime-admin: schermen en actions);
  `plugins: [...]` in `imprint.config.ts` voegt de typen aan het register toe
  en de menu-items aan de admin. Drie vaste haken in de site: de
  `[type]`-routes renderen een pluginscherm als het segment geen contenttype
  is (`PluginScreen`, ook `[type]/[...path]`), één `pluginAction`-dispatcher
  in `actions.ts`, en (stap 4) de publieke catch-all. `@imprint/plugin-
  planning` bevat de twee contenttypen met relatieregels, de bordadmin onder
  `/admin/planning`, de acties, de planning-widget en de pure bordlogica met
  tests; MusicBrain zet hem aan met één regel en componeert alleen nog de
  widget in zijn catalogus. De kern kent planning niet meer. Vijf
  browsertests voor de plugin; alles groen.
- **Fase 5, stap 1: contenttypen als definities.** `ContentTypeDefinition`
  en `ContentTypeRegistry` in `content-core` (schema, label, vlaggen,
  menuplek, domein, relatieregels, startwaarden, sleutel, formulierschema);
  de kern levert zijn veertien typen als definities (`core-content-types.ts`,
  `DEFAULT_RELATION_RULES` is nu afgeleid). De zeven switches op typenaam in
  store, catalogus, formulieren, itemeditor, actions, modeloverzicht en
  V3-export zijn opzoekingen geworden; `ContentType` is een open string
  (besluit Mark), bewaakt door het register: een niet-geregistreerd type
  wordt nooit geschreven. Geen zichtbaar verschil; alle suites groen.
- **Opzet Fase 5** (`docs/design/fase-5-plugins.md`): contenttypedefinities
  en een register in plaats van de zeven switches in de kern, het
  plugincontract (`definePlugin`), drie vaste haken voor schermen, actions en
  publieke routes, en de stappen om planning en wiki als eerste plugins te
  verhuizen. Vier keuzes voor Mark in §6.
- **Fase 4 af — stap 4: de standaard-widgeteditors in de bibliotheek.**
  De rijke editors voor table, gallery/carousel en map staan in
  `@imprint/widgets-standard/editors` (`standardEditors`, plus de helpers
  `omitProps`, `Mini2`, `NumInput`, `editorInputCls` voor site-eigen
  editors). MusicBrain houdt alleen nog board en kanban (366 regels, was
  695) en spreidt de standaardset erbij; de Imprint-site krijgt dezelfde
  editors en heeft het **externe album** in zijn widgetset (besluit Mark).
- **Fase 4, stap 2 en 3: de studio zit in het package en werkt op beide
  sites.** `PageStudioScreen` en de studio-actions (`draftOp`, `resetDraft`,
  `savePageDraft`) in `@imprint/runtime-admin/admin-server`, de
  clientonderdelen (`StudioProvider`, sidebar, toolbars) in `/admin`. Een
  site levert via `AdminContext.studio` zijn viewers, één chrome-component
  om het canvas en optioneel zijn widget-editor; het package bouwt de
  `WidgetContext` voor het canvas zelf (als de redacteur: beperkte items en
  drafts inbegrepen). De Imprint-site bewerkt pagina's nu visueel binnen zijn
  eigen header en footer, met zijn acht widgets; MusicBrain onveranderd (30
  browsertests groen). Exitcriterium van Fase 4 gehaald; wat rest is stap 4,
  de standaard-widgeteditors naar `widgets-standard`.
- **Fase 4, stap 1: draftlogica van de studio naar het package.** De pure
  layoutoperaties (`applyOp`, `PageDraft`, `DraftOp`) staan in
  `@imprint/runtime-admin/studio` (client-safe), de serverside draftopslag in
  `admin-server` (`draftKey`, `getDraft`, …). De draftsleutel bevat nu ook de
  instantie, zodat twee sites in één proces elkaars drafts nooit zien. Test
  verhuist mee.
- **Browsertest voor de studio** (vangnet voor Fase 4): een nieuwe pagina
  componeren (instellingen, rij, hero-widget, aanmaken), live zien, historie,
  tweede versie via de studio. Onderweg twee kleine UX-punten gevonden en
  in de backlog gezet ("Saved ✓" verdwijnt bij aanmaken; snelle klik na
  typen kan sidebar-invoer verliezen). 30 browsertests, productie en dev.
- **Ontwerp Fase 4: chrome-slot in de studio** (besluit Mark). De studio
  krijgt de omlijsting van de site als één component mee en weet er verder
  niets van; de rijkere variant (menu en thema's in het canvas) is een
  vervolgstap. Revisievoorstel, Fase 4; backlog.
- **Fase 3 af — stap 6 en 7: de Imprint-site heeft de admin.** Sessie en
  as-of-preview zijn naar het package verhuisd (`createSessionAuth(imprint)`,
  `readOpts()`, `previewEnter`/`previewExit`), zodat een site alleen nog zijn
  `AdminContext` en dunne routes hoeft te hebben. De Imprint-site
  (Postgres) heeft daarmee `/admin`: inloggen, dashboard, lijsten, bewerken,
  historie, herstel, gebruikers, relaties, modeloverzicht en Time travel —
  in 13 kleine bestanden, zonder eigen admin-code. Pagina's bewerk je daar
  voorlopig met het meta-formulier; de itemeditor laat velden die het
  formulier niet kent (layout, body) nu ongemoeid, zodat een meta-save een
  gecomponeerde pagina niet sloopt. MusicBrain leest sessie en preview uit
  hetzelfde package (`lib/auth.ts` en `lib/preview.ts` zijn doorgeefluiken).
  Eerste gebruiker: `SEED_ADMIN_USER`/`SEED_ADMIN_PASSWORD` +
  `npm run db:seed -- --site=imprint --only=user`; `SESSION_SECRET` in
  `sites/imprint/.env.local`.
- **Fase 3, stap 5 af: de hele admin draait uit het package.** Ook
  gebruikersbeheer, relaties, default views en het modeloverzicht zijn nu
  schermen en actions in `@imprint/runtime-admin/admin-server`
  (`UsersScreen`, `RelationsScreen`, `ViewsScreen`, `ModelScreen`;
  `createUser`, `resetPassword`, `setRole`, `deleteUser`,
  `changeOwnPassword`, `saveRelations`). De site houdt alleen nog dunne
  routebestanden en wrappers; wat er nog in de site staat is de studio
  (Fase 4) en planning en wiki (Fase 5). Welke typen een default view hebben
  is een catalogusvlag (`viewable`); `viewTargetType` kent geen eigen
  typelijst meer. Geen zichtbaar verschil; 27 browsertests groen.
- **Fase 3, stap 5 (eerste helft): de kern van de admin draait uit het
  package.** Login, dashboard, lijst, itemeditor, historie en herstel zijn
  schermen in `@imprint/runtime-admin/admin-server` (`AdminGate`,
  `DashboardScreen`, `ListScreen`, `ItemEditScreen`, `HistoryScreen`) met de
  action-implementaties ernaast (`signIn`, `signOut`, `saveItem`,
  `deleteItem`, `restoreVersion`); alles krijgt de `AdminContext` als
  parameter. In de site blijven dunne routebestanden (samen 122 regels, was
  ~500) en één-regel `"use server"`-wrappers. Het admin-menu wordt gebouwd
  uit de contenttypecatalogus (`CONTENT_TYPES[type].menu`) plus de bijdragen
  van de site (`contributions`: planning, wiki, default views, model,
  relaties); de `AdminShell` zit in het package. Geen zichtbaar verschil; 27
  browsertests groen. Tweede helft volgt: gebruikers, relaties, menu's,
  thema's, modeloverzicht.
- **Fase 3, stap 4: admin-context en de generieke clientcomponenten naar het
  package.** Dialoog, `SchemaForm`, markdown-editor, loginformulier, menu-,
  thema-, gebruikers-, relatie- en itemeditor (~1.400 regels) staan nu in
  `@imprint/runtime-admin/admin` en krijgen hun server action als prop; de
  formulierschema's (`contentFormSchema`, `widgetFormSchemas`) in
  `@imprint/runtime-admin/forms`. Nieuw: `AdminContext`
  (`createAdminContext`): instantie, sessie, formulieren en admin-bijdragen in
  één object, door de site gebouwd in `src/lib/admin.ts`. Geen zichtbaar
  verschil in de admin; de 27 browsertests bewijzen dat.
- **Fase 3, stap 3: het poortje in AuthZEN-vorm, en publiek/beperkt op alle
  inhoud.** `access: public | restricted` op elk inhoudstype (oude wiki's met
  `visibility: members` blijven parseren als beperkt, geen migratie). Het
  poortje is asynchroon en spreekt AuthZEN (`permit()`, `inProcessPdp`,
  `guardReads()` in `content-core/src/access.ts`); de beslisser komt uit de
  instantie (`ImprintConfig.pdp`), nu de vaste regelset in het proces, straks
  de sidecar. `imprint.store` is de bewaakte bezoekerskijk: beperkte items
  vallen uit elke lijst, get, feed, API-antwoord en list-widget. Beperkte
  pagina's en wiki's staan onder `/members/<slug>` (dynamisch, per verzoek
  langs de PDP, anders 404); de statische route stuurt ernaartoe. Publieke
  pagina's blijven statisch. Lost ook de 500 op de members-wiki in productie
  op (cookies in een statische render). Vijf browsertests erbij. Wiki-editor:
  "Zichtbaarheid" heet nu "Toegang".
- **Ontwerp Fase 3: toegang per widget later** (besluit Mark). Stap 3
  handhaaft `publiek`/`beperkt` per pagina en item; een beperkte widget op een
  publieke pagina wordt een eigen stap daarna. De afweging (Partial
  Prerendering of laden in de browser) staat in §4.3 van het ontwerp.
- **`npm run db:copy-to-pg`**: eenmalige verhuizing van een MariaDB-database
  naar Postgres — alle rijen met id's, historie en wachtwoordhashes, in één
  transactie met controle rij voor rij (`--dry-run`, `--replace`). Leest de
  tijden als UTC, zoals drizzle ze schreef. Bedoeld voor MusicBrain; stappen
  in [docs/deploy-vps.md](docs/deploy-vps.md).
- **Fase 3, stap 2 af: browsertests voor de hele bewerkcyclus** — naast
  inloggen en lijsten nu ook: opslaan (en dat de publieke pagina meeverandert),
  een ongeldige waarde die geweigerd wordt, historie (nieuwste eerst, met
  auteur), herstel (een nieuwe versie; de historie blijft), een product
  aanmaken en verwijderen, en gebruikersbeheer (toevoegen, zwak wachtwoord en
  bezette naam geweigerd, rol wijzigen, je eigen adminrol niet afgeven,
  verwijderen; een editor ziet het beheer niet). 22 tests, groen tegen de
  productiebuild en tegen `next dev`. Getoetst: zonder de revalidatie na een
  save faalt de test.
- **Fase 3, stap 2 (eerste helft): browsertests van de admin** — Playwright in
  `sites/musicbrain/e2e/`, `npm run test:e2e`. De run maakt de wegwerpdatabase
  `imprint_e2e` leeg, seedt haar via de store, bouwt de site en test in
  Chromium: inloggen (fout wachtwoord, uitloggen, reader komt er niet in) en
  lijsten (producten, dashboardtellingen, 404 op onbekend type, menu per rol),
  plus een rooktest van de studio. Elke test faalt op een console-error.
  `npm run test:e2e:dev` draait dezelfde specs tegen `next dev` in een eigen
  map (`.next-e2e`, dus naast een draaiende dev-server): alleen daar meldt
  React hydration- en propfouten, zoals de twee die in september opdoken.
  Aparte CI-job met MariaDB-service. Nog te doen: opslaan, historie, herstel
  en gebruikersbeheer.
- **Tests draaien nu ook op Windows**: de testscripts van beide sites gebruikten
  bash-syntax en werden onder cmd.exe stil overgeslagen; de golden-HTML-tests
  struikelden bovendien over CRLF uit `core.autocrlf`. `npm test` draait nu
  overal alle suites.
- **Deploy op de VPS: één container-image per site** — `Dockerfile` in de
  root (build-arg `SITE`, Next `output: "standalone"` via `NEXT_OUTPUT`, dus
  lokale builds blijven ongewijzigd) en `deploy/vps/`: compose met één
  Postgres 17 (database + rol per imprint), `deploy.sh` (git pull/tag →
  migreren → bouwen → herstarten, plus `migrate`/`seed`/`user`), `backup.sh`
  (pg_dump + assets) en het Caddy-blok. De SSG-build leest de database via een
  BuildKit-secret; daarom bouwt de VPS zelf. Lokaal getest voor beide sites,
  MusicBrain daarbij voor het eerst op Postgres. De Imprint-site leest
  `ASSET_ROOT`/`ASSET_BASE_URL` nu ook uit de omgeving; `.gitattributes`
  houdt shell-scripts op LF. Runbook: [docs/deploy-vps.md](docs/deploy-vps.md).
- **Tijdreizen: drie lekken dicht** (ontwerp Fase 3 §8.4). In de
  as-of-preview reizen nu ook mee: de siteconfiguratie (naam, tagline,
  URL-aliassen; `getSiteConfig(opts)` in het storecontract), de thema-CSS in
  de root-layout en de default views (`_view/<type>`). Bestond de site op het
  gekozen moment nog niet, dan geeft de store de huidige siteconfiguratie,
  zodat de pagina (of de 404) blijft renderen. Publieke pagina's blijven
  statisch.
- **Fix: studio gaf een reeks "Only plain objects"-meldingen** — zod 4.4 hangt
  een verborgen `~standard`-object aan elk JSON-schema; de formulierschema's
  gaan nu als kale JSON naar de client (`admin-schemas.ts`).
- **Fix: hydration-melding op `<html>`** — het thema-script zet `data-theme`
  vóór de hydratie (bewust, tegen flitsen); React meldde dat in dev als
  mismatch zodra de browser een opgeslagen thema had. `<html>` heeft nu
  `suppressHydrationWarning`.
- **Lokale databases**: Postgres staat nu op poort **5434** (5433 botste met
  de regressietest van Omnium); beide containers starten vanzelf mee met
  Docker (`restart: unless-stopped`). `npm run test:db` is een Node-script en
  werkt daardoor ook op Windows. Wie al een `.env.local` met 5433 heeft: poort
  aanpassen en `npm run db:up` opnieuw draaien.
- **Fase 3, stap 1: de grond onder de gedeelde admin**. Drie kleine
  wijzigingen zonder zichtbaar gedrag voor MusicBrain:
  - *Gebruikers op Postgres*: het gebruikersbeheer is gesplitst in een
    gedeelde `UserStore` (regels: wachtwoordbeleid, laatste admin blijft
    admin) en per dialect vijf rij-operaties (`DbUserStore`, `PgUserStore`),
    bewezen gelijk door één contractsuite op beide databases.
    `openContentDatabase()` levert nu altijd users; `npm run user` en de seed
    werken op MariaDB en Postgres.
  - *Secrets via de config*: `SESSION_SECRET`, `INGEST_TOKEN`,
    `GITHUB_WEBHOOK_SECRET` en `PUBLISH_*` worden alleen nog in
    `imprint.config.ts` gelezen (`secrets`) en komen via de instantie bij de
    code; ontbreekt er een, dan faalt of zwijgt alleen de functie die hem
    nodig heeft, zoals voorheen.
  - *Contenttypecatalogus*: `CONTENT_TYPES` in `content-core` beschrijft wat
    het model kent (label; lijstbaar, bewerkbaar, via de API aan te leveren,
    op het dashboard); `contentTypes` in `imprint.config.ts` bepaalt welke een
    site gebruikt. De zeven losse typelijsten in admin-routes, server actions,
    dashboard, relatie-editor en `/api/content` zijn vervangen. Zichtbaar
    gevolg: de relatie-editor biedt nu alle actieve typen aan.
- **Ontwerp Fase 3**: `docs/design/fase-3-admin-toegang-tijdreizen.md` legt
  de besluiten vast voor de gedeelde admin (eigen admin, alleen ideeën lenen);
  rechten via het PxP-patroon met twee sidecar-PDP's, aan de voorkant en bij
  gegevenstoegang, binnen AuthZEN NL Gov en FTV; `publiek` of `beperkt` op
  alle content, waarbij publieke content zonder PDP werkt; een browsertest
  voor de admin-flows; formulieren en lijsten volgens Omnium; en de richting
  om het contentmodel te modelleren, er een bitemporeel register uit te
  genereren en daarnaar te migreren, met de voorwaarden die daarvoor nog in
  Omnium open staan. Verder het principe dat inhoud, vormgeving en
  configuratie samen door de tijd te reizen zijn, de gemeten tijdreislekken,
  een richting voor widgetversies, het stappenplan en de open vragen.
- **Fase 2 afgerond: de Imprint-site rendert pagina's uit de database
  (stap 5)**: `sites/imprint` heeft een catch-all-route die pagina's uit de
  contentstore toont (Postgres, of `content/` zonder database) via dezelfde
  engine-renderer als MusicBrain, met een eigen selectie van acht
  standaardwidgets. De huisstijl vult het tokencontract van de
  standaardwidgets met het Imprint-palet; de globale basisregels van de site
  staan nu in Tailwinds base-laag, zodat ze widget-utilities niet
  overschrijven. Een voorbeeldpagina `/techniek` staat in `content/` en in de
  lokale Postgres-database; een test bewaakt de widgetselectie en de
  weergave. MusicBrain ongewijzigd (routetabel identiek).
- **Standaardwidgets als bibliotheek (Fase 2, stap 4)**: de twintig widgets
  zonder domeinkennis (tekst, tabel, afbeelding, galerij, carrousel, album,
  kaart, kanban, hero, video, accordeon, scheiding, specs, posts, template,
  lijst, callout, embed, boomweergave, api) staan nu in het nieuwe package
  `@imprint/widgets-standard`, met schema's en viewers. MusicBrain stelt zijn
  catalogus samen uit die standaardwidgets en zijn tien domeinwidgets, in de
  vertrouwde volgorde; de studio toont exact dezelfde widgets, labels,
  versies en helpteksten (vastgepind in een test). `WidgetFrame` staat nu in
  de engine. Golden HTML en routetabel ongewijzigd; de CSS-dekkingstest ving
  onderweg een ontbrekende Tailwind-bron. Leaflet en mustache verhuisden als
  afhankelijkheid mee, zonder versiewijziging.
- **Viewers krijgen hun content aangereikt (Fase 2, stap 3)**: widget-viewers
  ontvangen een `WidgetContext` (`store`, `writableStore`, `readOptions`) in
  plaats van zelf `@/lib/content` en `next/headers` te importeren. De site
  bouwt die context per verzoek in `src/lib/widget-context.ts`; een lintregel
  verbiedt de oude imports in de viewer-graaf. `DefaultView` verhuisde daardoor
  ook naar `@imprint/runtime-admin`. Golden HTML, CSS en de routetabel
  (statisch/SSG/dynamisch) zijn ongewijzigd. De renderertests hebben geen
  experimentele module-mocks meer nodig.
- **Renderer naar de engine (Fase 2, stap 2)**: `PageRenderer`, `Widget`, de
  layouthelpers (`layoutRows`, `LAYOUT_PRESETS`) en `Markdown` staan nu in het
  nieuwe package `@imprint/runtime-admin`. De renderer kent geen concrete
  widgets meer; MusicBrain bindt hem in `src/components/page-renderer.tsx` aan
  zijn eigen viewers. Golden HTML en gegenereerde CSS zijn aantoonbaar
  ongewijzigd. Tailwind scant het engine-package en slaat de testmap over; een
  nieuwe test bewaakt dat elke gerenderde class CSS krijgt. De site-tests
  draaien met `tsconfig.test.json`, zodat JSX in engine-packages werkt.
- **Fix: `npm run release` hoogt alle workspaces op**: het script had een
  vaste lijst van drie `package.json`-bestanden, waardoor `extension-api` en
  de Imprint-site achterbleven. Het leest nu de `workspaces` uit de root.
- **Renderer vastgelegd vóór de verhuizing (Fase 2, stap 1)**: nieuwe
  karakterisatiesuite in `sites/musicbrain/test/render/` rendert de echte
  `PageRenderer`, alle 30 widget-viewers, `DefaultView` en `SiteChrome` naar
  HTML en vergelijkt met golden files (`UPDATE_GOLDEN=1` om bewust bij te
  werken). Store, `next/headers` en `fetch` worden in de test vervangen, dus
  geen database en geen netwerk nodig. Daarvoor kreeg `content-core` een
  `MemoryContentStore`: dezelfde bitemporal-light semantiek als MariaDB en
  Postgres, door dezelfde contractsuites gehaald. Tests draaien nu per
  workspace (`npm test` roept ze allemaal aan). Geen gedragswijziging.
- **Docs: overdracht bijgewerkt (16 september)** — `docs/overdracht.md` §0:
  MusicBrain is offline sinds 1 september (Quickhost heeft Node/Passenger
  uitgezet), er is een VPS (vps1.paratmos.nl, Omnium draait er al), verhuisplan
  voor MusicBrain in zes stappen, wat er sinds juli op `main` is gekomen, en
  Windows-specifieke aanwijzingen. §3 gemarkeerd als historie.
- **Composition root per site (Fase 1, opdracht C)**: nieuw package
  `@imprint/extension-api` met `defineImprint()`/`createImprint()`. Elke site
  beschrijft zichzelf in `imprint.config.ts` (id, backend-URL + contentmap,
  widgetcatalogus, sessiecookie, assets); `src/lib/content.ts` maakt daar de
  instantie van en `auth.ts`/`assets.ts` halen cookie, users en asset-store
  uit die instantie in plaats van uit losse modules en env-reads. MusicBrain
  en de Imprint-site starten nu vanuit hetzelfde configuratiecontract; gedrag
  ongewijzigd (cookienaam blijft `imprint_session`). `openContentDatabase()`
  levert nu ook de `DbUserStore` (MariaDB), zodat de seed geen tweede pool
  meer opent.
- **Docs: positionering** — `docs/positionering.md` zet Imprint naast Drupal
  en Payload: wat het wel en niet is, waar het iets eigens doet en waar het
  (nog) achterloopt. `docs/design/widget-standaarden.md` kreeg een vervolg
  over Payload-blocks als widgetbron (conclusie: niet zinvol; hergebruik komt
  uit generieke React-bibliotheken als client-eiland).
- **Docs: NL Design System** — `docs/design/nl-design-system.md` inventariseert
  wat Omnium al met NL Design System doet (Utrecht-CSS-klassen en tokens, geen
  React-imports) en hoe het in Imprint past: CSS op eigen markup vanwege
  server-components, een tokenbrug naar de Imprint-thema's en een `form`-widget
  voor S10 op de losgemaakte Omnium-renderer. Het backlogpunt
  "Formulier-renderer als widget" is in stappen opgesplitst.
- **Fix: koude compile van MusicBrain duurde minuten** — Tailwind v4 scande
  ook de `.glb`-3D-modellen en honderden SVG's in `public/` en `.assets/` op
  class-namen (>2 min en >10 GB per compile, Turbopack-timeouts in dev en
  build sinds de 3D-tab van juli). Twee `@source not`-regels in
  `globals.css` slaan die mappen over: de Tailwind-stap gaat van >120 s naar
  ~0,2 s.
- **Postgres als tweede databasebackend (opdracht B)**: de Imprint-productsite
  draait op Postgres (`DATABASE_URL=postgres://…`), MusicBrain ongewijzigd op
  MariaDB. De lees-/schrijfsemantiek van de databasestore is naar één
  abstracte `DbContentStoreBase` gebracht; `DbContentStore` (MariaDB) en het
  nieuwe `PgContentStore` (Postgres, `jsonb`, `timestamptz`) implementeren
  elk alleen zes rij-operaties. Eigen schema en migratiejournal per dialect
  (`db-schema.pg.ts`, `drizzle-pg/`, `drizzle.config.pg.ts`,
  `npm run db:generate:pg` / `db:migrate:pg`); `openContentDatabase(url)` in
  `@imprint/content-core/db` kiest de backend op het URL-schema, gebruikt door
  de composition root van de Imprint-site en door `db:seed`. `docker compose`
  heeft nu ook een Postgres 17-service (poort 5433, maakt `imprint_test` zelf
  aan). Beide backends draaien dezelfde lees- én schrijfcontractsuite
  (`npm run test:db`). Nog MariaDB-only: users/admin-login, backup, assets-gc.
- **Architectuurcontract en karakterisatietests (Fase 0)**:
  `docs/architecture.md` §0 legt de vier lagen vast — engine, bibliotheek,
  backend, site — met hun afhankelijkheidsregels (site → engine, nooit
  andersom; engine kent geen site-naam; backend alleen via `ContentStore`;
  tijd als leesparameter van het contract), de besluiten die zonder Mark
  genomen konden worden en de open vragen. Nieuw: `npm test` (Node's eigen
  testrunner via tsx, ook in CI) met een gedeelde `ContentStore`-contractsuite
  die tegen de file-store en — met `TEST_DATABASE_URL`, `npm run test:db` —
  tegen de MariaDB-store draait, plus tests voor de schrijfkant (versies,
  tijdreizen, tombstone, referentieweigering), het widget-model, relaties,
  itinerary, `layoutRows()`, de studio-ops en de exacte MusicBrain-
  widgetcatalogus. Gedrag is alleen vastgelegd, niet veranderd.
- **Opdrachtbrief voor het lostrekken van de engine**:
  `docs/design/opdracht-engine-bibliotheek-backend-site.md` vertaalt het
  revisievoorstel naar vier lagen — engine, bibliotheek (nieuw begrip),
  backend (nieuw als eigen laag, Postgres eerst, MariaDB blijft) en site — legt
  vast wat al besloten is, wat nog open staat, en geeft de eerste concrete
  opdracht (architectuurcontract + karakterisatietests, Postgres-spike, dan pas
  composition root).
- **Architectuurrevisie ontworpen**: `docs/design/engine-instance-plugin-architectuur.md`
  beschrijft uitgebreid hoe Imprint van de huidige, deels in MusicBrain
  ingebouwde motor naar gedeelde core/runtime/adminpackages en dunne
  site-instanties kan groeien. Het voorstel definieert widgets versus plugins,
  een veilig build-time extensionmodel, package- en deploymentgrenzen,
  teststrategie, zes migratiefasen en de nog te nemen besluiten.
- **Imprint heeft een eigen productsite en merkvoorstel**: `sites/imprint` is
  een tweede Next.js-workspace met een statische, responsieve productsite die
  het platform uitlegt en MusicBrain als praktijkvoorbeeld toont. Het
  toegepaste logo "Registerdruk" verbeeldt versiehistorie als twee verschoven
  afdrukken; "Colofon" en "Veelvoud" blijven als alternatieven zichtbaar en
  zijn samen met exporteerbare SVG's gedocumenteerd in `docs/design/brand.md`.
  Mogelijkheden, praktijk en merk hebben eigen routes in plaats van
  ankersecties; de homepage kreeg een rustigere kop en matrix zonder centrale
  lijn. De siteconfig gebruikt nu de `ContentStore` met een eigen MariaDB-
  database en eigen file-storefallback; pagina-inhoud en admin volgen later.
- **Documentatie heeft een publieke voordeur**: de hoofd-README legt nu eerst
  in gewone taal uit wat Imprint is, wat een team ermee kan en hoe MusicBrain
  het gebruikt. Een nieuw documentatieoverzicht biedt routes voor redacteuren,
  ontwikkelaars en ontwerpbeslissingen; ook de redacteurshandleiding en de
  MusicBrain-workspace verwijzen nieuwe lezers gericht door.
- **Lokale database bijpraten vanaf een draaiende site**:
  `node scripts/sync-from-live.mjs` haalt componenten + board-specs (en de
  assets waar ze naar wijzen) via de publieke read-API op en post ze op het
  doel via de ingest-API — strikt eenrichtingsverkeer (alleen GET's op de
  bron), identieke items worden overgeslagen en items die alleen lokaal
  bestaan blijven staan. Nodig als de KiCad-toolkit lokaal een release post
  die naar componentversies verwijst die alleen live bestaan (404 op
  `/components/<slug>`, missende 3D-tabs). `--dry` toont eerst wat er zou
  gebeuren.
- **Dev-server stoppen/herstarten zonder de terminal te zoeken**:
  `npm run dev:start|dev:stop|dev:restart|dev:status` (script
  `scripts/dev-server.mjs`, praat met de *poort* i.p.v. een proceshandle)
  plus dezelfde drie als VS Code-tasks. Handig na een `npm install` of een
  gewijzigde dependency; `npm run dev` blijft de gewone voorgrond-start.
- **Productpagina is nu écht bewerkbaar** (default views voorbij "geparkeerd"):
  vier subject-widgets — **Subject header** (eyebrow, naam + status, tagline,
  omschrijving), **Specs table**, **Product components** (met ingeklapte
  board-specs) en de **releases**-widget in product-modus (expliciet product
  of het subject; nieuwste eerst) — renderen via dezelfde gedeelde secties als
  de ingebouwde pagina (`product-sections.tsx`), dus een studio-view is per
  constructie identiek. `_view/product` wordt meegeseed en reproduceert de
  pagina 1-op-1; bewerken in Vormgeving → Default views verandert vanaf nu
  écht de productpagina's. Een view met een subjectheader bezit zijn eigen
  h1 (geen dubbele titel); subject-loze gallery's verdwijnen stil i.p.v.
  "No photos yet.".
- **Thema's proberen in de studio**: de canvas-chrome heeft nu de echte
  themaswitcher (alle thema's uit de store, dus ook nieuwe), klikbaar ondanks
  de verder inerte omlijsting. Let op: wisselen zet je eigen themavoorkeur,
  net als op de site.
- **Wiki-fundament + PEP** (stap 1–2 van design/wiki.md): drie nieuwe
  contenttypen — `wiki` (met `visibility: public|members`), `wiki-folder`
  (nestbaar via parent) en `wiki-page` (verplaatsen = folder-veld wijzigen)
  — met enforced relatieregels (page→folder→wiki) en volledig beheer in de
  admin (Content → Wiki, formulieren uit de zod-schema's, History werkt
  zoals overal). Autorisatie loopt nu door één centraal **PEP**
  (`authorize()`, lib/authorize.ts) met een inplugbaar
  `PolicyDecisionPoint`-interface (AuthZEN-snijvlak): vandaag de vaste
  regelset (`staticPdp`), later policies-als-content of een ODRL-gebaseerde
  policytaal — zonder dat call-sites veranderen. `canEdit()` is een dunne
  wrapper over het PEP geworden. Na deploy: `db:seed -- --only=relations`
  voor de nieuwe regels.
- **Wiki publiek** (stap 3): `/<wiki>/…` rendert de wiki met navigatieboom
  links en pagina rechts. URL's zijn `/<wiki>/<folderpad>/<pagina>`, maar
  opgelost wordt op de paginaslug — een verplaatste pagina breekt geen oude
  links. `visibility: members` loopt door het PEP en rendert dynamisch;
  publieke wiki's blijven cachebaar. Architectuur: §3d kreeg een
  mermaid-sequencediagram van de PEP→PDP-flow (het inplugbare
  AuthZEN-snijvlak).
- Admin: **eigen dialoogjes** i.p.v. de ouderwetse window.confirm/prompt —
  een popover in de huisstijl die opklapt bij je muis (waar je net
  klikte), met Enter/Escape, gevaar-variant in rood en een invoerveld voor
  vragen. Overal doorgevoerd: wiki-studio (nieuw/verwijder/publiceer),
  planbord-delete en de link-knop in de markdown-editor (met behoud van de
  tekstselectie).
- Wiki: **folder verwijderen cascadeert** (compositie — Wiki ◆— Folder ◆—
  Page): subfolders en pagina's gaan mee, met vooraf een waarschuwing die
  de echte aantallen noemt; alles tombstones, dus herstelbaar via History.
  De publiceer-knop verschijnt bovendien alleen nog waar publiceren is
  ingericht (PUBLISH_URL/PUBLISH_TOKEN) en toont het doel in het label —
  live heeft hem dus niet meer. Admin-rail kreeg een **?-Help-knop** naar
  de Help-wiki.
- Wiki-studio: **inline hernoemen** (dubbelklik op een boom-item; Enter/blur
  bewaart, Escape annuleert). Hernoemen wijzigt alléén de titel — de slug
  blijft stabiel, dus interne verwijzingen en URL's breken niet.
- Wiki: **Publiceer → live** — knop in de studio die de hele wiki (wiki →
  folders, ouders eerst → pagina's) naar de live content-API POST met het
  INGEST_TOKEN van het doel (`PUBLISH_URL`/`PUBLISH_TOKEN` in de lokale
  `.env.local`; zie .env.example). Nogmaals publiceren = nieuwe versies op
  live. De wiki-typen zijn daarvoor INGESTABLE geworden op de API.
- **Gedogfood**: de redacteurshandleiding leeft nu als **Help-wiki**
  (`/help`) — vier folders (Aan de slag, Content bewerken, Vormgeving,
  Gevorderd) met de secties als pagina's. `docs/handleiding.md` blijft
  voorlopig als reservekopie (met verwijzing bovenin).
- Wiki-studio: **volgorde slepen** — tijdens het slepen verschijnen
  invoeg-streepjes tussen pagina's en folders; droppen voegt in op die
  positie en hernummert de broertjes server-side (computeMove-stijl, zoals
  het planbord: alleen gewijzigde items krijgen een nieuwe versie).
  Cykel-bescherming zit ook client-side, dus onmogelijke posities lichten
  niet op.
- **Wiki-studio** (wiki.md §4b): /admin/wiki is nu een echt wiki-overzicht
  (aanmaken op titel; slug volgt) en /admin/wiki/[slug] de studio — boom
  links (slepen verplaatst: alleen het folder/parent-veld wijzigt, met
  cykel-bescherming), eigenschappen + markdown-editor rechts; niets
  geselecteerd = de wiki zelf. Slugs worden per wiki gescopet en uit de
  titel gegenereerd; folders verwijderen alleen als ze leeg zijn
  (tombstone, herstelbaar). Structuur → inhoud, links naar rechts —
  Marks leesrichting-principe.
- Wiki-fixes uit de eerste testronde: een met **lang=nl** aangemaakte wiki
  404'te (de lookup zocht hard op "en"; nu taal-tolerant tot echte
  meertaligheid er is), en in de **Visueel-tab** van markdown-velden in
  schema-formulieren sprong de focus steeds uit het schrijfvlak (het veld
  zat in een `<label>`, die elke klik doorstuurde naar de eerste knop).
  Ontwerp bijgewerkt met de **wiki-studio**-richting (boom links, inhoud
  rechts; slugs per wiki scopen) en een **publiceer-knop** (lokale wiki →
  live via bundle-POST op de content-API) — beide op de backlog.
- Docs: handleiding legt nu **vaste pagina's vs. content-pagina's** uit
  (welke routes code zijn en welke je in de studio bewerkt); nieuw
  ontwerpdoc **wiki + PBAC-lite-autorisatie** (docs/design/wiki.md) met
  bijbehorend backlog-item.
- **Meer doorklikbaar**: de "Latest release"-tegel op de home en de
  release-titels op `/releases` linken nu naar de release-detailpagina
  (`/releases/<project>-<versie>`); het "Try it before it exists"-blok op de
  home is een link naar `/editor`. Explore-testpagina verwijderd (uit het menu
  + seed geparkeerd naar `content/_parked/`).
- **Editor-landingspagina** (`/editor`, eis A1): hero + scope-divider + specs +
  CTA naar de live MusicBrain browser-editor/simulator op
  `editor.musicbrain.nl` (aparte statische Vite-SPA, eigen repo/deploy). "Editor"
  toegevoegd aan het hoofdmenu.
- Productpagina: releases staan nu **nieuwste eerst** (de lijst ging via
  `listItems` en was ongesorteerd; `/releases` en de widget waren dat al).
- **"Open brain"-copy & branding**: de mockup-teksten overgenomen — verhalend
  vanuit de gebruiker ("they forget…") in hero en product-taglines; nieuw
  `audience`-veld op Product ("for modular synths" als kapiteel-regel op
  kaarten en productpagina); patch-brain-logo in de header met de klemtoon op
  **Brain** (accent) en meer lucht rond de naam; site-tagline nu "The open
  brain for your analog rig"; GitHub uit de hoofdnavigatie naar de footer
  (samen met Discord); "Try it before it exists" / "Open, top to
  bottom"-blokken op de home. **Synapse geparkeerd** (seed naar
  `content/_parked/`, tombstone in de DB — herstelbaar via History).
  Fijnslijperij na review: nieuw `motto`-veld op Site ("open hardware ·
  est. NL" onder de wordmark; de tagline blijft voor SEO/feed), logo en
  naam groter in de header, "Meet the family"-knop weg (de familie staat er
  direct onder), en het Amber-thema draagt nu de mockup-fontstacks (Segoe
  UI-systeemstack + Cascadia/JetBrains Mono) via de bestaande
  thema-fontvelden. **Amber is nu het default-thema**: de
  `:root`-tokens in `globals.css` dragen het "open brain"-palet en de
  systeemfont-stacks (volgorde in de switcher: Amber, Dark, Light, Neon;
  Dark en Light behouden Geist via hun eigen fontvelden). Fonts lopen nu
  via een `--sans`/`--mono`-indirectie zodat thema-fontwissels ook
  Tailwinds `font-mono`-utilities raken (voorheen bleven die op Geist
  Mono staan).
- **"Open brain"-designpass** naar het eerder ontworpen MusicBrain-artifact:
  nieuw **Amber-thema** (blauwzwart + amber, cyaan als tweede accent),
  optioneel `accent2`-token in het thema-schema (leeg = valt terug op
  accent), achtergrondtextuur (dot-grid + gloed) afgeleid van de
  thematokens, mono-eyebrows als sectielabels, krappere hoekradius,
  tagline in de header en mono-statusbadges. Widgets: nieuwe **Specs
  strip** (kerncijfers in mono), **Divider-stijl "scope"**
  (oscilloscoop-pulslijn in accent 2) en een vettere **Hero** met
  `*accentwoord*`-markering en een "open" variant zonder paneel.
- Planning-bord: een bord is nu **verwijderbaar** (Delete board op de
  bordpagina — met bevestiging; tombstonet ook de kaarten, herstelbaar via
  History). Nieuwe/bewerkte/verwijderde kaarten verschijnen **direct** (geen
  refresh meer nodig). Een component kiezen **vult een lege kaart-body**
  automatisch met een link naar dat component.
- **Admin met activity-rail** (VS Code-stijl): de lange bovenbalk is vervangen
  door een smalle icon-rail links met vijf werkgebieden — **Overzicht**,
  **Content** (Pages · catalogus · Planning), **Vormgeving** (menus, thema's,
  default views), **Model & config** (content model, relations, site) en
  **Beheer** (users, admin-only). Een secundair paneel toont de items van het
  actieve gebied; het gebied volgt de route. Onderin de rail: bekijk site,
  account en afmelden.
- **Content-model-pagina** in de admin (`/admin/model`): een read-only
  overzicht van alle contenttypen met hun velden (type, verplicht, enum/
  patroon) en de relatieregels — dezelfde bron als `/api/meta`. De types
  zitten in code (zod), dus deze pagina toont, bewerkt niet.
- Seed: `--only=<type>` matcht nu ook enkelvoud consequent (o.a.
  `--only=relations` laadt de relatieregels; die matchte eerder niet).
- **Planning-borden** (kanban als content): twee nieuwe contenttypen —
  `planning` (het bord: hoort bij een product, definieert de fasen) en
  `planning-item` (de kaart: titel, fase, eigenaar-gebruiker, rich-text-body,
  optionele component-link). In de admin (`/admin/planning`) sleep je kaarten
  tussen fasen en klik je ze open om te bewerken; **elke verplaatsing is een
  nieuwe versie**, dus een bord bewaart de volledige geschiedenis van hoe werk
  door de fasen liep (en time-travel toont het bord op elke datum). De
  `planning`-widget toont het bord op de site.
- **Planning-widget als generieke view**: naast bord-modus (planning-items)
  kan dezelfde widget elk contenttype als bord tonen — een aanwijsbaar
  fase-, eigenaar- en titelveld, met de fasen op de widget geconfigureerd.
  Zo rendert hij bv. `component`en gegroepeerd op hun nieuwe (optionele)
  `phase`-veld, dat een project via de API bijwerkt. Generieke modus is
  read-only (verschuiven gaat via het eigen beheer/de API van dat type).
- **GitHub release-webhook** (W2/S7): `POST /api/webhooks/github` maakt van
  elke gepubliceerde GitHub-release een release-item (HMAC-signature-check,
  `GITHUB_WEBHOOK_SECRET`; mapping repo→project/product in de site-config
  onder `releaseSources`; onbekende repos worden genegeerd). Edits
  superseden bitemporaal.
- **RSS-feed** voor de devlog op `/feed.xml` (W6-rest), aangekondigd via
  `rel=alternate`.
- **`GET /api/meta?format=v3`**: het contentmodel als genest **V3Model**
  (het metamodelformaat van het bitemporal/Omnium-project), zodat de
  formuliereditor/ModelPicker daar direct de projectboom uit kan opbouwen.
  Live afgeleid uit de zod-schema's; relatieregels worden V3-relaties (met
  velden óp de relatie, zoals de versie op Release↔Component), zod-enums
  centrale enums, en patronen/veldnamen de datatypes Slug, Versienummer,
  Markdown (richtext), Kleur, AssetUrl (media) en Json. Spec + mapping in
  docs/design/v3-metamodel-spec.md.
- **`GET /api/meta`**: het contentmodel machine-leesbaar — JSON Schema
  (2020-12) per contenttype uit dezelfde zod-schema's die de content
  valideren, plus de actieve relatieregels als referentietypen en de
  afgeleide itinerary. Datakant voor de metamodel-gedreven formuliereditor
  uit het bitemporal/Omnium-spoor.
- **`npm run backup`**: DB (volledige bitemporale historie + users) en
  assets in één gedateerde backup, Node-only (Plesk-Scheduled-Task-klaar),
  retentie 14; zie docs/backups.md.
- **`npm run assets:gc`**: ruimt asset-wezen op (bestanden zonder énkele
  verwijzing in de hele historie); dry-run default, jonger dan een dag
  blijft staan.
- **Time travel compleet**: ook widgets die zelf content ophalen (posts,
  list, releases, downloads, boardspec, itinerary, products) volgen nu de
  as-of-preview.

## [0.10.2] - 2026-07-17
- 3D-tab: het 3D-vlak neemt nu de vorm van het bord aan (vierkantig bord →
  vierkanter vlak, lang bord → breed vlak; verhouding op een wrapper, want
  model-viewers interne styling won van `aspect-ratio` op het element zelf —
  dáárom was het vlak ~5:1) en de camera-afstand rekent met perspectief
  (near-face-fit: op bordschaal-afstand loomt de voorrand anders het kader
  uit). Screenshot-geverifieerd op brain (vierkantig), busboard (breed) en
  jack8 (lang): alle drie vullend én binnen kader.

## [0.10.1] - 2026-07-17
- 3D-tab: het bord vult nu de beginstand. De camera-afstand wordt bij het
  laden berekend uit de echte modelafmetingen (model-viewers %-framing kadert
  op de omsluitende bol — bij een plat bord dus veel te ver weg), en de lange
  as van het bord ligt horizontaal in het (16:9-)beeld. Geverifieerd met
  screenshots op busboard (breed), jack8 (lang/smal) en gswitch-loop8sh.

## [0.10.0] - 2026-07-17
- **3D-tab op bordweergaves** (MMB-request): een board-spec kan een GLB-model
  meesturen (`assets.model3d`, versioned zoals de renders, of `view3d.src`);
  de bordweergave krijgt dan naast Overview/Interactive een **3D**-knop —
  vrij draaien/zoomen via een zelf-gehoste `<model-viewer>`. Dubbel lazy: de
  viewer-bundel én de GLB laden pas bij de eerste klik; tot die tijd staat de
  poster (`view3d.poster`, anders de render). Specs zonder model veranderen
  niet.
- **Component-soort `kind`** (MMB-FR): open stringveld op component (default
  `board`) en optioneel per spec; de versiekop op component- en productpagina
  volgt het ("Software v0.5.48" i.p.v. "Board …" voor de browser-editors).
  Bestaande content ongewijzigd — geen migratie.
- **Time travel (as-of-preview)**: op het admin-dashboard kies je een moment
  en bladert de publieke site zoals hij tóen was (of, met geplande content,
  wordt) — banner + Exit bovenaan, alleen zichtbaar in je eigen browser.
  Onder water reist `DbContentStore.currentRows` nu op beide bitemporale
  assen (tx- én valid-time), dus verleden-previews tonen echt de oude
  versies. Bekende beperking: widgets die zelf content ophalen kijken nog
  naar "nu".
- **Componentpagina toont de gepinde versie prominent** (MMB-vraag 4): de
  versie die de nieuwste release pint (stable weegt zwaarder dan beta/dev) is
  de hoofdweergave met een "pinned by"-badge; overige versies ingeklapt onder
  "Other versions". Zonder release-pins blijft de vlakke lijst.
- **/boards**: index van alle board-specs (kaarten met render, component,
  versie), tot nu toe alleen via hun component bereikbaar.
- **CI**: GitHub Actions draait typecheck + lint + build (file-store, geen
  database) bij elke push en PR.
- Ontwerpnotities toegevoegd: meertaligheid-beheer (docs/design/
  meertaligheid.md) en de embedded editor-demo W9 (docs/design/
  editor-demo.md).
- **URL-aliases** per contenttype (MMB-vraag 1): `aliases` in de site-config
  (bijv. `{"hw": "components"}`) redirect `/hw/adc8` permanent naar
  `/components/adc8` — voor de silk-opdruk `musicbrain.nl/hw/<naam>` op de
  borden. Beheerbaar via /admin → Site.
- Productpagina toont bij releases nu ook het **project** (MMB-vraag 3):
  twee projecten met hetzelfde versienummer zijn niet langer onleesbaar.
- Ingest-response meldt **`pinned_by`** (MMB-vraag 6): welke releases de
  zojuist gepubliceerde componentversie pinnen, met een waarschuwing als dat
  er nul zijn (dan verschijnt hij nergens op productpagina's).
- MMB-testcase "oude releases blijven benaderbaar" als herhaalbaar script:
  `npm run testcase:bitemporal -- <url> <component>@<versie>`.
- Write-API kan nu **terugtrekken**: `DELETE /api/content/<type>/<slug>`
  (Bearer-token) zet een bitemporale tombstone — het item verdwijnt direct
  uit alle publieke lijsten, de historie blijft en is via admin History →
  Restore terug te halen. Voor het MMB-scenario "verkeerd genummerde release"
  (terugtrekken + onder de juiste slug opnieuw posten); recept in de
  ingest-gids.
- `npm run db:seed -- --only=<types>` seedt een subset (bijv. `--only=themes`
  om de thema's aan een bestaande database toe te voegen zonder bewerkte
  content te overschrijven).
- `npm run smoke -- <url>`: read-only post-deploy-check (home, admin, API,
  write-API-dicht, thema's) — voor na elke Plesk-update.

## [0.9.0] - 2026-07-16
- **Gebruikersbeheer**: `/admin/users` — admins voegen gebruikers toe, wijzigen
  rollen, resetten wachtwoorden (gegenereerd, één keer getoond) en verwijderen
  accounts; iedereen die is ingelogd wijzigt er zijn eigen wachtwoord (huidige
  vereist). De laatste admin kan zichzelf niet degraderen of verwijderen.
  Buitengesloten? `npm run user -- passwd <naam>` op de server is de weg terug
  — een reset-mail is er bewust niet; `npm run user` doet ook
  list/add/role/delete. Wachtwoordregels en hashing
  staan nu één keer in `content-core` (`passwords.ts` + `DbUserStore`), gedeeld
  door admin, seed en CLI. Let op: een sessiecookie blijft na een reset tot 12u
  geldig in een browser die al openstond.
- **Theming**: een thema is nu content (`type: "theme"`, kleurtokens + fonts),
  bewerkbaar in de admin met kleurpickers en live palet-preview. De site
  rendert thema's als CSS-vars op `[data-theme]`; een gebruikers-switcher in
  de header (IDE-stijl) wisselt direct en onthoudt de keuze (no-flash script).
  Meegeleverd: **dark, light en neon**. Zie architecture.md §3c.
- Zes nieuwe widgets: **hero** (kop + CTA), **video** (YouTube/Vimeo
  privacy-embed of bestand), **accordion**/FAQ (zonder JS), **divider**,
  **downloads** (release-downloads met versie + checksum, W7) en **posts**
  (devlog-feed, W6-deel).
- Lightroom-shares in de `album`-widget werken nu écht: de provider loopt de
  publieke share-API af (space → resources → album → renditions) en toont de
  volledige fotoset i.p.v. alleen een linkkaart. Geverifieerd met een echte
  share (11 foto's).
- Map-editor: coördinaten met decimalen zijn nu gewoon te typen (punt of
  komma); de controlled input at voorheen de punt op bij elke toetsaanslag.
- Carousel toont de hele foto (object-contain, letterboxed) i.p.v. een
  bijgesneden doorsnede.

## [0.8.0] - 2026-07-14
- Changelog + release-ritueel: `npm run release -- <versie>` (bumpt versies,
  verplaatst changelog-notities, commit + tag); zie `docs/releasing.md`.
- README: expliciete "Lokaal draaien (from scratch)"-sectie met vereisten
  (Node ≥ 20, draaiende Docker), de twee env-bestanden en de db:up → migrate →
  seed-volgorde uitgelegd.
- Db-container krijgt een healthcheck en `db:up` gebruikt `--wait`, zodat
  `db:migrate` er direct achteraan kan zonder opstart-race.
- Backlog (`docs/backlog.md`): open punten uit de README, de requirements en de
  bouwsessies op één plek.
- Zes nieuwe widgets: **gallery** (fotoraster met lightbox, kan de media van de
  pagina-subject meenemen), **carousel** (met auto-advance), **album** (view op
  een externe foto-repo: JSON-API of een Lightroom-share als best-effort/link-
  kaart), **map** (interactieve OpenStreetMap/Leaflet met markers en markdown-
  popups), **kanban** (kolommen met kaarten) en **itinerary** (de reis van
  componenten door de releases van een product).
- Custom editors voor de nieuwe widgets: fotorijen (gallery/carousel), markers
  (map) en een bord-editor (kanban, kaarten verplaatsen met pijltjes).
- Productpagina toont `product.media` als galerij (W3-foto's).

## [0.7.1] - 2026-07-14
- Asset-bestandsnamen krijgen een content-hash (`render-top.<sha8>.png`), zodat
  her-publiceren met nieuwe bytes een nieuwe URL geeft — de lange
  `immutable`-cache blijft correct én toont verse renders.
- Engine-versietags (v0.1.0–v0.7.0) retroactief gezet; package-versies
  gelijkgetrokken met de git-tags.

## [0.7.0] - 2026-07-14
- Navigatie: per-type pagina's (`/products`, `/components`, `/releases`) die het
  item als subject renderen; de keten product → release → component → board is
  klikbaar (en terug via "Used in" op de componentpagina).
- `template`-widget (Mustache merge fields) en `list`-widget (volgt de
  content-graaf) — de bouwstenen voor default-views.
- Studio-bewerkbare default-views per contenttype (`_view/<type>`-pagina's) met
  een "preview als"-keuze; hand-gecodeerde weergave blijft de fallback.
- Hybride board-view (statisch overzicht ↔ interactieve hotspots) met
  inklapbare connectors/pinouts.

## [0.6.0] - 2026-07-13
- `board-spec` end-to-end: eigen contenttype (connectors, nets, assets,
  secties), per ComponentVersion; multipart-ingest met de **AssetStore**
  (file-backend, MinIO/S3-klaar) en serveerroute; `BoardSpecView` +
  `boardspec`-widget; afleiding van een board-widget uit de spec.
- MMB-ingest-handleiding voor de consument.

## [0.5.0] - 2026-07-13
- Product/component/release-domein: componenten als herbruikbaar contenttype,
  releases met component-versies, afgeleide component-itinerary.
- Write-API voor product-projecten (token-geauth POST, los + bundle).
- Referentie-integriteit tussen contenttypen met een beheerscherm.
- `VersionNumber` als zelf-validerend datatype; widget-versie + help in het
  contract; inline-code in de editor.

## [0.4.0] - 2026-07-13
- Read-only content-API over dezelfde ContentStore.
- Widgetbibliotheek uitgebreid (table met grid-editor, image, callout/CTA,
  embed, board-annotations) en markdown-editor met live preview.
- Sticky studio-sidebar.

## [0.3.0] - 2026-07-12
- WYSIWYG-achtige studio: het canvas ís de pagina (echte viewers, echte
  omlijsting), sidebar per widget, serverside draft met direct effect.
- Vakken-layout (Pleio-stijl): rijen → cellen → widgets.
- Menu-editor.

## [0.2.0] - 2026-07-07
- v1: MariaDB met bitemporal-light opslag (versiehistorie + rollback),
  admin-UI met widget-composer, formulieren uit de zod-schema's, Plesk-deploy
  (Passenger `server.js`), drizzle-migraties en seed.

## [0.1.0] - 2026-07-07
- v0: de eerste echte motor — content-in, statische site-uit, met het
  zod-gevalideerde contentmodel, de `ContentStore`-interface (file-backed) en
  composeerbare widget-pagina's. Eerste imprint: MusicBrain.

# Verzoek van MMB: 3D-tab in de board-widget (GLB + model-viewer)

Van het MusicBrain-hardwarespoor, 2026-07-17. Mark wil op de bordpagina's
naast "overzicht" en "pinouts" een derde tab **"3D"**: het bord vrij
draaien/zoomen. Wij hebben optie-onderzoek gedaan (sprites vs. echt 3D,
zie `MusicBrain/doc/imprint-widget-3d-voorstel.md`); besluit Mark: **echt
3D met GLB** — beste beleving, en de assets zijn zelfs kleiner dan een
sprite-set.

## Update 2026-07-22 — widget werkt live; matrix-GLB staat klaar

- **De 3D-tab werkt inmiddels live** (bv. busboard "Board v3.1" toont hem;
  `/boards/musicbrain-busboard.glb` wordt statisch geserveerd, 200). Punt 2
  (widget-tab) is dus af. 👍
- **Nieuw bord klaar: de patchmatrix (center-variant).**
  `musicbrain-matrix-c.glb` (5,7 MB) is met `widget_export.py --3d`
  gegenereerd en staat in `sites/musicbrain/public/boards/`. **Alleen de
  center-variant (component `matrix`, versie `v0.3c`) heeft 3D nodig** — de
  edge-variant `v0.2` is het afgeserveerde alternatief, dat hoeft niet.
- **Localhost vs live wijken af (2026-07-22 getest):** op **localhost:3000**
  stript de ingest `assets.model3d` én het `view3d`-blok nog (POST mét
  `--glb`/`view3d` → beide velden `null` bij GET). Op **live** kon ik het
  níét betrouwbaar vaststellen: het endpoint `GET /api/content/board-spec/
  <slug>` bestaat daar niet (`Unknown content type "board-spec"`) — live
  draait dus een andere build. Een `publish_board.py --glb` naar live gaf
  wél `"ok":true` maar `model3d` bleef leeg via het (afwijkende) GET-pad.
  Kortom: de wiring is vanaf de MMB-kant niet te introspecteren; busboard's
  live-3D werkt, maar hóe precies zien wij hier niet.
- **Graag terug naar de MMB-chat (jullie zien de live-DB/-build wél):**
  (1) accepteert de **live**-ingest `model3d`/`view3d` al, of moet dat nog?
  (2) hoe is busboard's 3D gekoppeld — versioned `assets.model3d` of
  statisch `view3d.src` + GLB in `public/boards/`? Met dat antwoord posten
  wij matrix in één commando (`publish_board.py --glb`) of leveren we de
  GLB voor de statische route aan. De `musicbrain-matrix-c.glb` staat
  hoe dan ook al klaar.

## Wat er al klaarstaat (MMB-kant is af)

- **GLB per bord** in `sites/musicbrain/public/boards/`:
  `gswitch-brain.glb` (2,7 MB), `gswitch-loop8.glb` (2,9 MB),
  `gswitch-loop8sh.glb` (2,6 MB). Gemaakt met
  `kicad-cli pcb export glb --subst-models --include-soldermask
  --include-silkscreen` (lichte variant; een `--3d-full` met kopersporen
  bestaat ook, ~2× zo groot).
- `widget_export.py --3d` (MusicBrain-repo) genereert de GLB en zet een
  `view3d`-blok in de widget-config; `publish_product.mjs` stuurt de GLB
  mee als spec-asset (`model.glb` → `assets.model3d`) en het blok als
  `view3d` op het board-spec-doc.
- Dit is al naar **localhost:3000** gepost (guitar-switcher-set), maar de
  ingest **stript nu `view3d` en `assets.model3d`** (schema-whitelist) —
  eerste dat open moet.

## Gevraagd aan Imprint

1. **Ingest-schema verruimen** (board-spec):
   - `assets.model3d: string` (bestandsnaam, net als `renderTop`) en het
     asset-bestandstype `.glb` (binair glTF; `model/gltf-binary`)
     accepteren/opslaan zoals de overige assets (bitemporaal versioned).
   - top-level `view3d`-blok doorlaten:

   ```jsonc
   "view3d": {
     "mode": "glb",                        // later evt. "sprites"/"gallery"
     "src": "/boards/<slug>.glb",          // statisch pad (zoals image nu)
     "poster": "/boards/<slug>.png"        // placeholder tot activatie
   }
   ```

   `src`/`poster` volgen dezelfde conventie als het huidige
   `image`-veld van de widget (statisch `public/boards/`); als jullie
   liever het versioned spec-asset serveren: `assets.model3d` staat er
   ook — kies wat het beste bij de asset-cache past en zeg het ons even.

2. **Widget: derde tab "3D"** (naast render+hotspots en pinouts):
   - viewer: **`<model-viewer>`** (Google, zelf te hosten ESM-bundel
     ~300 KB, licentie Apache-2.0) of three.js `GLTFLoader` als jullie al
     three gebruiken. `<model-viewer>` geeft draaien/zoomen/traagheid,
     `camera-controls`, `poster`-attribuut en lazy loading vrijwel gratis.
   - **lazy**: de GLB (± 3 MB) pas laden bij de eerste activatie van de
     tab; tot die tijd de poster tonen.
   - beginstand: driekwart van schuin boven (bijv. camera-orbit
     "30deg 55deg" — de informatieve hoek), auto-rotate uit.
   - geen tab tonen als `view3d` ontbreekt (oude specs blijven werken).
   - mobiel: pinch-zoom en één-vinger-orbit zijn standaard in
     model-viewer; niets extra's nodig.

3. **Acceptatie** (voorstel):
   - board-spec-POST met `view3d` + `model.glb` komt onveranderd terug
     bij GET;
   - `/hw/gswitch-loop8sh` toont de 3D-tab, laadt de GLB pas bij klik,
     draaien/zoomen werkt, poster verschijnt direct;
   - spec zonder `view3d` toont exact de huidige twee tabs.

## Hertesten / opnieuw posten

De data staat al lokaal; na de schema-verruiming kunnen wij (of jullie)
opnieuw posten met:

```bash
cd MusicBrain/hardware/kicad-generators
node publish_product.mjs --product reflex \
  --boards gswitch-brain,gswitch-loop8,gswitch-loop8sh \
  --release guitar-switcher@v0.1 --date 2026-07-11 \
  --base http://localhost:3000 --token test-ingest-token-123 \
  --assets-dir "D:/Git/Web/Imprint-engine/sites/musicbrain/public/boards"
```

Naar **live** posten we pas zodra de widget de tab echt rendert (Mark
geeft go). Cortex-borden volgen daarna met dezelfde tooling
(`widget_export.py --3d` draait voor elk bord).

Vragen/keuzes graag even terug naar de MMB-chat: (a) statisch pad of
versioned asset als `src`, (b) model-viewer of three, (c) of jullie de
GLB liever mét kopersporen zien (2× groter, iets echter oppervlak).

## Antwoord van Imprint — 2026-07-23 (matrix staat weer op 3D)

Kort: **er wordt niets gestript en de widget is compleet.** Schema, ingest
én render kennen `view3d` + `assets.model3d` (sinds commit `6426753`, zit in
`main`); de "3D"-tab verschijnt op elke board-spec waar
`assets.model3d ?? view3d.src` gevuld is. `@google/model-viewer` is
geïnstalleerd, de GLB's staan statisch in `public/boards/`. Dus geen
Imprint-bug — het was een **data-overschrijving**.

### Waarom matrix "niet toonde" (de echte oorzaak)

De DB-historie van `matrix@v0.3c` liegt niet:

| tx_from (localhost) | staat | `view3d` | `assets.model3d` |
|---|---|---|---|
| 07-21 15:07 | old | — | — |
| 07-22 15:31 | old | — | ✅ (via `--glb`) |
| 07-22 15:33 | old | ✅ `/boards/musicbrain-matrix-c.glb` | — |
| **07-22 15:34** | **CURRENT** | **—** | **—** |

Jullie hébben 3D toegevoegd — twee keer zelfs (15:31 zette `model3d`, 15:33
zette `view3d`). Maar **35 seconden later, om 15:34, liep er nóg een gewone
publish zónder 3D-blok, en die overschreef alles.** Die kale versie is de
CURRENT geworden → geen 3D → geen tab.

De kern: **elke board-spec-POST is een volledige documentvervanging**
(bitemporal put, §B3 — geen veld-merge). Laat een POST `view3d`/`model3d`
weg, dan zegt hij impliciet "die horen er niet meer bij" en verdwijnen ze
uit de huidige versie. Jullie pipeline heeft twee losse publish-stappen (een
gewone + een `--glb`/`--3d`), en de gewone draaide als laatste. Dat busboard
wél werkt, is puur omdat dáár de 3D-publish toevallig als laatste liep
(`busboard@v3.1` CURRENT heeft `model3d` gezet).

### Matrix is gefixt (op localhost)

We hebben `matrix@v0.3c` opnieuw gepost mét het `view3d`-blok (statisch pad,
de GLB stond al klaar) — de tab staat weer live:

```jsonc
"view3d": { "mode":"glb", "src":"/boards/musicbrain-matrix-c.glb",
            "poster":"/boards/musicbrain-matrix-c.png" }
```

### De afspraak: publiceer in één POST (geen kale nabrander)

Geen PATCH-endpoint nodig — de schoonste fix zit in jullie tooling:
**publiceer de board-spec in één POST met het 3D-blok erin**, en laat er
geen tweede, kale publish achteraan lopen die het overschrijft.
`widget_export.py` genereert het `view3d`/`model3d`-blok al; zorg dat de
board-spec-export dat blok in hetzelfde doc meestuurt dat ook connectors/
pinouts/points bevat. Past bij het snapshot-model: één POST = de complete
waarheid van die versie.

(Willen jullie 3D later kunnen toevoegen zónder de hele spec te
regenereren, dan bouwen wij een echte `PATCH` — dat wordt onder water
read-current → merge → nieuwe volledige snapshot-rij. Zeg maar of dat nodig
is; voor nu is "alles in één POST" genoeg.)

### Antwoord op jullie twee open vragen

1. **Accepteert de ingest `model3d`/`view3d` al?** Ja, volledig — schema +
   multipart-ingest (`/api/ingest/board-spec`) bewaren beide; de GLB gaat
   als binair asset (`model/gltf-binary`) de asset-store in en de bare
   bestandsnaam wordt herschreven naar de content-hashed URL. Wat jullie op
   localhost als "null" zagen, was de **overschrijving** hierboven, niet het
   schema.
2. **Hoe is busboard's 3D gekoppeld?** Via **`view3d.src` = statisch pad**
   (`/boards/musicbrain-busboard.glb`), met daarnaast een versioned
   `assets.model3d` in de asset-store. De render kiest
   `assets.model3d ?? view3d.src`, dus de versioned asset wint als beide er
   zijn; ontbreekt die, dan valt hij terug op het statische pad. Eén van de
   twee volstaat.

### Verifiëren doe je via het MEERVOUD-endpoint

Let op de asymmetrie die jullie het verkeerde spoor op stuurde:
- **POST** = enkelvoud: `POST /api/content/board-spec/<slug>` (of multipart
  `/api/ingest/board-spec`).
- **GET** = **meervoud**: `GET /api/content/board-specs/<slug>`.

`GET /api/content/board-spec/<slug>` (enkelvoud) geeft *"Unknown content
type"* — op localhost én live, ook op de huidige build. Dat was dus géén
bewijs van een oude live-build; het is gewoon het verkeerde pad. Jullie
kunnen na een POST altijd zó controleren:

```bash
curl -s "$BASE/api/content/board-specs/matrix@v0.3c" \
  | jq '{view3d, model3d: .assets.model3d}'
```

Zodra jullie go geven posten we matrix (en de rest) op dezelfde manier naar
live.

## Gefixt MMB-kant — 2026-07-23 (matrix live met 3D)

Dank, glashelder. Twee eigen fouten rechtgezet:
- **`publish_board.py` stuurt het 3D-blok nu in DEZELFDE POST mee** (leest
  `view3d` uit de widget-json; detecteert anders de statische GLB; upload de
  GLB als `model.glb` → `model3d`). Geen kale nabrander meer die het wist.
- Verificatie voortaan via het **meervoud**-endpoint
  `GET /api/content/board-specs/<slug>`.

Resultaat: `matrix@v0.3c` opnieuw gepost naar **localhost én live**; beide
hebben nu `view3d` + `model3d`, en de live-asset
`/api/assets/matrix/v0.3c/model.<hash>.glb` wordt geserveerd (200,
`model/gltf-binary`). De 3D-tab staat dus live. Geen PATCH nodig — "alles in
één POST" volstaat. 🙏

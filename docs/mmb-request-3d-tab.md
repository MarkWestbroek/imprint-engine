# Verzoek van MMB: 3D-tab in de board-widget (GLB + model-viewer)

Van het MusicBrain-hardwarespoor, 2026-07-17. Mark wil op de bordpagina's
naast "overzicht" en "pinouts" een derde tab **"3D"**: het bord vrij
draaien/zoomen. Wij hebben optie-onderzoek gedaan (sprites vs. echt 3D,
zie `MusicBrain/doc/imprint-widget-3d-voorstel.md`); besluit Mark: **echt
3D met GLB** — beste beleving, en de assets zijn zelfs kleiner dan een
sprite-set.

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

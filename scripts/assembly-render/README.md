# Montagevideo van de hardware-unit (route A)

`render_assembly.py` rendert met Blender dezelfde choreografie als de
`assembly`-widget op de site: de page-config (standaard
`sites/musicbrain/content/pages/cortex.json`, of live via `--page cortex`),
de KiCad-GLB's van de board-specs (opgehaald uit de site-API en gecachet in
`.cache/assembly-render/`) en het paneel-SVG met accessoires. Zo blijft de
video gelijk aan wat de bezoeker op `/cortex` ziet; tune je de choreografie in
de studio, dan rendert de volgende video die ook.

## Draaien

Blender staat op deze desktop in `C:\Program Files\Blender Foundation\Blender 5.2\`.

```bash
# snelle controle (720p, 16 samples, geen audio)
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
  -P scripts/assembly-render/render_assembly.py -- --out out/assembly-preview

# definitief (1080p, 64 samples) met Marks take eronder
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
  -P scripts/assembly-render/render_assembly.py -- \
  --quality final --audio "D:/pad/naar/take.wav" --out out/cortex-assembly
```

Opties: `--page <slug>` (live page-config i.p.v. het bestand), `--base`
(standaard `https://musicbrain.nl`), `--fps` (30), `--hold` (seconden stilstand
aan het eind; standaard de `hold` van de widget), `--quality preview|final`.

Uitvoer: `<out>.mp4` en `<out>.blend` (open in de Blender-GUI om camera of
licht te verfijnen en opnieuw te renderen). Met `--audio` mengt ffmpeg (in
PATH) de take eronder met een fade-in van 1 s en een fade-out over de laatste
2 s; het geluid wordt afgekapt op de videolengte (`-shortest`).

## Wat het script wel en niet doet

- Oriëntatie en zitting per bord zijn dezelfde regels als in de widget
  (`sites/musicbrain/src/components/assembly-scene.tsx`): KiCad-normaal → de
  geconfigureerde as, `spin`/`flip`, en `at` is het bordvlak (de mesh met de
  grootste footprint). Het paneel is een 2D-curve met gaten, geëxtrudeerd.
- De camera draait in één langzame boog om de unit (70° over de hele duur).
  Belichting: drie zonnen (key/fill/rim) en een donkere wereld in de
  sitekleur. Voor filmischer werk: open de .blend en pas aan.
- Geen terugspoelen aan het eind (dat is voor de lus op de site); de video
  eindigt op de complete unit na `hold` seconden.

# MMB → Imprint: content uploaden (componenten, board-specs, producten)

Instructie voor het MusicBrain-hardwarespoor (de KiCad-toolkit) om
componenten, board-specs en productkoppelingen naar de Imprint-site te posten.
Alles gaat via de write-API; niets met de hand.

## Kernpunten vooraf

- **Auth:** elke schrijf-call stuurt `Authorization: Bearer <INGEST_TOKEN>`
  (het token staat in de deploy-omgeving van MMB, niet in git).
- **Een component is herbruikbaar over producten.** Eén component = één slug.
  Wil je hetzelfde component onder **cortex én reflex**, dan zet je die ene
  component-slug in de `components`-lijst van *beide* producten. Ja, dat kan.
- **Slugs die je nodig hebt:** de producten heten `cortex`, `reflex`, `relay`,
  `synapse` (stabiel). Onzeker? Haal ze op: `GET /api/content/products` geeft
  alle producten met hun `slug`.
- **Board-spec hangt per ComponentVersion** (afgesproken): slug-conventie
  `<component>@<versie>`, bijv. `busboard-v2@v2.0`.
- **Referenties worden afgedwongen.** Een verwijzing naar niet-bestaande
  content wordt geweigerd (HTTP 422). Post daarom in deze **volgorde**:

  1. **componenten** (die nergens naar verwijzen, of alleen naar hun children —
     post dan eerst de children);
  2. **producten koppelen** (product.components verwijst naar componenten);
  3. **board-specs** (verwijzen naar hun component);
  4. **releases** (verwijzen naar product + componenten).

- **Bijwerken = read-modify-post** (jouw verantwoordelijkheid als consumer):
  haal het huidige item op, pas aan, post het volledige item terug. Elke post
  wordt een nieuwe bitemporale versie (oude blijft in de historie).

## 1. Componenten posten

```
POST /api/content/component/<slug>      Authorization: Bearer <TOKEN>
Content-Type: application/json

{ "slug": "busboard-v2", "name": "Busboard v2", "description": "…",
  "children": ["adc8", "dac8"],
  "versions": [ { "number": "v2.0" }, { "number": "v2.1", "spec": "busboard-v2@v2.1" } ] }
```

- `children` = geneste componenten (post die eerst, anders 422).
- `versions[].spec` is optioneel: de board-spec-slug voor die revisie. Je kunt
  'm nu al invullen (de board-spec zelf mag je daarna posten).

## 2. De component→product-mapping (jij bezit die kennis)

MMB weet uit de BOM welke componenten (en subcomponenten) bij welk product
horen — Imprint niet. **Jij legt die mapping dus vast**, op twee plekken:

- **Subcomponenten** → `component.children[]` (slugs). Een busboard die modules
  bevat: post die modules als eigen componenten, en zet hun slugs in
  `children`. Post de children eerst (anders 422).
- **Component onder een product** → `product.components[]` (slugs). Ligt op het
  product, niet op het component. Hetzelfde component-slug mag in meerdere
  producten staan (dat is het hele punt van herbruikbare componenten).

Voorbeeld: hoort de busboard bij cortex én reflex, dan komt `"busboard-v2"` in
`cortex.components` én `reflex.components`. Voeg 'm toe per product met
read-modify-post:

```bash
# huidige product ophalen
curl -s $BASE/api/content/products/cortex > cortex.json
# component-slug toevoegen aan .components (met jq of in je script)
jq '.components += ["busboard-v2"] | .components |= unique' cortex.json > cortex2.json
# terugposten (het HELE product; anders verlies je velden)
curl -X POST $BASE/api/content/product/cortex \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d @cortex2.json
# idem voor reflex
```

> Let op ownership: cortex/reflex bevatten nu placeholder-teksten (naam,
> tagline). Post je het hele product, dan overschrijf je die. Wil MMB alleen
> de componenten koppelen en de teksten met rust laten, gebruik dan de
> read-modify-post hierboven (je behoudt de bestaande velden). Wil MMB de
> productdefinitie bezitten, post dan de volledige, correcte product-JSON.

## 3. Board-spec + assets uploaden (multipart)

Eén request met de JSON én de bestanden. De backend slaat de bestanden op,
herschrijft de bestandsnamen in `doc` naar URL's, en bewaart de board-spec.
Het component (met die versie) moet al bestaan.

```
POST /api/ingest/board-spec             Authorization: Bearer <TOKEN>
Content-Type: multipart/form-data

  doc = {
    "slug": "busboard-v2@v2.0",
    "component": "busboard-v2",
    "version": "v2.0",
    "connectors": [
      { "ref": "J1", "label": "Power", "rows": 2,
        "pins": [ { "pin": "1", "net": "+12V" }, { "pin": "2", "net": "GND" } ] }
    ],
    "assets": {
      "renderTop": "render-top.png",
      "overview":  "overview.svg",
      "pinouts":   { "J1": "pinout-J1.svg" }
    },
    "sections": [ { "heading": "Overzicht", "markdown": "De busboard verdeelt…" } ]
  }
  <bestandsveld> = render-top.png
  <bestandsveld> = overview.svg
  <bestandsveld> = pinout-J1.svg
```

- In `doc` verwijs je naar **kale bestandsnamen**; die moeten exact matchen met
  de meegestuurde bestanden. Elke match wordt een URL (`/api/assets/…`).
- De veldnamen van de bestanden (hierboven `<bestandsveld>`) doen er niet toe —
  alleen de bestandsnaam telt.
- Antwoord: `{ "ok": true, "slug": "...", "assets": { "overview.svg": "/api/assets/…", … } }`.

curl-voorbeeld:
```bash
curl -X POST $BASE/api/ingest/board-spec \
  -H "Authorization: Bearer $TOKEN" \
  -F "doc=$(cat busboard-v2-v2.0.json)" \
  -F "f1=@renders/render-top.png" \
  -F "f2=@overzicht/overview.svg" \
  -F "f3=@pinouts/pinout-J1.svg"
```

## 4. Releases posten

De release is de schakel die **product ↔ component-versies** verbindt: hij
noteert welke componentversies in welke uitgave van het product zitten. Zonder
release toont de site wél het product en zijn componenten, maar niet "welke
versie zat in v0.2". Voor het complete pad post je dus ook de releases.

```
POST /api/content/release/<project>-<versie>
{ "project": "modular-mb", "product": "cortex", "version": "v0.2",
  "date": "2026-06-01",
  "components": [ { "component": "busboard-v2", "version": "v2.1" } ] }
```
`product` en elke `components[].component` moeten bestaan (anders 422) — vandaar
de volgorde hieronder.

## Welke versie toont de site? (MMB-vraag 4)

Kort: **de componentpagina volgt geen releases.** Drie weergaven, drie regels:

- **Componentpagina** (`/components/<slug>`): toont **álle versies** uit
  `component.versions[]`, in de volgorde waarin jij ze post, elk met hun
  board-spec. Kanalen (dev/beta/stable) wegen hier niet mee — de pagina kijkt
  alleen naar het component zelf.
- **Releasepagina** (`/releases/<slug>`): toont exact wat díe release pint
  (`components[]{component, version}`). Hier klopt jullie mentale model
  "de site toont wat de release vastpint" — maar alleen op deze pagina.
- **Productpagina**: toont de releases van het product (met project + kanaal)
  en de componenten van het product (alle versies, zoals de componentpagina).

"Wint stable van dev bij gelijke recentheid?" — nee, er ís nog geen weging:
niets in de weergave kiest op kanaal. De verfijning "componentpagina toont de
door de nieuwste (stable-)release gepinde versie prominent, ouderen als
archief" staat op de Imprint-backlog (aangevraagd via jullie testcase).

## 6. Item terugtrekken (verkeerd gepost? DELETE)

Fout genummerde release, verkeerde slug, per ongeluk gepubliceerd:

```
DELETE /api/content/<type>/<slug>[?lang=en]    Authorization: Bearer <TOKEN>
```

Dit is een **bitemporale tombstone**, geen wissing: het item verdwijnt
onmiddellijk uit alle publieke lijsten en API's, maar de volledige historie
blijft bewaard en is via de admin (History → Restore) terug te halen. Zelfde
mechanisme als de Delete-knop in de admin.

- Hernoemen bestaat niet (de slug ís de identiteit): terugtrekken + opnieuw
  posten onder de juiste slug.
- Voorbeeld — `cortex-v0.2` had `cortex-v0.3` moeten heten:
  ```bash
  curl -X DELETE "$BASE/api/content/release/cortex-v0.2" -H "Authorization: Bearer $TOKEN"
  curl -X POST   "$BASE/api/content/release/cortex-v0.3" -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" -d @cortex-v0.3.json
  ```
- Antwoord: 200 met een notitie; 404 als er (voor die taal) geen actueel item
  is; 401 zonder token.

## Het volledige pad (product → release → component → board)

MMB kan de **hele keten** posten; alle drie de niveaus zijn schrijfbaar. In
deze volgorde (elke stap verwijst alleen naar wat er al staat):

1. **Componenten** — `POST /api/content/component/<slug>` (children/sub-
   componenten eerst, dan de ouders met hun `children`-slugs).
2. **Board-specs** — `POST /api/ingest/board-spec` per bord-revisie (multipart,
   met de assets). Verwijst naar het component uit stap 1.
3. **Producten koppelen** — per product read-modify-post om de component-slugs
   in `components` te zetten (de BOM-mapping die jij kent). Het product zelf
   mag je aanmaken of, als Imprint 'm bezit, alleen aanvullen.
4. **Releases** — `POST /api/content/release/<slug>` met `product` +
   `components[]{component,version}`. Verwijst naar product (stap 3) en
   componenten (stap 1).

Daarmee is de site-navigatie volledig klikbaar: productpagina → releases →
release → componenten → board. Alles idempotent: opnieuw draaien maakt nieuwe
versies en overschrijft niets in de historie.

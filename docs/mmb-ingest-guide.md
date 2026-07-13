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

## 2. Component onder cortex én reflex hangen

De relatie leeft op het **product** (`product.components[]`). Dus voeg de
component-slug toe aan elk product. Read-modify-post per product:

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

## 4. Releases posten (optioneel)

```
POST /api/content/release/<project>-<versie>
{ "project": "modular-mb", "product": "cortex", "version": "v0.2",
  "date": "2026-06-01",
  "components": [ { "component": "busboard-v2", "version": "v2.1" } ] }
```
`product` en elke `components[].component` moeten bestaan (anders 422).

## Samengevat: de happy path van een MMB-publicatierun

1. `POST` alle componenten (children eerst).
2. Per product (`cortex`, `reflex`, …): read-modify-post om de component-slugs
   in `components` te zetten.
3. `POST /api/ingest/board-spec` per bord-revisie (multipart, met de assets).
4. Optioneel `POST` releases.

Alles idempotent: opnieuw draaien maakt nieuwe versies, overschrijft niets in
de historie.

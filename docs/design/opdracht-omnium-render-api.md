# Opdracht: render-API voor modeldiagrammen (Omnium → Imprint)

> Van: Imprint (Mark). Aan: bitemporal / Omnium Studio. Datum: 25 september 2026.
> Context: Imprint toont modellen uit Omnium op webpagina's (widget
> `v3model`, straks "diagram uit Omnium"). Imprint wil **niet** zelf tekenen:
> layout, kleuren en notatie horen bij de bron. Zie
> `docs/design/plank-widgets-en-plugins.md` §2.1 in de Imprint-repo.

## 1. Gevraagd

Een HTTP-API van Omnium die een **diagram als SVG** teruggeeft, op twee
manieren aan te roepen:

| Vorm | Wanneer | Aanroep |
|---|---|---|
| **Model-link** | het model leeft in Omnium; Imprint verwijst ernaar | `GET /api/models/{modelId}/diagram.svg` |
| **Model-code** | het model wordt meegegeven (geplakt in Imprint, of gegenereerd zoals `/api/meta?format=v3`) | `POST /api/render/svg` |

Voor **alle modelleertalen** die Omnium kent, met het **canonieke model (V3)**
als eerste; de taal is een parameter, de respons is altijd SVG.

## 2. Interface

### 2.1 `GET /api/models/{modelId}/diagram.svg`

Queryparameters (alle optioneel):

| Parameter | Betekenis | Default |
|---|---|---|
| `diagram` | naam van een opgeslagen diagram in het model (`diagrammen[].naam`) | het hoofddiagram, of alles |
| `taal` | notatie/modelleertaal als het model er meer ondersteunt | de taal van het model |
| `theme` | `light` \| `dark` \| `auto` | `auto` (zie §3) |
| `velden` | `true` \| `false` — velden in de entiteitkaarten tonen | `true` |
| `entiteiten` | kommalijst: alleen deze entiteiten (en hun onderlinge relaties) | alle |
| `asOf` | tijdstip (ISO 8601) — het model zoals het toen was (bitemporeel) | nu |

Respons: `200`, `Content-Type: image/svg+xml; charset=utf-8`, body = het SVG-
document. `404` als model of diagram niet bestaat, `400` bij een onbekende
parameter.

### 2.2 `POST /api/render/svg`

Body (JSON):

```jsonc
{
  "taal": "v3",                 // verplicht: v3 | … (de talen die Omnium kent)
  "model": { /* V3Model */ },   // óf `model` (object) …
  "code": "…",                  // … óf `code` (tekst in die taal)
  "diagram": "Overzicht",       // optioneel, als het model diagrammen bevat
  "theme": "auto",
  "velden": true
}
```

Respons als 2.1. `422` met een leesbare foutmelding (regel/kolom of
elementnaam) als het model niet valideert — Imprint toont die melding aan de
redacteur.

### 2.3 Caching

- `ETag` en `Last-Modified` op de GET; Imprint doet `If-None-Match`.
- Een render is puur: dezelfde invoer → dezelfde SVG (geen tijdstempels of
  willekeurige id's in de uitvoer), anders werkt caching en de golden-test in
  Imprint niet.

## 3. Eisen aan de SVG

Zodat het diagram in een webpagina meebeweegt en het sitethema volgt:

1. **`viewBox`** aanwezig, **geen** vaste `width`/`height` (of `width="100%"`).
   Imprint zet zelf een maximale breedte.
2. **Kleuren**: tekst en lijnen als `currentColor`; achtergronden als
   CSS-variabelen met fallback, bv. `fill="var(--diagram-surface, #fff)"`.
   Domein-/elementkleuren (uit het model) mogen letterlijk in de SVG staan.
   Bij `theme=auto` levert Omnium één SVG die met `light-dark()` of met
   `var(--…)` beide kanten op kan; `light`/`dark` leveren vaste kleuren.
3. **Lettertypen**: generieke families (`ui-sans-serif, system-ui` /
   `ui-monospace`), geen `@font-face` met externe URL.
4. **Toegankelijkheid**: `<title>` + `role="img"` en `aria-label` op het
   `<svg>`; entiteitnamen als tekst (geen paden), zodat ze doorzoekbaar zijn.
5. **Klikbaar (optioneel)**: `<a href="…">` om een entiteit, naar de bron in
   Omnium of naar een door Imprint meegegeven URL-patroon
   (`linkPattern=/model/{entiteit}`).
6. **Veilig**: geen `<script>`, geen `on*`-attributen, geen externe
   `<image>`/`<use href="http…">`, geen `<foreignObject>`. Imprint saneert
   sowieso, maar een SVG die die stap ongeschonden doorkomt is de bedoeling.
7. **Stabiele id's**: `id`-attributen afgeleid van elementnamen (bv.
   `ent-Artikel`), niet oplopend gegenereerd; Imprint kan meerdere diagrammen
   op één pagina zetten, dus een prefix-parameter (`idPrefix`) is welkom.

## 4. Hoe Imprint het gebruikt

- Serverside ophalen bij het renderen van de pagina (build/ISR of per request),
  via de bronnen-laag van Imprint (host-allow-list, cache-TTL, secret bij
  naam als de API authenticatie vraagt).
- SVG saneren en **inline** in de HTML plaatsen (geen `<img>`), zodat hij de
  sitekleuren erft, schaalt en doorzoekbaar is.
- Fout (4xx/5xx/timeout) → de widget toont de melding van Omnium plus de
  bron (model-link of code), de pagina blijft verder werken.

## 5. Authenticatie

Publieke modellen: geen. Anders: een API-sleutel in een header
(`Authorization: Bearer …`); Imprint bewaart die als secret en zet hem er
serverside bij — hij komt nooit in de browser.

## 6. Niet gevraagd (bewust)

- Geen PNG/PDF; SVG volstaat, de browser drukt af.
- Geen interactieve viewer (zoomen, slepen) — dat is Omnium Studio zelf;
  Imprint linkt daarheen.
- Geen layout-algoritme aan de Imprint-kant. Wat er nu in Imprint staat
  (`packages/widgets-standard/src/v3-diagram.tsx`) is een tijdelijke
  tekenaar en vervalt bij oplevering.

## 7. Acceptatie

1. `GET …/diagram.svg` op het MusicBrain-contentmodel (`/api/meta?format=v3`
   als `POST`-body) geeft een SVG die inline op een Imprint-pagina in licht
   én donker thema leesbaar is.
2. Dezelfde aanroep twee keer → byte-gelijke SVG.
3. Een ongeldig model → `422` met een melding die zegt wélk element fout is.
4. Twee diagrammen op één pagina botsen niet (id's).

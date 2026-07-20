# Imprint-contentmodel op het V3-metamodel

> **Bron**: aangeleverd door Mark uit het bitemporal-project (Omnium Studio),
> 2026-07-20 (origineel: `imprint-contentmodel-v3.md` aldaar). Dit is het
> contract achter `GET /api/meta?format=v3`; de Imprint-kant van de mapping
> staat in `sites/musicbrain/src/lib/v3-export.ts`.

> Doel: beschrijven hoe het V3-metamodelformaat van dit register (Omnium
> Studio) als **contentmodel** voor het CMS-project **Imprint** kan dienen,
> zodat de **formuliereditor** en de **veldpicker** (ModelPicker) uit deze
> repo daar hergebruikt worden. Functioneel + technisch (interface). Zie ook
> `docs/STUDIO.md` en `.github/copilot-instructions.md` voor het
> onderliggende bitemporele model.

## 1. Waarom V3 past op een CMS-contentmodel

Een CMS-site kent **content-typen** (pagina, artikel, product, auteur …) met
**velden** en **onderlinge relaties**, vaak gegroepeerd per **sectie/domein**
van de site. Dat is structureel hetzelfde als het V3-model: **Domein →
Entiteit → Gegevenselement/Relatie → Veld**, met daarnaast herbruikbare
**enums**, **datatypes** en **referentielijsten**.

De formuliereditor laat een ontwerper een formulier samenstellen door velden
uit dit model te kiezen. Voor Imprint betekent dat: als het CMS zijn
contentmodel als V3 (of een V3-subset) aanbiedt, kan de bestaande editor er
direct velden uit "de projectboom" plukken — zonder dat Imprint (nu al) een
bitemporele DB heeft.

## 2. Twee vormen — en waarom de geneste vorm hier de juiste is

Het schema-endpoint `GET /api/schema/model/code` levert twee representaties:

| Vorm | Sleutel | Structuur | Geschikt als … |
|------|---------|-----------|----------------|
| **V3Model** | `model` | **genest**: domein-metadata + entiteiten → GE/relatie → veld | **projectboom** waar de editor door navigeert |
| flat registry | `types` | platte lijst DTO's, één per type | snelle veld-lookup / drag-source |

Voor Imprint kiezen we de **geneste `V3Model`** als contract: de
formuliereditor kijkt naar de **projectboom** en pikt daar de data-elementen
uit. De platte `types`-lijst blijft beschikbaar als afgeleide voor de picker,
maar is niet het primaire model.

Go-definitie van de geneste vorm: `model/v3_format.go` (`V3Model`). Export
uit een draaiend register: `model/v3_exporter.go` (`ExportMetaRegistryToV3`).

## 3. V3Model — de geneste structuur (het contract)

```
V3Model
├─ versie            (verplicht, bv. "v1.0.0")
├─ naam, beschrijving
├─ domeinen[]                    ← groepering + metadata (kleur, prefix, versie)
├─ datatypes[]                   ← custom gegevenstypen + validatie + weergave-hints
├─ enums[]                       ← opsommingstypen
├─ referentielijstInstanties[]   ← apart genoemde referentielijsten (Landenlijst, …)
└─ entiteiten[]                  ← de content-typen
   ├─ typenaam, meervoud, domein, description
   ├─ erft / isAbstract          ← generalisatie (subtypes)
   ├─ gegevenselementen[]        ← de eigenlijke velddragers
   │  ├─ naam, momentvoorkomen   ← "enkelvoudig" | "meervoudig" (= herhaalbaar blok)
   │  ├─ velden[]                ← de data-elementen (zie §6)
   │  └─ afgeleideVelden[]       ← berekende velden (afleidingsregel + taal)
   └─ relaties[]                 ← associaties naar andere entiteiten
      ├─ doelEntiteit, momentvoorkomen, kardinaliteiten
      ├─ relatieSubtype, referentielijstInstantie
      └─ velden[]                ← eigen velden op de relatie
```

Belangrijk: **`domeinen[]` is metadata**, geen fysieke nesting. Entiteiten
dragen zelf een `domein`-label (string). De **boom** (domein → entiteit → …)
wordt door de consument opgebouwd door op dat label te groeperen — precies
wat `modelTree.js` doet in de ModelPicker. Voor Imprint mag je dit letterlijk
overnemen: groepeer entiteiten op `domein` = site-sectie.

### Waar de layout-/diagramvelden vandaan komen

`V3Model` bevat ook `diagrammen[]`, `notities[]`, `constraints[]` en per
element `positie`/`layoutLocked`. Dat is **UML-editor-layout** en wordt door
codegen én door de formuliereditor genegeerd. **Imprint heeft die velden niet
nodig** — laat ze weg.

## 4. Referentielijsten — op vier niveaus expliciet

Referentielijsten (keuzelijsten met beheerde waarden, bv. Landen,
EU-lidstaten) zijn in V3 op meerdere plekken zichtbaar:

1. **Top-level `referentielijstInstanties[]`** — de aparte, benoemde lijst:
   ```jsonc
   { "systeemnaam": "Landenlijst", "naam": "Landen", "omschrijving": "ISO-landen" }
   ```
2. **Als entiteit** — `entiteitSubtype: "referentielijst"` (de lijst) en
   `"referentielijst_item"` (de items). De lijst staat dus óók in `entiteiten[]`.
3. **Op relatie-niveau** — `relatieSubtype: "referentielijst_items"` +
   `referentielijstInstantie: "Landenlijst"` bindt een GE/relatie aan een
   concrete lijst.
4. **Op veld-niveau** — `$ref: "LandenlijstLand"` op een `V3Veld`, analoog
   aan OAS 3.1 `$ref` naar het items-type.

Voor Imprint zijn **niveau 1 (declaratie)** en **niveau 4 (`$ref` op een
veld)** de relevante: een keuzeveld verwijst via `$ref`/`enum` naar een
lijst, en de editor toont een dropdown of zoek-combobox. In de platte `types`
krijgt zo'n item-type bovendien een `itemCount` mee, waarmee de UI dropdown
vs. zoekveld kiest.

## 5. Enums en datatypes

- **`enums[]`** — `{ goType, baseType, waarden[] }`. In de geneste `V3Model`
  staat op een veld alleen de **ref** (`enum: "Bereikbaarheidssoort"`); de
  waarden staan centraal in `enums[]`. (In de platte `types` zijn de waarden
  per veld al uitgeklapt.)
- **`datatypes[]`** — custom typen met:
  - `basistype` (`string`/`integer`/`number`), `format` (bv. `"nl-postcode"`,
    `"bsn"`);
  - `validatie` (`pattern`, `minLength`/`maxLength`, `voorbeelden`,
    checksum-`regels`);
  - **`weergave`** — de invoer-hints die het formulier aansturen: `widget`
    (`"textarea"`, `"checkbox"`, `"currency"`, `"datepicker"` …),
    `prefix`/`suffix` (bv. `€`, `%`), `multiline`, `decimalen`.

Voor Imprint: **richtext / media / slug** worden nieuwe datatypes met een
eigen `widget`. Zolang een Imprint-datatype op deze vorm mapt, kiest de
editor automatisch het juiste invoercomponent (endpoint
`GET /api/schema/model/datatypes`).

## 6. Het veld — het atoom (`V3Veld`)

```jsonc
{
  "naam": "titel",
  "goType": "string",
  "type": "string",              // OAS 3.1-type: string|integer|number|boolean
  "format": "date",              // OAS 3.1-format: date|date-time|email|…
  "verplicht": true,
  "enum": "PublicatieStatus",    // ref → enums[].goType
  "datatype": "RichTekst",       // ref → datatypes[].naam (validatie + widget)
  "$ref": "Landenlijst",         // ref → referentielijst-items
  "description": "…",
  "afgeleid": false,
  "afleidingsregelTaal": "cel",  // bij afgeleid veld
  "afleidingsregel": "…"
}
```

Een veld is dus OAS-3.1-achtig (`type`/`format`) met drie verrijkingen die
elkaar uitsluiten: **`enum`** (vaste keuze), **`datatype`** (validatie +
widget) of **`$ref`** (referentielijst). Dit is genoeg om zowel het formulier
te renderen als later een JSON-Schema/OAS af te leiden.

## 7. Mapping V3 ↔ Imprint-contentmodel

| Imprint (CMS) | V3-concept |
|---------------|------------|
| Site-sectie / content-groep | `domein` (label op entiteit) + `domeinen[]`-metadata |
| Content-type (pagina, artikel, product) | `entiteit` |
| Subtype / variant | `erft` + `isAbstract` (generalisatie) |
| Veldgroep / component / herhaalbaar blok | `gegevenselement` (met `momentvoorkomen: "meervoudig"` = herhaalbaar) |
| Verwijzing naar ander content-type | `relatie` (`doelEntiteit`, kardinaliteit) |
| Veld (tekst, getal, datum, bool) | `veld` (`type`/`format`) |
| Rich text / media / slug / e-mail | `veld` met `datatype` (eigen `widget`) |
| Keuzelijst (vast) | `veld` met `enum` |
| Keuzelijst (beheerd) | `veld` met `$ref` → `referentielijstInstanties[]` |
| Berekend/afgeleid veld | `afgeleideVelden[]` |

**Wat je overneemt:** `domeinen`, `entiteiten` (+ `gegevenselementen`,
`relaties`, `velden`, `afgeleideVelden`), `enums`, `datatypes`,
`referentielijstInstanties`.

**Wat je weglaat:** diagram-layout (`diagrammen`, `notities`, `constraints`,
`positie`, `layoutLocked`) en register-runtime (`runtime`, `tabelnaam`,
`idKolom`, PFK) — die zijn codegen-/DB-specifiek en niet nodig om formulieren
te ontwerpen.

## 8. Hoe de formuliereditor het consumeert

Twee koppelvlakken, beide al aanwezig in de bitemp-repo:

1. **Geneste projectboom** — lever een `V3Model` (of Imprint-subset ervan).
   De editor/picker groepeert op `domein` en nest entiteit → GE/relatie →
   veld. Dit is de "boom waar de editor doorheen loopt".
2. **`injectedTypes`** (platte afgeleide) — `useSchemaModel({ injectedTypes })`
   slaat de netwerk-fetch over (`web/vite/src/modelpicker/useSchemaModel.js`).
   Handig als je de picker los wilt voeden zonder endpoint.

Bij een pick/drag emit de picker een **FieldRef** — het stabiele contract
tussen model en formulier:

```jsonc
{
  "typenaam": "Artikel_Body",
  "veldnaam": "titel",
  "veldpad": "Artikel.body.titel",   // leesbaar / lineage
  "gepad": "Artikel.body",           // adres van de lijst (voor herhaalbare blokken)
  "entiteit": "Artikel",
  "type": "string", "format": "", "datatype": "RichTekst",
  "enum": [], "ref": "", "afgeleid": false,
  "momentvoorkomen": "enkelvoudig"
}
```

Drag-MIME: `application/x-canoniek-fieldref` (+ `text/plain` = `veldpad`).

## 9. Minimaal Imprint-contentmodel (concreet voorbeeld)

Een blog-site met sectie "redactie", content-type **Artikel** met een
herhaalbaar tekstblok, een keuzeveld en een relatie naar **Auteur**:

```jsonc
{
  "versie": "imprint-v1",
  "naam": "Imprint demo-site",
  "domeinen": [
    { "naam": "redactie", "beschrijving": "Redactionele content", "kleur": "#6366f1" }
  ],
  "datatypes": [
    { "naam": "RichTekst", "basistype": "string",
      "weergave": { "widget": "richtext", "multiline": true } },
    { "naam": "Slug", "basistype": "string",
      "validatie": { "pattern": "^[a-z0-9-]+$" } }
  ],
  "enums": [
    { "goType": "PublicatieStatus", "baseType": "string",
      "waarden": [ { "constNaam": "Concept", "waarde": "concept" },
                   { "constNaam": "Gepubliceerd", "waarde": "gepubliceerd" } ] }
  ],
  "referentielijstInstanties": [
    { "systeemnaam": "Rubrieken", "naam": "Rubrieken", "omschrijving": "Site-rubrieken" }
  ],
  "entiteiten": [
    {
      "typenaam": "Artikel", "meervoud": "artikelen", "domein": "redactie",
      "gegevenselementen": [
        {
          "naam": "Kop", "meervoud": "koppen", "momentvoorkomen": "enkelvoudig",
          "velden": [
            { "naam": "titel", "goType": "string", "type": "string", "verplicht": true },
            { "naam": "slug", "goType": "string", "type": "string", "datatype": "Slug" },
            { "naam": "status", "goType": "PublicatieStatus", "type": "string",
              "enum": "PublicatieStatus" },
            { "naam": "rubriek", "goType": "string", "type": "string", "$ref": "Rubrieken" }
          ]
        },
        {
          "naam": "Body", "meervoud": "blokken", "momentvoorkomen": "meervoudig",
          "velden": [
            { "naam": "tekst", "goType": "string", "type": "string", "datatype": "RichTekst" }
          ]
        }
      ],
      "relaties": [
        { "naam": "Rel_Artikel_Auteur", "meervoud": "auteurs",
          "doelEntiteit": "Auteur", "momentvoorkomen": "enkelvoudig",
          "doelKardinaliteit": "1", "velden": [] }
      ]
    },
    {
      "typenaam": "Auteur", "meervoud": "auteurs", "domein": "redactie",
      "gegevenselementen": [
        { "naam": "Profiel", "meervoud": "profielen", "momentvoorkomen": "enkelvoudig",
          "velden": [
            { "naam": "naam", "goType": "string", "type": "string", "verplicht": true },
            { "naam": "email", "goType": "string", "type": "string", "format": "email" }
          ] }
      ]
    }
  ]
}
```

Dit levert een projectboom: **redactie → Artikel → {Kop, Body, → Auteur} →
velden**, waar "Body" een herhaalbaar blok is (`meervoudig`). De
formuliereditor pikt hier de data-elementen uit; het keuze- en
referentieveld renderen als dropdown resp. zoek-combobox; `RichTekst` als
richtext-widget.

## 10. Open punten / vervolg

- **Bron van waarheid in Imprint.** Bouwt Imprint dit V3-model met de
  UML-editor (zoals het register), of leidt het CMS het af uit zijn eigen
  contentmodel-definitie? Voor de eerste stap volstaat een statische
  `V3Model`/`injectedTypes`.
  → **Beantwoord (Imprint-kant)**: afgeleid, live, uit de zod-schema's —
  `GET /api/meta?format=v3` (`v3-export.ts`).
- **Nieuwe widgets/datatypes.** `richtext`, `media`, `slug`, `seo` toevoegen
  aan de datatype-/widget-registry (weergave-hints), zodat de editor ze
  herkent. → Imprint levert nu `Markdown` (richtext), `AssetUrl` (media),
  `Slug`, `Versienummer`, `Kleur` (color), `Json` (textarea).
- **Endpoint-vorm.** Kiest Imprint voor een eigen
  `/api/schema/model/code`-compatibel endpoint (min koppeling), of voeden we
  de picker met `injectedTypes`? → Voorstel: de picker haalt
  `/api/meta?format=v3` op; hetzelfde document kan ook statisch als
  `injectedTypes`-voer dienen.
- **Bitemporeel later.** Zodra Imprint op een bitemporele DB + API draait,
  kan het hetzelfde `runtime`-blok (V3.1) vullen en dezelfde codegen
  gebruiken; tot die tijd is het `runtime`-blok simpelweg afwezig.

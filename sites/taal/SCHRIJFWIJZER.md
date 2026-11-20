# Schrijfwijzer voor lessen

Voor wie een les schrijft of nakijkt. Het lesplan staat in
`docs/design/taaltraining/README.md`; de vorm van een les in
`packages/plugin-taal/src/schemas.ts`. Voorbeeld: `lessen/nl/fase-1/06-ik-ben.md`. Controleren: `npm run check:lessen --workspace=taal`.

## De leerling

Een volwassen Poolstalige beginner in Nederland. De site staat in het Pools.
De leerling leest nog geen Nederlands, dus alles wat uitleg of opdracht is,
staat in het Pools. Alleen wat geleerd wordt, staat in het Nederlands.

## Een tweede lezer: Engels

Elke les en elk grammatica-onderwerp is er ook voor de Engelstalige lezer
(`/en/nederlands/…`). Het Nederlands is hetzelfde; alleen wat uitleg of
opdracht is, staat er ook in het Engels:

- `dialoog`: bij elke regel `en` naast `pl`; `situatie` en `patroon`: `en`
  naast `pl` en `nl`.
- Oefeningen: `vertaald: { en: { vraag: "…" } }` bij `typ`, `zeg` en een
  `kies` met een Poolse vraag; `vertaald: { en: { opties: […] } }` bij
  `luister`. Een `kies` met een Nederlandse vraag en een `orden` hebben niets
  nodig.
- Engels heeft één *you*. Waar de antwoorden alleen `u` of alleen `je/jij`
  goed rekenen en de zin het niet laat zien, staat `(polite)` of `(informal)`
  achter de vraag.
- Geen vormen `{a|b}` in het Engels.
- Vergelijk in `patroon` en in `anders` met het Engels, niet met het Pools.

## Methode

- Eerst bruikbaar, dan correct. Elke zin is iets wat je echt zegt of hoort.
  Geen groene olifanten.
- Patroon vóór regel, en hoogstens één nieuwe regel per les. Die regel staat
  in `patroon` ("Zag je dat?"), in hoogstens drie zinnen, met voorbeelden uit
  de dialoog van deze les.
- Spiraal: gebruik woorden en brokken uit eerdere lessen opnieuw, en sluit de
  oefeningen af met één herhaling uit een eerdere les ("(powtórka)" achter de
  vraag).
- Nieuwe woorden per les: hoogstens een stuk of acht.

## Bestand

`lessen/nl/fase-<n>/<nr>-<slug>.md`, met `<nr>` het lesnummer in twee cijfers. De
`id` is `nl-<fase>-<nr>`. De slug is uniek binnen het pakket.

## Velden

| veld | regel |
|---|---|
| `taal`, `steuntaal`, `module` | `nl`, `pl`, `dagelijks` |
| `titel` | Nederlands, kort; tussen haakjes mag de plek of het onderwerp |
| `situatie` | één zin, `pl` en `nl` |
| `dialoog` | 5 tot 8 regels, elk met `nl` en `pl`; natuurlijke spreektaal, korte zinnen |
| `patroon` | hoogstens drie zinnen, `pl` en `nl`, Markdown; Nederlandse voorbeelden vet of cursief |
| `brokken` | 6 tot 10 stukjes uit de dialoog, kleine letters, `…` waar iets in te vullen is |
| `oefeningen` | 6 tot 8, zie hieronder |
| body | `**Ombouwen:**` en één opdracht van hoogstens twee zinnen, in eenvoudig Nederlands |

## Oefeningen

Elke les heeft minstens één `luister`, één `kies`, één `typ`, één `orden` en
één `zeg`.

- `luister`: `tekst` is een Nederlandse zin (uit de dialoog of ermee
  gebouwd); `opties` zijn drie Poolse zinnen, of drie getallen of tijden.
- `kies`: de `vraag` staat in het Pools, of is een Nederlandse zin met `…`
  om in te vullen. De `opties` zijn Nederlands. Precies één optie is goed.
- `typ`: `vraag` is een Poolse zin, `antwoorden` alle goede Nederlandse
  vertalingen (ook met "je/jij", "we/wij", en zonder aanhef).
- `orden`: `zin` is een Nederlandse zin van 3 tot 7 woorden, met maar één
  goede volgorde.
- `zeg`: `vraag` is een Poolse zin, `antwoorden` de Nederlandse zin en zijn
  varianten. Een vaste, korte zin: geen eigen naam of vrije invulling, want
  de herkenning vergelijkt met de antwoorden. `voorbeeld: true` bij een nieuwe
  klank of een lange zin.
- `antwoord` telt vanaf 0. Wissel de plek van het goede antwoord af.

## Grammatica

Een onderwerp van het naslagwerk staat in `grammatica/nl/<slug>.md`; de
slug is de bestandsnaam en het id wordt `nl-<slug>`. Alles staat in de
frontmatter, de teksten als YAML-blok (`tekst:` → `pl: |`, `nl: |`); de body
blijft leeg.

- Kort: één tabel als dat kan, de regel, de uitzonderingen, twee of drie
  voorbeelden. Liefst voorbeelden die de leerling uit de lessen kent.
- `titel`, `kort` (één zin voor het overzicht) en `tekst` in `pl` en `nl`.
  `anders` (hoe het Pools het doet) alleen in `pl`, en alleen bij een
  `regel`: een `verschil` is zelf al helemaal verschil.
- **Vet is Nederlands om te horen**: elk vet stuk krijgt een knop die het
  uitspreekt. Een Pools woord of een Nederlands woord dat je alleen noemt
  (`*werken*`, een uitgang als `*-en*`) zet je cursief. Vette stukjes als
  `-en` of `ge-…-t` krijgen geen knop.
- Een les die het onderwerp gebruikt, wijst ernaar: `grammatica:
  [nl-tegenwoordige-tijd]`, op de regel na `brokken`.

## Eten

Geen vlees en geen vis in de lessen: geen ham, kip, worst of haring, en geen
bezoek aan de slager of de visboer. Wie iets bestelt, neemt kaas, soep,
groente, brood of een ei. Vlees mag alleen voorkomen in een vraag als "Is de
soep vegetarisch?".

## Mannelijk en vrouwelijk in het Pools

Pools heeft in de verleden tijd, bij *chciałbym* en bij bijvoeglijke naamwoorden
een andere vorm voor een man dan voor een vrouw. Waar de zin over de leerling
zelf gaat, schrijf je beide: `Pracował{em|am} cały dzień.` Voor de accolade
staat wat gelijk is, erin eerst de mannelijke en dan de vrouwelijke vorm. De
site toont de vorm die de leerling kiest, en anders "Pracowałem/am".

- Wel: de `situatie` ("Wrócił{eś|aś} z Polski"), en de `vraag` van `kies`,
  `typ` en `zeg` in de ik-vorm of gericht aan de leerling ("Był{em|am} w
  Polsce.", "jestem chor{y|a}", "Chciał{bym|abym}", "sam{|a}", "z {żoną|mężem}").
- Niet: de dialoog (Piotr en Anna zijn wie ze zijn), de opties van `luister`
  (een ander spreekt), en een vraag aan een ander ("Gdzie byłeś?").
- Nooit in het Nederlands: wat wordt voorgelezen of als antwoord telt, heeft
  geen accolades. `check:lessen` bewaakt dat, en ook de schrijfwijze `{a|b}`.

## Taal

- Nederlands: `u` tegen vreemden, in winkels en bij instanties; `jij/je`
  tegen buren, collega's en vrienden. Geen Vlaamse of ouderwetse vormen.
- Pools: natuurlijk en correct, met de juiste beleefdheidsvorm (`pan/pani`
  waar het Nederlands `u` heeft). Vertaal de betekenis, niet woord voor woord.
- YAML: elke tekst tussen dubbele aanhalingstekens; een aanhalingsteken in de
  tekst wordt `\"`, of gebruik „…” en ‘…’.

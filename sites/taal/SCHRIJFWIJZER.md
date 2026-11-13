# Schrijfwijzer voor lessen

Voor wie een les schrijft of nakijkt. Het lesplan staat in
`docs/design/taaltraining/README.md`; de vorm van een les in
`packages/plugin-taal/src/schemas.ts`. Voorbeeld: `lessen/nl/fase-1/06-ik-ben.md`. Controleren: `npm run check:lessen --workspace=taal`.

## De leerling

Een volwassen Poolstalige beginner in Nederland. De site staat in het Pools.
De leerling leest nog geen Nederlands, dus alles wat uitleg of opdracht is,
staat in het Pools. Alleen wat geleerd wordt, staat in het Nederlands.

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

## Taal

- Nederlands: `u` tegen vreemden, in winkels en bij instanties; `jij/je`
  tegen buren, collega's en vrienden. Geen Vlaamse of ouderwetse vormen.
- Pools: natuurlijk en correct, met de juiste beleefdheidsvorm (`pan/pani`
  waar het Nederlands `u` heeft). Vertaal de betekenis, niet woord voor woord.
- YAML: elke tekst tussen dubbele aanhalingstekens; een aanhalingsteken in de
  tekst wordt `\"`, of gebruik „…” en ‘…’.

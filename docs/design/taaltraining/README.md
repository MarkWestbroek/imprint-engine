# Taaltraining — ontwerp en prototype

Status: **gebouwd en live op taal.imprint-engine.nl (12-11-2026)**, nog zonder opnamen. De taaltraining is de
site `sites/taal` met `@imprint/plugin-taal`; hoe het in elkaar zit staat in
[architecture.md](../../architecture.md) §7, wat de redactie ermee doet in de
[handleiding](../../handleiding.md). Deze map bevat het lesplan en de
React-prototypes waar de bouw van uitging. De lessen (inmiddels 45, alle zes de fasen; schrijfwijzer in `sites/taal/SCHRIJFWIJZER.md`) staan in
`sites/taal/lessen/` (de map `docs` komt niet in de image, en het importscript
moet ze op de VPS kunnen lezen).

Het volledige plan staat ook als document in Claude:
[Taaltraining: natuurlijke opbouw](https://claude.ai/artifact/7Mjcfpgofp635nWEx1pMHv).

## Methode in het kort

Geen droog grammaticaboek en geen losse Duolingo-zinnen ("een groene olifant
loopt over de brug"). In plaats daarvan eerst bruikbare brokken. Grammatica komt
pas als je hem nodig hebt om iets te zeggen wat je al wilt zeggen.

- Eerst bruikbaar, dan correct: "Misschien dit?" met een schroefje in je hand
  is een geslaagde zin.
- Eerst het patroon, dan de regel, en maximaal één nieuwe regel per les.
- Nuance vroeg: misschien, zeker, veel, weinig, meer, minder en te horen in fase 0.
- De grammaticaruggengraat ligt vast. De woordenschat komt uit een
  contextmodule (bouw, vakantie, dagelijks, administratie).
- Spiraal: elke regel komt later vollediger terug.

| Fase | Doel | Grammatica die binnenkomt |
| --- | --- | --- |
| 0 Houtje-touwtje | krijgen wat je nodig hebt | geen, alleen vaste brokken |
| 1 Kernwerkwoorden | zijn, hebben, willen, kunnen, gaan, komen | heden; "ik was/had"; "ik ga + ww" |
| 2 Waar en waarheen | voorzetsels, plaatsen | naamvallen per voorzetsel (PL/DE) |
| 3 Doen | actiewerkwoorden, je dag vertellen | (on)regelmatig, verleden, aspect (PL) |
| 4 Beschrijven | bijvoeglijke naamwoorden, kleuren, weer, tijd | congruentie, vergelijken |
| 5 Nuance | zou willen/kunnen, als… dan | voorwaardelijke wijs, bijzinnen |

## Lesformaat

Eén les is één Markdown-bestand met frontmatter (`sites/taal/lessen/nl/fase-0/`):

```yaml
id: nl-0-01
taal: nl            # doeltaal
steuntaal: pl       # taal van de vertaling
fase: 0
module: dagelijks
titel: Dit en dat (op de markt)
dialoog: [{ nl: "...", pl: "..." }]
brokken: ["wat is dit?", ...]
oefeningen:
  - { type: luister, tekst, opties, antwoord }   # hoor en kies
  - { type: kies, vraag, opties, antwoord }      # meerkeuze
  - { type: typ, vraag, antwoorden }             # vertaal en typ
  - { type: orden, zin }                         # woorden op volgorde
  - { type: zeg, vraag, antwoorden, voorbeeld? } # hardop zeggen
```

De body bevat de ombouw-opdracht als vrije tekst.

## Prototype (`prototype/`)

| Bestand | Wat |
| --- | --- |
| `tts-build.mjs` | Build-stap: maakt via Azure TTS per zin een MP3 (normaal en langzaam, SSML `prosody`) en een `manifest.json`. Gebruikt een hash als cache-sleutel. |
| `Speak.jsx` | Afspeelknop (normaal en langzaam). Valt terug op de browserstem (`speechSynthesis`). |
| `Oefeningen.jsx` | Oefenwidget voor de vijf typen. Bewaart de score per les in `localStorage`. `zeg` gebruikt de `SpeechRecognition` van de browser (Chrome en Safari, alleen via https) en rekent kleine afwijkingen goed. |

Nog niet getest: de echte Azure-aanroep, de stemnamen
(`nl-NL-FennaNeural`, `pl-PL-ZofiaNeural`) en de spraakherkenning op iOS.

**Let op:** de prototypes lezen bestanden en `/audio/manifest.json` direct. Dat
mag niet in Imprint: content gaat altijd via `ContentStore`, en widgets lezen
alleen via `WidgetContext`. Ze zijn bedoeld als referentie voor het gedrag,
niet om zo over te nemen.

## Naam en domeinen

Elke doeltaal krijgt een domein met dezelfde uitdrukking in die taal. De naam is
zo meteen de eerste zin die je leert.

| Doeltaal | Domein | Uitdrukking | Status |
| --- | --- | --- | --- |
| Nederlands | langzaammaarzeker.nl | langzaam maar zeker | vrij (11-11-2026), eerst |
| Pools | powolialedoprzodu.pl | powoli, ale do przodu | vrij (11-11-2026) |
| Italiaans | vapianovalontano.it | chi va piano, va sano e va lontano | vrij (11-11-2026), geen prioriteit |

- Tijdelijk draait het op **taal.imprint-engine.nl**.
- Het domein bepaalt de standaard doeltaal (en de UI-taal). De steuntaal kies je
  zelf en wordt onthouden. Het blijft één imprint, één container. Caddy krijgt
  per domein een hostnaam.
- Extra registraties: langzaam-maar-zeker.nl en powoli-ale-do-przodu.pl
  (met streepjes, beter leesbaar), als redirect.
- .it: registratie kan met woonplaats in de EU (identiteitsnummer verplicht).
  De DNS moet binnen 30 dagen werken, anders verwijdert de registry het domein.

## Het adres: taal van de site, dan het pakket

Besloten op 12-11-2026: het eerste deel van het adres is de taal van de site
(de interface, en daarmee de steuntaal), het tweede het lespakket (de taal die
je leert): `/pl/nederlands/dit-en-dat`. De eerste versie is een Poolse site
met het pakket Nederlands. Een domein kiest later alleen het standaardpakket.
Met `/nl/nederlands` leer je Nederlands in het Nederlands; dan vallen de
vertalingen weg en blijven de oefeningen over die geen steuntaal nodig hebben.

Dit is geen laag 4 uit [meertaligheid.md](../meertaligheid.md): een Poolse les
is een andere les, geen vertaling van een Nederlandse. `taal` en `steuntaal`
zijn gewone velden van de les.

## Mogelijke inbouw in Imprint (het oorspronkelijke voorstel)

- **Contenttype `les`** met een zod-schema in content-core of in een plugin. De
  velden komen overeen met de frontmatter hierboven, zodat de admin het
  formulier genereert.
- **`plugin-taal`** die contenttype, menu en schermen meebrengt (via de drie
  haken), plus widgets:
  - `lesdialoog`: tabel met afspeelknoppen per regel
  - `oefeningen`: client-viewer op basis van `Oefeningen.jsx`
- **Audio** als build-/admin-actie: na het opslaan van een les de ontbrekende
  zinnen genereren en in de beeldbibliotheek (of als asset) zetten. De
  verwijzing gaat via de store, niet via een los manifest.
- **Voortgang** voorlopig per browser. Later eventueel per gebruiker.
- Spreken met score per klank kan later via Azure Pronunciation Assessment.
  Daarvoor is een server-action nodig die een kortlopend token uitgeeft.

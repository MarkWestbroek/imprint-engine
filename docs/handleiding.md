# Imprint — handleiding voor redacteuren

Wat je als site-redacteur met Imprint kunt, zonder techniek. De technische
tegenhanger is [architecture.md](architecture.md); wat er per versie bij kwam
staat in de [CHANGELOG](../CHANGELOG.md).

## Inloggen & account

- **/admin** — log in met je gebruikersnaam en wachtwoord.
- Je wachtwoord wijzig je onder **Users** (iedereen ziet daar zijn eigen
  account; admins beheren alle accounts en rollen). Wachtwoord kwijt? Een
  admin reset het; je krijgt eenmalig een gegenereerd wachtwoord dat je
  daarna zelf vervangt.
- Rollen: **admin** (alles, incl. gebruikersbeheer), **editor** (content
  bewerken), **reader** (alleen kijken — geen schrijfrechten).

## Het belangrijkste principe: niets is ooit weg

Elke keer dat je opslaat ontstaat een **nieuwe versie**; de oude blijft
bestaan. Bij elk item vind je **History**: alle versies, met per versie wie en
wanneer, en een **Restore**-knop. Terugrollen is dus altijd veilig.

Onder **Validity** kun je publicatie plannen: "geldig vanaf" (verschijnt dan
pas op de site) en "geldig tot".

## Contenttypen

| type | wat het is |
|---|---|
| **Pages** | vrije pagina's — bewerk je in de studio (zie onder) |
| **Products** | producten met specs, status, foto's en componenten |
| **Components** | herbruikbare bouwblokken (één component kan in meerdere producten zitten); kunnen nesten |
| **Board specs** | machinaal gegenereerde borddocumentatie (komt binnen via de hardware-toolkit) |
| **Releases** | uitgaves van een product, met per component de meegeleverde versie |
| **Menus** | navigatiemenu's (het "main"-menu stuurt de header) |
| **Themes** | kleurenschema's van de site (zie Thema's) |

De formulieren volgen automatisch de contentregels; ongeldige invoer wordt bij
het opslaan geweigerd met een duidelijke melding. Verwijzingen tussen content
(bijv. een release die naar een component wijst) worden gecontroleerd — je
kunt niet naar iets verwijzen dat niet bestaat (instelbaar onder **Relations**).

## Pagina's maken in de studio

**Pages → Edit** (of **+ New page**) opent de studio: links de instellingen,
rechts het canvas — en het canvas ís de pagina, zoals hij er echt uit komt te
zien, inclusief header en footer.

- **Rijen en vakken**: "+"-balken tussen rijen voegen een rij toe; de smalle
  "+"-stroken links/rechts van een rij voegen een vak toe. Vakbreedte regel je
  met −/+ (verhoudingen: een vak van 2 naast een vak van 1 = ⅔ + ⅓).
- **Widgets**: "+ Add widget" in een vak opent de catalogus. Klik op een
  geplaatste widget en zijn instellingen verschijnen links — wijzigingen zie
  je direct in het canvas. Verplaatsen kan met de pijltjes in de sidebar
  (↑↓ binnen het vak, ◀▶ naar het buurvak).
- **Opslaan**: je werkt in een concept; pas **Save** zet het live (als nieuwe
  versie). **Undo changes** gooit het concept weg.
- **Default views**: onder **Default views** ontwerp je hoe een producten-,
  componenten- of releasepagina er standáárd uitziet — één keer ontwerpen,
  geldt voor elk item van dat type. Kies "Preview as …" om met een echt
  voorbeeld-item te ontwerpen.

## De widget-catalogus

Tekst & structuur: **Text** (opgemaakte tekst; Visueel- en Markdown-tab),
**Table**, **Accordion/FAQ**, **Callout/CTA** (gekleurd blok met knop),
**Hero** (grote kop met knop), **Divider**.

Beeld & media: **Image**, **Photo gallery** (raster + lightbox), **Photo
carousel**, **External album** (bijv. een Lightroom-share-link — plak de URL
en de foto's verschijnen), **Video** (YouTube/Vimeo of bestand), **Map**
(interactieve kaart met markers).

Data-gedreven (vullen zichzelf): **Products**, **Releases**, **Downloads**,
**Posts** (devlog-feed), **Component itinerary**, **Board spec**, **Board
annotations**, **List** (links die de contentstructuur volgen), **Template**
(tekst met invulvelden zoals `{{name}}` uit een content-item), **Treeview**,
**API content**, **Embed**, **Kanban board**.

Bij elke widget staat in de sidebar een korte uitleg (ⓘ) en zijn versienummer.

## Thema's

Onder **Themes** beheer je kleurenschema's (met kleurpickers en een live
voorbeeld). De site levert er drie: **Dark**, **Light** en **Neon**. Bezoekers
kunnen zelf wisselen via de keuzelijst in de header; hun keuze wordt
onthouden. Een nieuw thema toevoegen = een nieuw Theme-item aanmaken — het
verschijnt vanzelf in de keuzelijst.

## Voor gevorderden

- **Menu's**: onder Menus bewerk je de navigatie; een item wijst naar een
  pagina (kieslijst) of een URL en kan subitems hebben.
- **Relations**: welke verwijzingen tussen contenttypen worden afgedwongen.
- **Site**: naam, tagline en links van de site zelf.
- Machine-koppelingen (hardware-toolkit die borden publiceert, andere
  systemen die content lezen/schrijven): zie
  [mmb-ingest-guide.md](mmb-ingest-guide.md) en de API-sectie in de README.

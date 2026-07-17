# Imprint — handleiding voor redacteuren

Wat je als site-redacteur met Imprint kunt, zonder techniek. De technische
tegenhanger is [architecture.md](architecture.md); wat er per versie bij kwam
staat in de [CHANGELOG](../CHANGELOG.md).

De eerste imprint draait live: **https://musicbrain.nl**, beheer via
**https://musicbrain.nl/admin**.

## Inloggen & account

- **/admin** — log in met je gebruikersnaam en wachtwoord.
- Je wachtwoord wijzig je onder **Users** (of via je naam rechtsboven).
  Iedereen ziet daar zijn eigen account; admins beheren alle accounts.
- Rollen: **admin** (alles, incl. gebruikersbeheer), **editor** (content
  bewerken), **reader** (alleen kijken — geen schrijfrechten).

### Gebruikers beheren (admins)

Onder **Users** voeg je accounts toe, wijzig je rollen, reset je wachtwoorden
en verwijder je accounts. Een reset geeft een gegenereerd wachtwoord dat
**één keer** wordt getoond: kopieer het meteen en geef het door — de eigenaar
vervangt het daarna zelf. Nieuwe gebruiker toevoegen zonder wachtwoord te
bedenken? Laat het veld leeg, dan wordt er ook een gegenereerd.

Twee dingen die je niet kunt (met opzet): jezelf de admin-rol afnemen, en de
laatste admin degraderen of verwijderen. Anders zou niemand er nog bij kunnen.

Let op: uitloggen werkt niet op afstand. Wie al ingelogd was in een andere
browser blijft daar na een reset, rolwijziging of verwijdering nog tot **12
uur** binnen — zolang loopt een sessie door. Meestal geen punt. Moet iemand er
**nu** uit, dan is er één knop die dat afdwingt: het `SESSION_SECRET` op de
server vervangen en de app herstarten. Dat verloopt in één klap alle sessies
van iedereen (jij moet dus ook opnieuw inloggen) — zie
[README](../README.md#wachtwoord-kwijt).

### Wachtwoord kwijt

Er is bewust **geen "wachtwoord vergeten"-mail**: de site verstuurt geen mail,
en die route zou een publiek reset-endpoint toevoegen voor een handvol
gebruikers.

- **Ben je editor of reader?** Vraag een admin om een reset.
- **Ben je de (enige) admin?** Dan kom je er niet in via het scherm — dat
  vereist nu juist dat je ingelogd bent. De weg terug loopt over de server:
  `npm run user -- passwd <naam>` print een nieuw wachtwoord. Het hoe (ook op
  Plesk, via SSH) staat onder **"Wachtwoord kwijt"** in de
  [README](../README.md#wachtwoord-kwijt). Daarna inloggen en bij **Users →
  Change my password** zelf iets kiezen.

Praktischer nog: bewaar het in een wachtwoordmanager, dan hoeft dit nooit.

## Het belangrijkste principe: niets is ooit weg

Elke keer dat je opslaat ontstaat een **nieuwe versie**; de oude blijft
bestaan. Bij elk item vind je **History**: alle versies, met per versie wie en
wanneer, en een **Restore**-knop. Terugrollen is dus altijd veilig.

Onder **Validity** kun je publicatie plannen: "geldig vanaf" (verschijnt dan
pas op de site) en "geldig tot".

### Tijdreizen: de site zien zoals hij wás (of wordt)

Op het admin-dashboard staat **Time travel**: kies een moment en een
startpagina en klik **Preview**. Je bladert dan door de publieke site zoals
hij er op dat moment uitzag — oude productteksten, verdwenen releases,
ge-restorede content, alles zoals toen. Kies je een moment in de toekomst,
dan zie je geplande content (Validity) alvast staan.

Een balk bovenaan de site markeert de preview; alleen jouw browser ziet hem.
Klaar? **Exit preview** in de balk zet je terug in het nu. Gewone bezoekers
merken hier niets van.

## Contenttypen

| type | wat het is |
|---|---|
| **Pages** | vrije pagina's — bewerk je in de studio (zie onder) |
| **Products** | producten met specs, status, foto's en componenten |
| **Components** | herbruikbare bouwblokken (één component kan in meerdere producten zitten); kunnen nesten. Het veld **kind** (board, software, …) bepaalt de versiekop op de site |
| **Board specs** | machinaal gegenereerde borddocumentatie (komt binnen via de hardware-toolkit). Met een 3D-model erbij krijgt het bord een **3D**-knop: vrij draaien en zoomen; het model laadt pas als een bezoeker erop klikt |
| **Releases** | uitgaves van een product, met per component de meegeleverde versie |
| **Menus** | navigatiemenu's (het "main"-menu stuurt de header) |
| **Themes** | kleurenschema's van de site (zie Thema's) |

Goed om te weten over de weergave op de site: de **componentpagina** toont de
versie die door de nieuwste release wordt gepind (stable weegt zwaarder dan
beta/dev) als hoofdweergave, met de overige versies ingeklapt onder "Other
versions"; zonder release-pin staan alle versies gewoon onder elkaar. Alle
borden samen staan op **/boards**.

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

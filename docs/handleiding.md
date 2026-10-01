# Imprint — handleiding voor redacteuren

> **Let op:** deze handleiding leeft nu ook als de **Help-wiki** op de site
> (`/help`, bewerkbaar in de admin onder Content → Wikis). De wiki is de
> levende versie; dit bestand blijft voorlopig als reservekopie staan.

Imprint is de publicatiemotor achter MusicBrain en toekomstige merk- en
productsites. Als redacteur beheer je er de inhoud, structuur en vormgeving
van een site mee zonder in de code te werken. Je bouwt pagina's met widgets,
beheert productinformatie en wiki's, plant publicaties en kunt altijd naar een
eerdere versie terug.

Deze handleiding legt uit wat je in de beheeromgeving kunt doen. Zoek je de
techniek achter Imprint, lees dan de [architectuur](architecture.md). Een kaart
van alle documenten staat in het [documentatieoverzicht](README.md).

De eerste imprint draait live: **https://musicbrain.nl**, beheer via
**https://musicbrain.nl/admin**.

Imprint heeft daarnaast een eigen productsite en eigen contentdatabase. De
siteconfig komt al uit de ContentStore, maar de pagina-inhoud staat voorlopig
nog in code en er is nog geen beheeromgeving; redactioneel werken zoals
hieronder beschreven gebeurt daarom alleen in de MusicBrain-instantie.

## Beginnen

Voor dagelijks redactiewerk is dit de kortste route:

1. Log in op `/admin`.
2. Open **Content** om bestaande inhoud te bewerken of nieuwe inhoud te maken.
3. Open bij een pagina **Edit** om die in de visuele studio samen te stellen.
4. Gebruik **History** als je een eerdere versie wilt bekijken of herstellen.

De rest van deze handleiding begint bij accounts en de indeling van de admin,
en behandelt daarna pagina's, contenttypen, planning, wiki's en vormgeving.

## Inloggen & account

De admin is dezelfde voor elke Imprint-site: wat hieronder staat geldt voor
MusicBrain én voor de Imprint-site (imprint-engine.nl). Verschillen per site
zitten in de menu-inhoud (welke contenttypen actief zijn) en in de schermen
die een site zelf toevoegt (MusicBrain: planning en wiki) en in de widgets
die de studio aanbiedt (elke site kiest zijn eigen set).

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

### API-tokens (voor programma's buiten de admin)

Een programma zoals de patch-editor van MusicBrain zet bestanden in de
beeldbibliotheek met een **API-token**. Je maakt er een onder je account
(het poppetje onderin de balk → *API tokens*):

- geef hem een naam (bv. *patch editor*), vink aan wat hij mag (**upload
  media**, **list media**) en kies hoe lang hij geldig is;
- de token verschijnt **één keer** — kopieer hem meteen en plak hem in het
  programma; daarna zie je alleen nog het begin ervan;
- een token werkt als jij (met je huidige rol), maar alleen voor wat je
  aanvinkte. Behandel hem als een wachtwoord;
- **Revoke** zet hem direct buiten werking; *Last used* laat zien of en
  wanneer hij gebruikt wordt.

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

## De admin in het kort

Links staat een **activiteitenbalk** (zoals in VS Code): vijf werkgebieden,
elk met een eigen icoon. Klik een icoon en het paneel ernaast toont de items:

- **Overzicht** — het dashboard (tellingen, Extensions: de actieve plugins, Time travel).
- **Content** — je dagelijkse werk: Pages, Media (de beeldbibliotheek), de
  catalogus (Products, Components, Board specs, Releases) en Planning.
- **Vormgeving** — Menus, Themes, Default views.
- **Model & config** — Content model (read-only), Relations, Site.
- **Beheer** — Users (alleen voor admins).

Onderin de balk: de site bekijken, je account (naam · rol → wachtwoord) en
afmelden. Het paneel met items klapt in met « (of een klik op het actieve
icoon in de balk) en komt terug met een klik op dat icoon — handig in de
studio, die dan de volle breedte krijgt. De browser onthoudt je keuze.

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
ge-restorede content, alles zoals toen. Ook het menu, de thema's, de
sitenaam en de standaardweergaven (Default views) zijn die van dat moment.
Kies je een moment in de toekomst,
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
| **Planning** | kanban-borden: kaarten die je tussen fasen sleept (zie onder) |
| **Menus** | navigatiemenu's (het "main"-menu stuurt de header) |
| **Themes** | kleurenschema's van de site (zie Thema's) |
| **Wikis** | op zichzelf staande informatiebundels (Wiki → Folders → Wiki pages); een pagina verplaatsen = het folder-veld wijzigen (links breken daardoor niet). De wiki leeft op de site onder zijn eigen slug (`/help/…`) met een navigatieboom links; met **Toegang: beperkt** is hij alleen voor ingelogde gebruikers (zie Publiek en beperkt) |

Goed om te weten over de weergave op de site: de **componentpagina** toont de
versie die door de nieuwste release wordt gepind (stable weegt zwaarder dan
beta/dev) als hoofdweergave, met de overige versies ingeklapt onder "Other
versions"; zonder release-pin staan alle versies gewoon onder elkaar. Alle
borden samen staan op **/boards**.

De formulieren volgen automatisch de contentregels; ongeldige invoer wordt bij
het opslaan geweigerd met een duidelijke melding. Verwijzingen tussen content
(bijv. een release die naar een component wijst) worden gecontroleerd — je
kunt niet naar iets verwijzen dat niet bestaat (instelbaar onder **Relations**).

## Publiek en beperkt

Elk inhoudsitem (pagina, product, component, release, planningkaart, wiki,
wikipagina) heeft een veld **access**: `public` of `restricted`. Publiek is
de standaard en verandert niets. Beperkt betekent: bezoekers zien het item
nergens — niet op de site, niet in lijsten, niet in de API — en wie ingelogd
is (ook met de rol reader) ziet het wel.

- Een beperkte **pagina** staat op de site onder `/members/<slug>`; de
  gewone URL stuurt daarheen door. Zet je hem weer op publiek, dan staat hij
  terug op zijn eigen URL.
- Beperkte **producten, componenten en releases** verdwijnen voorlopig uit
  de publieke site; een ledenweergave daarvan komt later.
- Inloggen als lezer gaat nu nog via `/admin`: je komt daar niet verder
  (readers mogen niet bewerken), maar je bent wel ingelogd en kunt daarna
  `/members/…` bekijken. Een nette inlogpagina voor leden staat op de lijst.

## Vaste pagina's vs. content-pagina's

Niet elke pagina op de site is in de admin te bewerken — en dat is bewust.
Er zijn twee soorten:

### Content-pagina's (bewerk je in de studio)

Alles onder **Pages**: `/editor`, `/about`, `/planning`, de devlog-posts, en
elke pagina die je zelf aanmaakt. Deze zijn gecomponeerd uit widgets en/of
markdown en verschijnen in de pagina-lijst van de admin.

### Vaste pagina's (weergaven, in code)

De home (`/`), **`/releases`**, `/products/…`, `/components/…` en `/boards`
zijn hand-gebouwde weergaven ("views") in de code van de site. Ze tonen
content úit de database — de releases, producten en componenten die je in de
admin beheert — maar hun **opmaak en indeling** liggen in code vast. Je ziet
ze dus niet in de pagina-lijst.

Vuistregel: **de inhoud is van jou** (releases komen bijv. automatisch
binnen via GitHub en zijn in de admin te bewerken), **de weergave is van de
site**. Wil je de indeling van zo'n vaste pagina anders, dan is dat een
code-wijziging — geen redactie. Voor product-, component- en releasepagina's
bestaat wel een tussenweg: onder **Default views** kun je per contenttype de
standaardweergave vervangen door een zelf gecomponeerde paginasjabloon.

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
- **Ruimte**: met « bovenin het instellingenpaneel klap je het in, zodat het
  canvas de volle breedte krijgt en de pagina eruitziet zoals op de site;
  » (of een klik op een widget) haalt het terug. **View page ↗** in de
  bovenbalk opent de opgeslagen pagina op de site in een nieuw tabblad.
- **Opslaan**: je werkt in een concept; pas **Save** zet het live (als nieuwe
  versie). **Undo changes** gooit het concept weg.
- **Default views**: onder **Default views** ontwerp je hoe een producten-,
  componenten- of releasepagina er standáárd uitziet — één keer ontwerpen,
  geldt voor elk item van dat type. Kies "Preview as …" om met een echt
  voorbeeld-item te ontwerpen.

## Planning-borden

Onder **Planning** maak je kanban-borden. Een bord hoort bij een product en
heeft **fasen** (de kolommen). De kaarten zijn eigen content, dus ze hebben
een **eigenaar** (een gebruiker), een **rich-text-omschrijving** en een
optionele link naar een **component** waaraan gewerkt wordt.

- **Nieuwe kaart**: "＋ card" onderaan een kolom.
- **Verschuiven**: sleep een kaart naar een andere kolom (= andere fase).
- **Bewerken**: klik een kaart → paneel rechts (titel, fase, eigenaar,
  component + versie, omschrijving). In de omschrijving link je naar andere
  content met gewone markdown, bijv. `[ADC8](/components/adc8)`.

Belangrijk: **elke verplaatsing en wijziging is een nieuwe versie**. Een bord
bewaart dus de volledige geschiedenis van hoe elk kaartje door de fasen liep —
en met **Time travel** (op het dashboard) zie je het bord zoals het op een
gekozen datum was. Verwijderde kaarten zijn via History terug te halen.

Op een pagina toon je een bord met de **Planning board**-widget. Die kan ook
een ánder contenttype als bord tonen (bijv. componenten gegroepeerd op een
fase-veld) — dan is het een read-only weergave.

## Tekst opmaken

Overal waar je opgemaakte tekst schrijft (de Text-widget, de paginatekst,
callouts, tabs, wiki-pagina's, planningkaarten) staat dezelfde editor met twee
tabs: **Visueel** (je ziet de opmaak meteen) en **Markdown** (de brontekst,
voor wat de knoppen niet kunnen). De knoppen: vet, cursief, kop (H2/H3),
gewone alinea, code, opsomming, genummerde lijst, citaat, link (leeg laten
haalt de link weg), **afbeelding uit de bibliotheek** (🖼, met de alt-tekst
uit de bibliotheek alvast ingevuld), scheidingslijn, ongedaan maken en
opnieuw. Ook de gewone sneltoetsen werken (Ctrl+B, Ctrl+I, Ctrl+Z, …) en
markdown-achtig typen (`## ` aan het begin van een regel wordt een kop, `- `
een lijst).

Een afbeelding uit de bibliotheek wordt als verwijzing opgeslagen: vervang of
verbeter je hem in de bibliotheek, dan klopt het in de tekst meteen mee.

## De widget-catalogus

Tekst & structuur: **Text** (opgemaakte tekst; Visueel- en Markdown-tab),
**Table**, **Accordion/FAQ**, **Callout/CTA** (gekleurd blok met knop),
**Hero** (grote kop met knop; zet één woord tussen `*sterretjes*` voor de
accentkleur, en kies variant "open" voor een kop zónder paneel eromheen),
**Divider** (lijn, stipjes, ruimte — of "scope": een oscilloscoop-achtige
puls-lijn in de tweede accentkleur), **Specs strip** (rij kerncijfers in
monospace: grote waarde + klein bijschrift, zoals "≤ 5 ms · note-on → CV").

Beeld & media: **Image**, **Photo gallery** (raster + lightbox), **Photo
carousel**, **External album** (bijv. een Lightroom-share-link — plak de URL
en de foto's verschijnen), **Video** (YouTube/Vimeo of bestand), **Map**
(interactieve kaart met markers).

Data-gedreven (vullen zichzelf): **Products**, **Releases**, **Downloads**,
**Posts** (devlog-feed), **Component itinerary**, **Board spec**, **Board
annotations**, **List** (links die de contentstructuur volgen), **Template**
(tekst met invulvelden zoals `{{name}}` uit een content-item), **Treeview**,
**API content**, **Embed**, **Kanban board** (statische kaarten),
**Planning board** (levend bord uit Planning-content; zie boven), **Take**
(MusicBrain: een opname uit de patch-editor — kies de wav uit de bibliotheek;
de .mid van dezelfde opname verschijnt als pianorol waarmee je afspeelt,
springt en een lus zet; spatie speelt af als de rol focus heeft; eronder de
duur en downloadlinks).

Sinds 0.11: **Quote** (citaat met bron; "pull" maakt hem groot), **Code**
(syntax-highlighting, licht/donker volgt de site), **Mermaid diagram**
(diagram uit tekst — flowchart, sequence, class, gantt — getekend in de
browser), **V3 model diagram** (een V3-model als schema, getekend door
Omnium — zie hieronder), **Tabs**, **Cards / features** (raster van kaartjes met icoon,
kop, tekst, link), **Buttons**, **Logo cloud**, **Table of contents** (links
naar de koppen op de pagina, uit welke widget ze ook komen), **Breadcrumb**
(Home › sectie › pagina, uit de slug), **Audio**, **PDF**, **File download**,
**Timeline**, **Media & text** (beeld naast tekst), **People / team**,
**Testimonials** en **Pricing**.

**Hardware assembly** (MusicBrain): de hardware-unit die zichzelf in 3D in
elkaar zet. Je zet er *onderdelen* in — elk een board-spec (bv. `adc8@v2.0`;
het 3D-model achter de "3D"-tab van dat bord is wat je ziet) met een positie
in millimeters (x naar rechts, y diepte vanaf de paneelvoorkant naar achteren,
z omhoog), de richting van het bord (`normal`: `x` = kaart rechtop in een
slot, `y` = evenwijdig aan het paneel, `z` = plat), een draai om die as
(`spin`, graden — nodig als KiCad het bord liggend tekent) en `flip` om het
om te keren. Per onderdeel kies je waar het vandaan komt (`from`, een
verschuiving in mm) en wanneer het begint en hoe lang het duurt (`start`,
`duration`, als deel van de tijdlijn 0..1). Het **frontpaneel** komt uit een
SVG-tekening (de plaat heeft class `panel`; cirkels en rechthoeken met de
classes hole/pot/enc/btn/din/usb/mnt/disp worden gaten), de **rails** zijn
een vinkje. Met **accessoires** aan (standaard) bouwt de widget uit dezelfde
tekening wat geen bord levert: display (`disp`), MIDI-DIN-bussen (`din`),
USB-C (`usb`), drukknoppen (`btn`) en knoppen op encoder- en potgaten
(`enc`, `pot`); ze zitten aan het paneel en komen ermee mee. Verder: de duur
van één doorloop in seconden, **hold** (hoe lang de unit aan het eind
compleet blijft staan — alleen de camera draait — voor hij in anderhalve
seconde weer uit elkaar gaat en opnieuw begint; standaard 8 s), autoplay,
herhalen en optioneel een **muziekbestand** — dat start pas als de bezoeker
op Play drukt, nooit vanzelf. De bezoeker kan afspelen, pauzeren, door de tijdlijn
schuiven, slepen om rond te kijken en met *Reset view* terug naar het
beginstandpunt; het label linksboven zegt welk onderdeel beweegt.
Onderdelen zonder 3D-model worden onder de scène genoemd, zodat je ziet wat
er nog ontbreekt. Gaten met class `audio` krijgen een paneelbus (jack
zonder bord erachter). De eerste choreografie staat op `/cortex`:
busboard v3.1, zes kaarten, zes fronten en het **48 HP-paneel concept v3**
(besluit 1 okt 2026: het paneel is breder dan de print — console links,
de zes kolommen boven de echte busboard-slots, codec-audio rechts). De
alternatieve 40 HP-schets met staand display staat lokaal op
`/_sketch/40hp` (`public/boards/frontpanel-sketch-40hp-portrait.svg`).

**V3 model diagram.** Imprint tekent het model niet zelf: Omnium doet dat
(layout, kleuren, notatie horen bij het model). De sidebar gaat van boven
naar beneden:

1. **Welk model** — kies één van drie:
   - **Model in Omnium**: de *modelnaam* zoals in Omnium, liefst met een
     vaste *versie*. Zonder versie krijg je steeds de nieuwste; de knop
     "vastzetten op …" legt de huidige vast. Als het model in Omnium een
     nieuwe naam krijgt, vindt de pagina het niet meer. *Zoals op* toont het
     model zoals het op dat moment was. Omnium kent alleen gepubliceerde
     modellen (vanuit Studio of de IDE), niet wat alleen in je browser staat.
   - **Code plakken**: de V3-JSON.
   - **Van URL**: een adres waar de modelcode staat (bv.
     `https://musicbrain.nl/api/meta?format=v3`).
2. **Wat tonen** — een keuzelijst met de opgeslagen **diagrammen** van het
   model (eerste keus) en de **domeinen** (alle entiteiten van één domein).
   Een heel model in één plaat wordt een chaos; alleen een model met één
   domein en zonder diagrammen kan "Het hele model". Bij "Van URL" typ je
   diagram of domein zelf; kies je niets, dan toont de widget op het canvas
   welke er zijn.
3. **Kleuren** — *licht* (standaard, als een figuur, ook op een donker thema)
   of *kleuren van de site*; de elementen houden hun eigen kleur.
4. **Meer** (ingeklapt) — alleen bepaalde entiteiten, links→rechts in plaats
   van boven→onder, velden in de kaarten, datatypes en «use»-lijnen, en een
   maximale breedte.

Gaat er iets mis, dan staat Omniums melding in de widget, met het foute
element — de rest van de pagina werkt gewoon.

Heeft de site nog geen Omnium-koppeling, dan tekent Imprint geplakte of
opgehaalde modelcode tijdelijk zelf (eenvoudiger); een model in Omnium kan
dan niet.

Bij elke widget staat in de sidebar een korte uitleg (ⓘ) en zijn versienummer.

## De beeldbibliotheek (Media)

Onder **Content → Media** staan alle beelden, geluiden en documenten van de
site op één plek.

- **Uploaden**: klik **Upload** of sleep bestanden op het raster. Ze komen in
  de map die open staat (en krijgen de tags waarop je op dat moment filtert).
  Toegestaan: foto's (JPEG, PNG, WebP, GIF, AVIF, TIFF), SVG, PDF, **audio**
  (WAV) en **data** (MIDI, SysEx/.syx en JSON). Het type wordt aan de inhoud herkend, niet
  aan de bestandsnaam. Standaardlimieten: foto en PDF 50 MB, SVG 5 MB, audio
  200 MB, data 20 MB (per site in te stellen).
- **Groepen**: bestanden die bij elkaar horen (een opname: wav + mid + patch;
  of RAW + JPEG) upload je samen met het vinkje **as one group**. Ze staan dan
  als één kaart in het raster ("3 files"); in het detailpaneel zie je de
  bestanden van de groep. Verplaatsen naar een andere map verplaatst de hele
  groep; **Delete group** verwijdert ze samen.
- **Webversies**: van elke foto worden meteen kleinere versies gemaakt (400,
  800, 1600 en 2400 px breed, nooit groter dan het origineel). De site toont
  die; het **origineel blijft onaangeroerd** bewaard.
- **EXIF**: de keuzelijst naast Upload bepaalt wat de webversies van de
  EXIF-gegevens houden: *alles* (ook de locatie), *cameragegevens zonder
  locatie* (standaard) of *niets*. Het origineel houdt altijd alles. Je keuze
  wordt in je browser onthouden. Camera, lens, belichting, opnamedatum en
  fotograaf worden bij het uploaden uitgelezen en staan in het detailpaneel;
  de locatie alleen als je *alles* koos.
- **Mappen**: een beeld staat in precies één map, zoals een bestand op je
  computer. **＋ Folder** maakt een nieuwe; verplaatsen doe je met het veld
  *Folder* in het detailpaneel. Pagina's merken niets van verplaatsen.
- **Beschrijven**: titel, **alt-tekst** (wat er te zien is, voor wie het niet
  kan zien), bijschrift, credit, licentie en bron. Bij audio zie je duur,
  samplerate, bitdiepte en kanalen en kun je het meteen afspelen; bij MIDI het
  formaat, aantal sporen en de resolutie.
- **Taglijsten en tags**: links onder *Tags* staan de **taglijsten** (bv.
  *Onderwerp*, *Project*, *Gebruik*), elk met hun tags. **＋ Tag list** maakt
  een nieuwe lijst, **＋** naast een lijst voegt een tag toe. In het
  detailpaneel kies je per lijst een tag (*＋ Onderwerp…*), of typ je een
  **vrije tag** + Enter; vrije tags staan links onder *Other*. De inhoud van
  de lijsten is per site anders.
- **Taglijst bewerken**: klik ✎ naast de naam van een lijst. Klik dan op een
  tag om hem te **hernoemen** (typfout verbeteren): alle bestanden met die tag
  gaan mee, als nieuwe versie in History. Hernoem je hem naar een tag die al
  bestaat, dan worden de twee **samengevoegd**. Met × **verwijder** je een tag
  (hij gaat ook van de bestanden af; je ziet vooraf hoeveel). *rename* en
  *delete* bovenin doen hetzelfde voor de hele lijst. ✓ sluit de bewerkmodus.
- **Filteren**: klik tags aan (alle aangeklikte tags moeten kloppen), kies een
  soort (foto, audio, data…), camera of lens, of alleen beelden **met
  locatie**. Zoeken werkt op titel, alt-tekst, bestandsnaam, credit, lens en
  tags.
- **Toegang per formaat**: *public* of *restricted* voor het hele beeld, en
  **Public up to**: tot welke breedte een bezoeker het mag zien. Grotere
  versies zijn dan alleen voor redacteuren. Het **origineel is nooit
  openbaar**. Onder *Formats* zie je per versie wie hem mag zien.
- **Focuspunt**: klik in het detailpaneel op de foto, op het deel dat in beeld
  moet blijven (een gezicht, het onderwerp). Waar de site een beeld bijsnijdt —
  de achtergrond van een hero, de vierkante tegels van een galerij, de
  rondjes bij personen — blijft dat punt zichtbaar. *Clear* haalt het weg;
  **Save** bewaart het.
- **Snel laden**: de site geeft de browser alle publieke versies van een
  bibliotheekbeeld; die kiest zelf de kleinste die scherp genoeg is (een
  telefoon haalt geen foto van 2400 px op). Dat gaat vanzelf.
- **Verwijderen** kan met Delete; het beeld blijft in History en in oude
  versies van pagina's gewoon bestaan.

**Kiezen uit de bibliotheek.** Elk beeld- of bestandsveld (Image, Hero,
Media & text, Audio, PDF, File download, de foto's van Gallery en Carousel,
productfoto's, het OG-beeld van een pagina) heeft een kiezer: een voorbeeldje,
**Choose from library** (zoeken, per map, en **Upload new** zonder de editor
te verlaten) en **Clear**. Er wordt dan een verwijzing opgeslagen
(`asset:naam`), geen vaste link:

- de site toont altijd de **grootste publieke versie** (rekening houdend met
  *Public up to*);
- de **alt-tekst en het bijschrift** komen uit de bibliotheek — vul je ze in de
  widget zelf in, dan gaan die voor;
- verbeter je de alt-tekst of vervang je iets in de bibliotheek, dan klopt het
  overal meteen.

Een gewone URL (een extern beeld) plakken kan nog steeds in hetzelfde veld.
In het detailpaneel van de bibliotheek zie je onder **Used in** op welke
pagina's en items een bestand staat (met links naar de editor), en de
verwijzing om te kopiëren (`asset:naam`) voor velden zonder kiezer (bv. de
logo's of personen, die nog als JSON bewerkt worden). Verwijder je een bestand
dat ergens gebruikt wordt, dan waarschuwt de bibliotheek eerst.

Staan er in oude content nog links naar bibliotheekbestanden (uit *Formats*
gekopieerd), dan zet `npm run media:refs` ze om naar verwijzingen (eerst
zonder `-- --apply` om te zien wat er verandert).

## Wiki's bewerken

Wiki's en planning zijn plugins: een site die ze niet aanzet, heeft ze niet
in het menu en kent de contenttypen niet.

Onder **Content → Wikis** staat het wiki-overzicht; een nieuwe wiki maak je
op titel (de slug volgt vanzelf). Een wiki open je in de **wiki-studio**:
links de boom (folders en pagina's), rechts de eigenschappen en de tekst
van wat je selecteert — niets geselecteerd = de wiki zelf (titel,
beschrijving, toegang).

- **Verplaatsen**: sleep een pagina naar een andere folder, of een folder
  in een andere folder (of op de wiki-titel voor bovenin). Elke
  verplaatsing is een nieuwe versie — History vertelt het verhaal.
- **Nieuw**: "+ folder" en "+ pagina" maken iets in de geselecteerde
  folder; alleen een titel is nodig.
- **Toegang**: publiek is voor iedereen; beperkt alleen voor wie mag
  (nu: iedereen die ingelogd is). Een beperkte wiki staat op de site onder
  `/members/<wiki>`; de oude URL stuurt daarheen door. Ook één pagina in
  een publieke wiki kan beperkt zijn: hij staat dan niet in de boom voor
  bezoekers.
- **Verwijderen** kan per pagina of lege folder en is herstelbaar via
  History.

## Thema's

Onder **Themes** beheer je kleurenschema's (met kleurpickers en een live
voorbeeld). De site levert er vier: **Dark**, **Light**, **Neon** en
**Amber** (het "open brain"-ontwerp: blauwzwart met amber en een cyaan
tweede accent). Bezoekers kunnen zelf wisselen via de keuzelijst in de
header; hun keuze wordt onthouden. Een nieuw thema toevoegen = een nieuw
Theme-item aanmaken — het verschijnt vanzelf in de keuzelijst.

Naast de gewone accentkleur kent een thema een optionele **Accent 2** — een
tweede accent voor sierelementen zoals de scope-divider. Leeg gelaten valt
hij terug op de gewone accentkleur.

Een thema kan ook de **breedte** van de pagina zetten (*Layout → Width*, als
CSS, bijvoorbeeld `1100px` of `1440px`); leeg laat de breedte van de site
staan. Op de Common Ground-showcase zijn er vier: **Common Ground** (smal,
zoals het origineel), **Common Ground breed**, **Donker** en **Zonnig**; de
keuzelijst staat rechtsboven naast het zoeken.

## De Common Ground-showcase

De site `commonground` laat Common Ground op Imprint zien
([ontwerp](design/communities.md)). Voor een redacteur werkt hij als de
andere sites, met een paar dingen van commonground.nl:

- **Het potlood** rechtsonder (alleen als je bent ingelogd en mag bewerken)
  opent de pagina die je bekijkt in de studio.
- **Rechtsboven** staan zoeken, de bel voor mededelingen (die komen met de
  groepen; nu nog leeg) en je avatar met je initialen; die brengt je naar de
  admin. Niet ingelogd staat daar **Inloggen**.
- **Het menu** is het menu `main` onder Menus: een item met onderliggende
  items klapt uit.
- **De footer** is de pagina `_footer`: bewerk hem in de studio zoals elke
  pagina (twee kaarten naast elkaar = twee vakken in één rij).
- **De startpagina** is de pagina `home`.
- Blokken met **"komt uit Pleio"** zijn overzichten (nieuws, agenda,
  communities) waarvan de inhoud nog niet is overgenomen; de knop gaat naar
  commonground.nl.
- **De wiki** (onder `/wiki`) is de wiki van de groep "Common Ground
  publicatiesite"; bewerken gaat onder **Wikis** in de admin, zoals bij
  MusicBrain. De navigatieboom klapt in: alleen de eerste laag en de weg
  naar de pagina die je leest staan open, met **Alles uitklappen** erboven. Een Pleio-wikipagina met onderliggende pagina's is hier een
  map met die pagina als eerste pagina erin.
- **Communities** (groepen): onder **Groups** in de admin staat elke
  community met naam, samenvatting (de kaarttekst), introductie, tekst,
  beeld, tags, of ze besloten is of lid worden op aanvraag gaat, en haar
  wiki. Het overzicht staat op `/groups` (en als widget **Groups** op "Onze
  communities"); elke community heeft een eigen pagina op `/groups/<slug>`
  met daarop haar wiki en pagina's. **Lid worden** staat er al, maar doet
  nog niets: leden komen in de volgende stap.
- **Account en lid worden**: bezoekers maken zelf een account
  (**Registreren** rechtsboven, of `/account/register`): gebruikersnaam,
  e-mailadres en een wachtwoord van minstens 12 tekens. Ze krijgen een mail
  met een bevestigingslink (24 uur geldig); pas met een bevestigd adres
  kunnen ze lid worden. Inloggen kan met naam of e-mailadres; op
  `/account` staan je gegevens, je communities en de knop om de
  bevestigingsmail opnieuw te sturen. Wachtwoord kwijt? **Wachtwoord
  vergeten?** op de inlogpagina mailt een link (2 uur geldig) om een nieuw
  wachtwoord te kiezen. Op een community-pagina staat **Lid
  worden**: bij een open community ben je meteen lid, bij "op aanvraag"
  keurt een beheerder je goed. **Verlaten** kan altijd, behalve als eigenaar.
- **Een community beheren** (eigenaar, beheerders en de redactie van de
  site): **Beheer** op de community-pagina, of `/groups/<slug>/manage`:
  aanvragen goedkeuren of afwijzen, leden verwijderen, rollen (lid,
  beheerder, eigenaar) en **uitnodigingslinks**: wie zo'n link opent en
  inlogt, is meteen lid of beheerder zonder goedkeuring. Een link is 30
  dagen geldig, wordt één keer getoond en is in te trekken.
- **Blog**: onder **Posts** in de admin staat elk bericht met schrijver,
  datum, samenvatting, tekst, tags en (optioneel) de community waar het bij
  hoort. Alle berichten staan op `/blog`, elk bericht op `/blog/<slug>`, en
  een community-pagina toont haar eigen berichten. Een bericht is een
  **blog** of een **update** (het korte bericht in de tijdlijn van een
  community, zoals Pleio's statusupdate): updates staan alleen op de
  community-pagina, niet in `/blog`. De widget **Posts** zet de laatste
  berichten (van de site, een community of een tag; blogs, updates of beide)
  op een pagina.
- **Agenda**: onder **Events** in de admin staat elk evenement met begin en
  einde (datum en tijd), plaats, adres, links, organisatie, of het ook online
  is, een herhalingsregel als tekst, tags en (optioneel) de community. De
  agenda staat op `/events` (komend per maand, daaronder "Eerder"), elk
  evenement op `/events/<slug>`, en een community-pagina toont haar komende
  evenementen. De widget **Agenda** zet de eerstvolgende op een pagina.
  Staat bij een evenement **Aanmelding** aan (het vinkje *rsvp* in de
  admin, eventueel met een maximum), dan kiezen ingelogde leden met een
  bevestigd adres *ik kom / misschien / ik kom niet*; de pagina telt mee,
  zegt "vol" bij het maximum, en intrekken kan altijd. Bij de keuze staat
  waar ze mee instemmen: de organisatie ziet naam en e-mailadres voor dit
  evenement. Wie het evenement organiseert (de redactie, of de beheerders van
  de community van het evenement) ziet onder **Aanmeldingen bekijken** wie
  komt, met adres en een knop om iedereen te mailen. Eigen aanmeldingen
  staan onder **Mijn evenementen** op `/account`.
- **Wie mag wat zien**: elke pagina, wikipagina, term en groep heeft een
  veld **Toegang**: *public* (iedereen), *restricted* (alleen ingelogde
  leden van de site) of *group: …* (alleen de leden van die community; de
  redactie ziet alles). Iets breder zichtbaar maken is gewoon opslaan met
  een andere waarde: de historie laat zien wie dat wanneer deed. Niet-publieke
  pagina's staan voor leden onder `/members/…`; wie niet is ingelogd, komt
  eerst bij de inlogpagina.
- **Adressen**: de vaste routes heten Engels (`/groups`, `/terms/…`,
  `/search`); de Nederlandse namen (`/groep/…`, `/term/…`, `/zoeken`) zijn
  aliassen in de site-instellingen en sturen door.
- **Termen**: onder **Terms** in de admin staat elke term met een titel, een
  **samenvatting** (de tekst op de kaart; leeg = het begin van de tekst), de
  **tekst** en **tags** (bijvoorbeeld `afkorting`). Elke term heeft een eigen
  pagina op `/terms/<slug>`; verwijs ernaar met een gewone link. Het overzicht
  is de widget **Glossary** in een pagina (`termen`, en `afkortingen` met de
  tag `afkorting`): kaarten met een zoekveld dat filtert terwijl je typt.

## Voor gevorderden

- **Menu's**: onder Menus bewerk je de navigatie; een item wijst naar een
  pagina (kieslijst) of een URL en kan subitems hebben.
- **Relations**: welke verwijzingen tussen contenttypen worden afgedwongen.
  Je kunt kiezen uit alle contenttypen die op deze site actief zijn.
- **Site**: naam, tagline, motto (het regeltje onder het logo; leeg =
  tagline) en links van de site zelf. Op MusicBrain staan die links in de
  footer, elk met een eigen label: `github` → *source*, `docs` → *docs*,
  `releases` → *firmware*, `issues` → *issues*, `editor` → *editor*,
  `discord` → *discord*; een andere sleutel verschijnt onder haar eigen
  naam. Een link weghalen = de sleutel leegmaken.
- Machine-koppelingen (hardware-toolkit die borden publiceert, andere
  systemen die content lezen/schrijven): zie
  [mmb-ingest-guide.md](mmb-ingest-guide.md) en de API-sectie in de README.

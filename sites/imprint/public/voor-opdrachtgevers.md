# Een website laten bouwen met Imprint

*Voor wie een website wil laten maken op Imprint, en voor de AI-assistent
(Claude, ChatGPT, …) die daarbij helpt. Bijgewerkt: 8 november 2026.*

Dit document vertelt wat Imprint kan en wat niet, en eindigt met een sjabloon
voor de eisen. Vul dat sjabloon samen met je assistent in en stuur het naar je
contactpersoon bij Imprint. Wij bouwen de site; jullie beheren daarna zelf de
inhoud.

---

## Voor de assistent: zo help je

Je helpt iemand de eisen voor een website op te schrijven. Wij (de makers van
Imprint) bouwen de site daarna. Houd je aan deze regels:

1. **Vraag door tot het sjabloon onderaan vol is.** Stel een paar vragen
   tegelijk, niet twintig. Begin bij het doel en de bezoekers, pas daarna
   pagina's en functies.
2. **Beloof niets wat hier niet staat.** Staat een wens onder "Kan meteen",
   noem dan de widget of functie. Staat hij onder "Maatwerk", zeg dat het kan
   maar tijd kost. Staat hij nergens, schrijf hem dan op als **vraag aan de
   bouwers**. Verzin geen functies.
3. **Denk in pagina's opgebouwd uit blokken.** Een Imprint-pagina is een
   stapel rijen; een rij heeft vakken naast elkaar; in een vak staan widgets.
   Beschrijf elke pagina zo (zie het voorbeeld in het sjabloon).
4. **Scheid inhoud van vorm.** Teksten en beelden beheert de klant zelf na de
   oplevering. Vraag wel welke inhoud er al is en wie hem aanlevert.
5. **Nummer de eisen** (W1, W2, … voor de website; S1, S2, … voor beheer en
   techniek), zodat we er in vragen en in de code naar kunnen verwijzen.
6. **Lever het resultaat als één markdownblok** volgens het sjabloon, klaar om
   te kopiëren.
7. **Spreek de taal van je gebruiker** en schrijf het sjabloon in die taal.
   De namen van widgets (Hero, Cards, …) blijven Engels: zo heten ze in de
   studio. Vraag altijd in welke taal of talen de site moet zijn, en welke
   taal de redacteuren lezen (zie "Taal").

---

## Wat Imprint is

Imprint is een publicatiemotor: één codebasis waarop meerdere websites
draaien. Elke site heeft:

- **een beheeromgeving** (`/admin`) waarin redacteuren inloggen;
- **een visuele studio** waarin je een pagina bouwt in de pagina zelf, met de
  echte kop en voet van de site eromheen: rijen, vakken, widgets;
- **volledige geschiedenis**: elke keer opslaan is een nieuwe versie. Niets is
  ooit weg; elke versie is terug te zetten. Je kunt de hele site bekijken
  zoals hij op een eerdere datum was, of hoe hij er op een geplande datum uit
  komt te zien;
- **publiceren op tijd**: "geldig vanaf" en "geldig tot" per item;
- **snelle publieke pagina's**: ze worden vooraf gemaakt en na elke wijziging
  in de beheeromgeving vernieuwd.

Lopende voorbeelden: musicbrain.nl (een productsite voor een
muziekinstrument), imprint-engine.nl, en een showcase met communities, blog,
agenda en wiki.

---

## Kan meteen

### Widgets voor pagina's

Een redacteur kiest ze in de studio. Per site bepalen we welke er in de
catalogus staan.

**Tekst en structuur**
- **Text**: opgemaakte tekst (koppen, lijsten, links, beelden), met een
  visuele editor en een Markdown-tab.
- **Hero**: grote kop met tekst, knop en eventueel een achtergrondbeeld.
- **Callout / CTA**: gekleurd blok met een knop.
- **Quote**: citaat met bron.
- **Table**: tabel.
- **Accordion / FAQ**: vragen die openklappen.
- **Tabs**: inhoud in tabbladen.
- **Cards / features**: raster van kaartjes met icoon, kop, tekst en link.
- **Buttons**: een rij knoppen.
- **Specs strip**: rij kerncijfers.
- **Timeline**: tijdlijn.
- **Divider**: scheidingslijn of witruimte.
- **Table of contents**: inhoudsopgave van de koppen op de pagina.
- **Breadcrumb**: kruimelpad.
- **Code**: codevoorbeeld met kleuren.
- **Mermaid diagram**: diagram uit tekst (stroomschema, gantt, …).

**Beeld en media**
- **Image**: afbeelding.
- **Photo gallery**: fotoraster met vergroting.
- **Photo carousel**: diavoorstelling.
- **External album**: foto's uit een gedeeld album (bijvoorbeeld Lightroom).
- **Media & text**: beeld naast tekst.
- **Video**: YouTube, Vimeo of een eigen bestand.
- **Audio**: geluidsfragment.
- **PDF**: PDF in de pagina.
- **File download**: downloadknop.
- **Map**: interactieve kaart met markers.
- **Logo cloud**: rij logo's.

**Mensen en verkoop-achtig**
- **People / team**: personen met foto en rol.
- **Testimonials**: ervaringen van klanten.
- **Pricing**: prijsblokken (tonen, niet afrekenen; zie Maatwerk).

**Inhoud die zichzelf vult**
- **Posts / news feed**: de laatste berichten.
- **List (links)**: lijst die de structuur van de site volgt.
- **Template**: tekst met invulvelden uit een content-item.
- **Treeview**: boomweergave.
- **Kanban board**: kaarten in kolommen.
- **Embed (iframe)**: een andere webpagina of dienst insluiten.
- **API content**: gegevens van een externe bron tonen.
- **V3 model diagram**: een datamodel als schema (voor wie dat nodig heeft).

### Modules (aan te zetten per site)

- **Blog en nieuws**: berichten met schrijver, datum, tags en beeld;
  overzicht op `/blog` en `/news`, een pagina per bericht.
- **Agenda**: evenementen met begin, einde, plaats en online-link; overzicht
  per maand; aanmelden ("ik kom / misschien / niet", met maximum) voor
  ingelogde leden.
- **Wiki**: documentatie in mappen en pagina's, met navigatieboom; publiek of
  alleen voor leden.
- **Woordenlijst**: termen met eigen pagina en een doorzoekbaar overzicht.
- **Communities / groepen**: groepen met eigen pagina, leden (open of op
  aanvraag), uitnodigingslinks, berichten en evenementen per groep.
- **Reacties**: reageren onder berichten en pagina's, ook op een stuk tekst
  (kanttekening in de kantlijn), met moderatie.
- **Presentaties**: dia's in de site, met volledig scherm.
- **Planningborden**: kanbanborden met geschiedenis.

### Beheer en techniek

- **Gebruikers en rollen**: admin, redacteur, lezer. Bij de communitymodule
  kunnen bezoekers zelf een account maken (met e-mailbevestiging en
  "wachtwoord vergeten").
- **Publiek of besloten** per pagina, wiki of groep: voor iedereen, alleen
  voor ingelogde leden, of alleen voor de leden van één groep.
- **Beeldbibliotheek**: uploaden met slepen, mappen en tags, alt-tekst,
  automatisch kleinere versies voor snel laden, focuspunt voor bijsnijden,
  EXIF-privacy (locatie eruit), per beeld instellen tot welke grootte het
  openbaar is.
- **Menu's**, **thema's** (kleuren, met kleurkiezer en live voorbeeld; meer
  thema's om tussen te wisselen kan) en **site-instellingen** (naam,
  tagline, links).
- **Zoeken** over alle inhoud die je mag zien.
- **Statistieken zonder cookies**: bezoek, pagina's, verwijzers en
  zoekopdrachten (ook wat níet gevonden werd). Geen cookiebanner nodig.
- **E-mail** van de site: bevestigingen, wachtwoordherstel, een dagelijkse
  samenvatting van meldingen.
- **Hosting door ons**: eigen domeinnaam met HTTPS, database met dagelijkse
  backup (servers in de EU).
- **Eigen contenttypen** zijn mogelijk (bijvoorbeeld "Producten",
  "Projecten", "Recepten") met een formulier dat vanzelf uit de velden volgt.
  Dat is wel bouwwerk (zie Maatwerk).

---

## Taal

- **Een site in één taal, welke dan ook (ook Pools), kan.** Alle inhoud typt
  de redactie zelf: pagina's, menu's, berichten, de naam van de site.
- **Vaste teksten in de code** (knoppen als "vorige/volgende", datums,
  inlog- en zoekpagina's) staan nu in het Engels of Nederlands. Voor een
  andere taal vertalen wij die; dat is klein maatwerk.
- **De beheeromgeving is Engelstalig** (met hier en daar Nederlands).
  Redacteuren die geen Engels lezen, hebben het daar lastig. Een vertaalde
  beheeromgeving is groter maatwerk; vraag ernaar als het nodig is.
- **Meerdere talen naast elkaar** (taalkeuze, adressen per taal) is maatwerk.

---

## Maatwerk (kan, kost bouwtijd)

| Wens | Wat het vraagt | Grootte |
|---|---|---|
| Eigen huisstijl (lettertypen, kleuren, logo, kop en voet) | ontwerp vertalen naar de site | klein tot middel |
| Een eigen contenttype (bv. "Projecten" met eigen velden en overzicht) | schema + weergave + overzichtspagina | middel |
| Een nieuwe widget die er nog niet is | schema + weergave | klein tot middel |
| Een vaste pagina met een bijzondere opbouw (bv. een configurator) | code in de site | middel tot groot |
| **Webshop met betalen** (iDEAL, BLIK, Przelewy24, kaart via Mollie) | producten, winkelmand, Mollie-checkout, bestellingen, mails | groot; we hebben het eerder gebouwd met Mollie |
| Betaalde toegang tot inhoud (bv. video's of foto's kopen) | idem, plus toegang per klant | groot |
| Contactformulier of inschrijfformulier | formulier + mail of opslag | klein |
| Koppeling met een ander systeem (agenda, CRM, nieuwsbrief) | API-koppeling | per geval |
| Vaste teksten van de site in een andere taal (bv. Pools) | vertaling van knoppen, datums, inlog- en zoekpagina's | klein |
| Beheeromgeving in een andere taal dan Engels | vertaling van de hele admin | groot |
| Volledig meertalige site (taalkeuze, adressen per taal) | de opslag kent talen, de site nog geen taalwissel | middel |
| Inhoud overnemen van een oude site | script per bron | per geval |

## Kan niet, of raden we af

- **Losse HTML of scripts plakken in pagina's.** Alles loopt via widgets, zodat
  het veilig en consistent blijft. Iets insluiten kan met de Embed-widget.
- **Zelf plugins installeren** zoals bij WordPress. Nieuwe functies bouwen wij.
- **Een site zonder beheer door een mens**: er is altijd minstens één admin.
- **Inhoud echt wissen**: verwijderen kan, maar de geschiedenis bewaart het
  (bewust). Moet iets juridisch echt weg, overleg dan met ons.

---

## Sjabloon voor de eisen

Vul dit in en stuur het naar je contactpersoon bij Imprint.

```markdown
# Website: <naam>

## 1. Doel en bezoekers
- Wat moet de site bereiken?
- Wie zijn de bezoekers, en wat komen ze doen? (top 3 taken)
- Voorbeeldsites die je mooi of handig vindt, en waarom:

## 2. Domein en planning
- Domeinnaam (al in bezit?):
- Gewenste opleverdatum, en waarom die datum:
- Bestaande site die vervangen wordt (adres):
- Taal of talen van de site:
- Welke taal lezen de redacteuren (voor de beheeromgeving)?

## 3. Pagina's
Per pagina: adres, doel, en de opbouw in rijen → vakken → widgets.

### Voorbeeld: Home (`/`)
- Rij 1: Hero (kop, korte tekst, knop "Bekijk ons werk")
- Rij 2: drie vakken naast elkaar, elk een Cards-kaartje
- Rij 3: Posts (laatste 3 berichten)
- Rij 4: Callout met contactknop

### <pagina>
- ...

## 4. Inhoudstypen en modules
- Modules (blog, agenda, wiki, woordenlijst, communities, reacties, …):
- Eigen soorten inhoud met eigen velden (bv. Projecten: titel, opdrachtgever,
  jaar, foto's):

## 5. Wie doet wat
- Wie beheert de site (rollen: admin, redacteur)?
- Moeten bezoekers kunnen inloggen of een account maken? Waarvoor?
- Wat is openbaar, wat alleen voor leden?

## 6. Vormgeving
- Logo, kleuren, lettertypen (bestanden of een huisstijlgids):
- Licht, donker, of allebei?

## 7. Inhoud
- Welke teksten en beelden zijn er al, en wie levert ze aan?
- Moet inhoud van een oude site worden overgenomen?

## 8. Maatwerk
- Wensen die onder "Maatwerk" vallen (webshop, formulier, koppeling, …),
  met zo veel mogelijk detail:

## 9. Eisen genummerd
- W1: ...
- W2: ...
- S1: ...

## 10. Vragen aan de bouwers
- ...
```

# Ontwerp: de beeldbibliotheek

> Stand: 28 september 2026. Besluiten van Mark staan gemarkeerd met **▶**;
> punten zonder ▶ zijn voorstellen die nog op zijn akkoord wachten.
> Aanleiding: plank-widgets-en-plugins.md §5 (de bibliotheek is kern, geen
> plugin) en backlog S8. Volgende toepassing: een portfolio-site voor
> fotografen op Imprint.

## 1. Wat er is

`AssetStore` (content-core) bewaart bytes en geeft een content-addressed URL
terug (hash in de naam); de file-backend serveert via `/api/assets/…`;
`assets:gc` ruimt op en respecteert tijdreizen. Content verwijst per URL-string.
Geen metadata, geen upload-UI, geen picker.

## 2. Het asset als content

Nieuw kern-contenttype `asset`, één record per upload:

| Groep | Velden |
|---|---|
| techniek (bij upload) | `url`, `hash`, `mime`, `size`, `width`, `height`, `variants[]` |
| beschrijving | `title`, `alt`, `caption` |
| herkomst | `credit`, `licence`, `source` (bv. voorgevuld uit EXIF Artist/Copyright) |
| ordening | `folder`, `tags[]` |
| beeld | `focus` {x, y} (brandpunt voor bijsnijden) |
| foto (uit EXIF) | `taken`, `camera`, `lens`, `exposure` (f, sluitertijd, ISO, brandpunt), `gps` (alleen als bewaard, §5) |
| toegang | `access`: public \| restricted (§6) |

Als content heeft een asset historie, tijdreizen en relatieregels. Een betere
alt-tekst is gewoon een nieuwe versie.

## 3. Verwijzen: asset, met URL als uitweg

▶ **Besluit**: content verwijst naar een **asset** (`{ asset: "<slug>" }`, een
zachte slug-verwijzing zoals andere relaties); een veld accepteert daarnaast
een **losse URL** (extern beeld, of bestaande content van vóór de bibliotheek).

Gevolgen:
- alt, credit en varianten komen altijd uit de bibliotheek;
- "gebruikt in" is een omgekeerde relatie-query, geen stringzoektocht;
- een RelationRule bewaakt verwijderen (waarschuwen of weigeren zolang er
  naar verwezen wordt);
- migratie gaat geleidelijk: bestaande URL's blijven werken; een script kan
  URL's die naar `/api/assets/…` wijzen omzetten naar asset-verwijzingen.

Technisch: een zod-datatype `AssetRef` (`string` óf `{ asset }`) in
content-core, met een weergave-hint zodat `SchemaForm` er de picker van maakt.
In V3 heet dit al `AssetUrl` met widget `media`.

## 4. Ordening: mappen grof, tags fijn

▶ **Besluit**: **mappen** voor de grove indeling (bv. *schetsen*, *externe
afbeeldingen*, *medewerkers*) — één map per asset, zodat niet alles door
elkaar staat. **Tags** voor de fijnafstemming, omdat één beeld vaak meerdere
doelen dient — meerdere tags per asset.

▶ **Tags komen uit een kleine tag-bibliotheek met structuur**: niet één lange
lijst, maar **taglijsten** (vocabulaires), bv.

| Taglijst | Tags |
|---|---|
| Onderwerp | portret, straat, landschap, product |
| Project | musicbrain, volksgebouw, imprint |
| Gebruik | hero, social, druk |

Voorstel:
- Contenttype `taglist` (naam, omschrijving, tags[] met label + slug, volgorde);
  een asset-tag is `lijst/tag` (`onderwerp/portret`).
- Per taglijst in te stellen of redacteuren vrij nieuwe tags mogen toevoegen
  (open) of alleen kiezen (gesloten).
- **Generiek maken**: taglijsten zijn niet specifiek voor beelden. Pagina's,
  posts en straks events kunnen dezelfde lijsten gebruiken (Drupal noemt dit
  *vocabularies*). Daarom komen ze in de kern, en de bibliotheek is de eerste
  gebruiker.
- Mappen: een eenvoudige boom (`folder`-pad als string, `schetsen/2026`),
  beheerd in het bibliotheekscherm; geen apart contenttype nodig tenzij mappen
  eigen rechten krijgen.

## 5. Varianten

Een **variant** is een verkleinde kopie van het origineel voor het web (bv.
400, 800, 1600 en 2400 px breed, als WebP/AVIF). De viewer zet ze in een
`srcset`; de browser kiest de kleinste die scherp genoeg is voor het scherm.
Het **origineel blijft altijd onaangeroerd bewaard**.

Voorstel: **varianten maken bij upload** (`sharp`, vaste set breedtes). Dat is
voorspelbaar: na de upload bestaat alles wat een pagina nodig heeft, er is
niets dat voor het eerst bij een bezoeker moet worden berekend, en de
varianten gaan gewoon mee in de backup. Het alternatief ("op aanvraag": pas
maken als een pagina voor het eerst om 800 px vraagt, dan bewaren) bespaart
alleen opslag voor maten die nooit gebruikt worden — niet de moeite waard.

## 6. EXIF

EXIF kost nauwelijks ruimte (enkele tot tientallen kB per foto). Het gaat om
**privacy**: telefoonfoto's bevatten de **GPS-locatie** (bv. van je huis). De
cameragegevens zijn voor fotografen juist waardevol en op een portfolio zelfs
iets om te tonen.

Voorstel:
- Het **origineel** houdt altijd zijn EXIF (het is jouw bestand).
- De **webvarianten** krijgen een EXIF-beleid met drie standen:
  *alles bewaren* · *alleen locatie weghalen* · *alles weghalen*.
- Het beleid is een **persoonlijke instelling** (default per gebruiker, bv.
  fotograaf: *alles bewaren*), met een default per site (*alleen locatie
  weghalen*) en per upload te overschrijven.
- EXIF wordt bij upload **uitgelezen** naar de assetvelden (camera, lens,
  belichting, datum, credit). Een portfolio-widget kan die onder een foto
  tonen ("Leica Q2 · 28 mm · f/2.8 · 1/250 · ISO 100").

## 7. Beperkte assets

Nu is elk asset openbaar: wie de URL heeft, ziet het beeld. Een foto op een
beperkte wikipagina is dus wél te zien voor wie de link doorgestuurd krijgt.
Beperkte assets (`access: restricted`) serveren via een route die door de
AuthZEN-poort gaat en niet publiek gecachet wordt.

Voorstel: **later**, maar het veld `access` er nu al in zetten. Voor een
portfolio is het wel een echte wens (proefgalerij voor een klant), dus de
eerste portfolio-site is het natuurlijke moment.

## 8. Opslag: file, of S3 (MinIO)

De `AssetStore`-interface maakt dit een configwissel. Stand van zaken: lokaal
draait al een MinIO-container van het bitemporal-project (`bitemp-minio-v06`,
poort 9000/9001).

Voorstel:
- **Eén MinIO-instantie per machine delen mag**, maar elke site/app krijgt een
  **eigen bucket en een eigen sleutel** met een policy die alleen die bucket
  mag. Dan zijn ze in de praktijk gescheiden, zonder extra container.
- Een **aparte container** alleen als je de levenscycli wilt ontkoppelen (een
  upgrade of herstart van de bitemporal-MinIO raakt dan de sites niet).
- **Let op**: MinIO heeft in 2025 de community-editie ingeperkt (de beheer-
  console uitgekleed, en voor zover bekend geen nieuwe kant-en-klare images en
  binaries meer; alleen broncode). Controleer dat vóór we erop bouwen. S3-
  compatibele alternatieven zonder dat risico: **Garage** (AGPL, licht,
  gemaakt voor kleine installaties) en **SeaweedFS** (Apache-2). Omdat
  Imprint via de S3-API praat, is de keuze later te wisselen.
- Op één VPS is de **file-backend + restic-backup** (plank §4.4) ook een
  prima eindstation. S3 wordt pas echt nodig bij meerdere servers of als de
  beelden buiten de server moeten staan.

## 9. UI

- **Bibliotheekscherm** (Content → Media): mappenboom links, raster in het
  midden, filters op taglijsten, uploaden met drag-and-drop, detailpaneel
  rechts (metadata, EXIF, varianten, **gebruikt in**).
- **Picker** in `SchemaForm` voor elk `AssetRef`-veld: "kies uit bibliotheek"
  / "upload nieuw" / "externe URL".
- **In de rich-text-editor** (TipTap): dezelfde picker achter een
  afbeeldingknop.
- **Taglijsten** beheren: een eigen scherm onder Model & config.

## 10. Volgorde

1. `asset` + upload-endpoint (type-sniffing, maximale grootte, SVG saneren,
   EXIF uitlezen, varianten maken) + bibliotheekscherm met mappen.
2. Taglijsten (kern) + tags in de bibliotheek.
3. `AssetRef` + picker in `SchemaForm`; beeldwidgets erop, URL's blijven werken;
   migratiescript voor `/api/assets/…`-URL's.
4. `srcset` in de viewers; focus-punt bij bijsnijden.
5. TipTap met afbeeldingknop.
6. Beperkte assets via de poort; S3-backend (MinIO/Garage) als configwissel.

## 11. Open

- §5 varianten bij upload — akkoord?
- §6 EXIF-beleid met drie standen, persoonlijke default — akkoord?
- §7 beperkte assets later, veld nu — akkoord?
- §8 opslag: gedeelde S3-instantie met eigen bucket/sleutel, of eigen
  container, of file-backend houden; en MinIO of een alternatief.

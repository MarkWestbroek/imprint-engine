# Documentatie van Imprint

Imprint is een publicatieplatform waarmee meerdere merk- en productsites op
dezelfde motor kunnen draaien. Deze map bevat de functionele, technische en
operationele verdieping. Begin bij de [hoofd-README](../README.md) als je nog
niet weet wat Imprint is.

## Kies je route

### Ik wil Imprint gebruiken

- [Handleiding voor redacteuren](handleiding.md) - werken met de admin,
	pagina's, widgets, wiki's, planning, historie en thema's.
- [Live MusicBrain-site](https://musicbrain.nl) - de eerste imprint in de
	praktijk.

De handleiding leeft ook als Help-wiki in de site. De wiki is de actuele
redactionele versie; het Markdown-bestand in deze repository is voorlopig een
reservekopie.

### Ik wil Imprint ontwikkelen of beheren

- [Architectuur](architecture.md) - contentmodel, widgets, opslag,
	autorisatie, admin en het toevoegen van een imprint.
- [Overdracht](overdracht.md) - een ontwikkelmachine inrichten, live omgeving
	en bekende operationele valkuilen.
- [Back-ups](backups.md) - database en assets veiligstellen en terugzetten.
- [Releasen](releasing.md) - versies, changelog, tags en het releasescript.
- [MMB ingest-handleiding](mmb-ingest-guide.md) - content en board-assets
	vanuit een productproject naar Imprint publiceren.

Installatiecommando's, lokale ontwikkeling, de Content-API en deployment naar
Plesk staan voorlopig bij elkaar in de [hoofd-README](../README.md).

### Ik wil begrijpen waarom het zo is gebouwd

- [Revisievoorstel engine/instanties/plugins](design/engine-instance-plugin-architectuur.md)
	- gewenste scheiding tussen motor en sites, gedeelde admin, configureerbare
	widgets, pluginmodel en gefaseerd migratieplan.
- [Website-requirements](website-requirements.md) - oorspronkelijke
	functionele en technische eisen voor MusicBrain en de publicatiemotor.
- [Ontwerpdocumenten](design/) - uitwerkingen van onder meer het contentmodel,
	meertaligheid, widgets en wiki's.
- [Backlog](backlog.md) - open werk en nog te nemen ontwerpbeslissingen.
- [Changelog](../CHANGELOG.md) - wat er per versie is veranderd.

## Status van documenten

Niet ieder document heeft dezelfde functie:

| Soort | Betekenis |
|---|---|
| Handleiding | Beschrijft wat een redacteur nu met Imprint kan |
| Architectuur | Beschrijft de huidige technische werking |
| Requirements | Legt de oorspronkelijke doelen en eisnummers vast |
| Design | Bevat ontwerpen; onderdelen kunnen nog in ontwikkeling zijn |
| Backlog | Bevat open punten en is geen beschrijving van bestaand gedrag |
| `mmb-*` en notes | Taakgerichte integratie-, onderzoeks- of overdrachtsnotities |

Bij tegenstrijdigheid is de werkende code leidend voor technisch gedrag. Voor
redactioneel gebruik is de Help-wiki op de draaiende site de actuele bron.

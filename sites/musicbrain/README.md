# MusicBrain

MusicBrain is de eerste site, of *imprint*, die op de Imprint-publicatiemotor
draait. De publieke site combineert productinformatie, componenten, releases,
board-documentatie, wiki's en vrij samengestelde pagina's. Redacteuren beheren
die inhoud via de ingebouwde admin en visuele paginastudio.

Dit is een workspace binnen de grotere Imprint-repository. Gebruik daarom de
commando's vanuit de repository-root; dependencies en gedeelde code worden via
npm workspaces beheerd.

- [Wat is Imprint?](../../README.md)
- [Handleiding voor redacteuren](../../docs/handleiding.md)
- [Technische architectuur](../../docs/architecture.md)
- [Alle documentatie](../../docs/README.md)

Lokaal starten:

```bash
# vanuit de repository-root
npm install
npm run dev
```

Zonder `DATABASE_URL` gebruikt de site de meegeleverde contentbestanden en is
de admin niet beschikbaar. Voor de volledige omgeving met MariaDB, admin en
een eerste gebruiker volg je [Lokaal draaien](../../README.md#lokaal-draaien-from-scratch).

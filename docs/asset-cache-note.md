# Note voor Imprint: asset-caching is te hard (stale renders)

> **OPGELOST** (Imprint-kant): optie 1 geïmplementeerd. `FileAssetStore.put`
> content-hasht de bestandsnaam (`render-top.<sha8>.png`), dus een
> her-publicatie met nieuwe bytes levert een nieuwe URL → cache-miss → vers;
> `immutable` blijft correct. De ingest herschrijft de asset-namen in de
> board-spec automatisch naar de gehashte URL's. Geverifieerd: republiceren
> geeft een andere URL en de board-spec wijst naar de nieuwe. Deze note mag weg.


Bevinding vanuit het MMB-publiceerspoor (board-spec ingest). **Actie nodig aan
Imprint-kant** — ik kan dit niet aan de publiceer-kant fixen, want de
asset-URL's worden door de ingest-backend bepaald.

## Het probleem

`GET /api/assets/<component>/<versie>/<naam>` stuurt:

```
Cache-Control: public, max-age=31536000, immutable
```

Eén jaar, **immutable**. Maar een board-spec kan **opnieuw gepubliceerd** worden
met **nieuwe bytes op dezelfde versie-URL** (bijv. een verse 3D-render na een
bordfix). Omdat de URL stabiel is (`…/enc5front/v2.0/render-top.png`) en de
respons `immutable` zegt, blijft elke browser — en een eventuele CDN/Plesk-
cache — een jaar lang de **oude** render tonen.

**Impact:** een normale bezoeker ziet de oude afbeelding permanent. Alleen een
hard-refresh (Ctrl+Shift+R) haalt de nieuwe op — dat weet een bezoeker niet.
Reproduceerbaar: republiceer enc5front → serverbytes zijn nieuw (bevestigd via
directe `curl`), maar de site toont de oude tot hard-refresh.

`immutable` is alleen correct als de **URL verandert zodra de inhoud verandert**.

## Twee oplossingen

1. **Content-hash in de bestandsnaam** (aanbevolen): `render-top.<sha8>.png`.
   Nieuwe render = nieuwe URL = cache-miss = vers; `immutable` blijft correct en
   maximaal efficiënt. Dit is het standaardpatroon (zoals Next zelf z'n static
   assets fingerprint). De ingest berekent de hash bij opslaan en zet 'm in de
   asset-URL die in de board-spec belandt.
2. **Of `immutable` laten vallen** en revalideren: `Cache-Control: public,
   max-age=0, must-revalidate` + ETag — precies wat `/boards/*.png` (de
   public-map) nu al doet. Simpeler, iets minder cache-efficiënt, maar altijd
   vers.

Optie 1 is het mooist; het raakt **élke** her-publicatie van **élke** board-spec,
niet alleen enc5front.

## Kant-en-klaar bewijs

```
$ curl -sD - -o /dev/null http://localhost:3000/api/assets/enc5front/v2.0/render-top.png | grep -i cache
cache-control: public, max-age=31536000, immutable      # <-- te hard

$ curl -sD - -o /dev/null http://localhost:3000/boards/musicbrain-enc5front.png | grep -i cache
Cache-Control: public, max-age=0                         # <-- public-map doet het wél goed (+ETag)
```

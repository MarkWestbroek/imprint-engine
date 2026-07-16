# Testcase: oude releases en versies blijven benaderbaar

**Aanvrager:** MusicBrain-project (MMB) · **Aangeleverd:** 2026-07-16 ·
**Uitgevoerd:** 2026-07-16 tegen https://musicbrain.nl (v0.9.0) — **GESLAAGD**

**Aanleiding:** de gen-2-hardwarerelease (`cortex v0.2`) verving de
gepubliceerde gen-1-set. Bitemporaal CMS = niets raakt kwijt; deze test legt
die belofte vast en is herhaalbaar (alle checks read-only).

## Gegeven

1. Component `adc8` met specs `adc8@v1.2` (gen 1) en `adc8@v2.0` (gen 2),
   beide via de ingest-API gepost (met assets: render, overview, pinouts).
2. Release A (`modular-mb v0.2`, 2026-07-11) pint `adc8@v1.2`.
3. Release B (`cortex v0.2`, 2026-07-16) pint `adc8@v2.0`.

## Asserts + uitslag (2026-07-16, live)

1. **Release-lijst** — `GET /api/content/releases` bevat ná release B nog
   steeds release A. → **✓** (lijst: cortex v0.2, modular-mb v0.2,
   guitar-switcher v0.1, simulator 0.1.0 — niets verdwenen.)
2. **Component-versies** — `GET /api/content/components/adc8` toont beide
   versies met spec-verwijzing. → **✓**
   (`[{v1.2, spec: adc8@v1.2}, {v2.0, spec: adc8@v2.0}]`)
3. **Oude spec + assets** — `GET /api/content/board-specs/adc8@v1.2` blijft
   opvraagbaar en alle 4 content-hashed asset-URL's
   (o.a. `/api/assets/adc8/v1.2/render-top.e66095d5.png`) geven HTTP 200,
   óók nadat v2.0 met nieuwe renders is geïngest. → **✓** (4/4 assets 200.)
   Dit is precies waarvoor de content-hashing bestaat: v2.0-assets krijgen
   nieuwe URL's en verdringen de v1.2-bestanden dus nooit.
4. **Site-weergave** — `/components/adc8` toont Board v1.2 én Board v2.0
   volledig, plus "Used in" met de releases. → **✓ (basis)** — oudere
   versies zijn bereikbaar. De verfijning "de door de nieuwste release
   gepinde versie prominent, oudere ingeklapt als archief" staat op de
   backlog (§4).

## Herhalen

Asserts 1–3 zijn met `curl` tegen de API na te lopen (read-only, veilig op
productie); de URL's staan hierboven. De diepere garantie zit in de opslag:
elke schrijfactie superseedt (`tx_to`) en verwijdert nooit — zie
[architecture.md §4](../architecture.md).

# Onderzoek — widgets/blocks in andere CMS'en: is er een standaard?

Vraag van Mark (juli 2026): welke open-source CMS'en (bij voorkeur
React/JS/Node) werken met widgets, hebben ze elk een eigen formaat, of is er
een standaard — en zou een widget dan in meerdere systemen kunnen draaien?

## Het korte antwoord

**Iedereen heeft widgets/blocks, iedereen heeft een eigen formaat, en een
echte interop-standaard is er niet.** Er zijn twee dingen die in de búúrt
komen (Portable Text en het Block Protocol, zie onder), maar geen daarvan
dekt "een widget met configschema + renderer die je in systeem A én B
gebruikt". Het goede nieuws: het model dat Imprint heeft — `{ type, config }`
met een schema per type en een eigen React-renderer — ís de de-facto
mainstream; we staan dicht bij de rest, niet ernaast.

## Het landschap (React/JS/Node)

| Systeem | "Widget"-begrip | Formaat | Portabel? |
|---|---|---|---|
| **WordPress / Gutenberg** | *Blocks*: `block.json` + React `edit`/`save` | HTML met commentaar-markers als opslag | Grootste ecosysteem ter wereld, maar blocks leunen op WP-runtime-API's. De editor zélf is los te gebruiken (`@wordpress/block-editor`, Automattic's *isolated-block-editor*) |
| **Payload** (MIT, Node/React) | *Blocks*-veldtype: TS-config met `fields` + eigen React-renderer | Code-first, types gegenereerd | Nee — maar het model is vrijwel 1-op-1 het onze |
| **Strapi** (Node/React-admin) | *Components* + *dynamic zones* | JSON-schema's in code, admin rendert formulieren | Nee |
| **Sanity** | Schema-as-code; rich content als **Portable Text** met custom blocks | Portable Text = JSON-array van getypeerde blocks | Portable Text wél (zie onder); de widgets zelf niet |
| **Storyblok** (commercieel) | *Bloks*: JSON-componentdefinities + visual editor | Eigen JSON | Nee |
| **Puck** (MIT, puur een React-editor, geen CMS) | `config.components`: `{ fields, render }` | Eigen, maar opvallend: **vrijwel identiek aan ons registry+viewer-contract** | Config is klein genoeg om mechanisch uit onze catalogus te genereren |
| **Directus, Keystone, TinaCMS, Builder.io, Plasmic** | vergelijkbare varianten (M2A-builder, blocks, visual trees) | elk eigen JSON | Nee |

## De twee "bijna-standaarden"

**Portable Text** ([portabletext.org](https://www.portabletext.org/specification/))
— een échte, open, stabiele spec (sinds 2018; Sanity, Hugo e.a.), maar voor
**rich text als getypeerde JSON-blocks**, niet voor interactieve widgets.
Sterk idee: onbekende blocktypes worden gracieus overgeslagen. Relevant voor
ons als we ooit van markdown af willen; niet het widget-antwoord.

**Block Protocol** ([blockprotocol.org](https://blockprotocol.org/) — het
initiatief van Joel Spolsky/HASH, 2022) — precies de droom uit de vraag:
blocks als npm-packages met een getypeerd datacontract (JSON-Schema-
entiteiten!) die in elke "embedding application" draaien; er was zelfs een
WordPress-plugin. Status 2026: technisch levend (repo's krijgen updates,
vooral vanuit HASH zelf) maar **de adoptie is nooit gekomen** — geen groot
CMS buiten HASH embedt het serieus. Conceptueel wel de beste verwant van
ons model: hun entity-types ≈ onze zod-schema's + `/api/meta`-references.

**Webcomponents** zijn de enige *runtime*-standaard die echt overal draait —
onze 3D-tab (`<model-viewer>`) is er het bewijs van: een "widget" van Google
in onze pagina zonder enige aanpassing. Maar een webcomponent standaardiseert
alleen de renderkant, niet het configschema/editor-deel.

## Wat dit voor Imprint betekent

1. **Niets adopteren** — er is geen standaard die ons model vervangt, en ons
   contract (schema in `registry.ts`, viewer in `components.tsx`) is
   gelijkvormig aan Payload/Puck; we zitten op de hoofdstroom.
2. **Goedkope portabiliteit als het ooit moet**: onze catalogus is mechanisch
   naar een **Puck-config** te vertalen (fields uit het zod-schema, render =
   onze viewer) — dat zou de studio-editor inwisselbaar maken, of onze
   widgets bruikbaar in andermans Puck. Idem: een widget als webcomponent
   verpakken maakt hem CMS-onafhankelijk aan de renderkant.
3. **De ideeën die het lenen waard zijn**: Portable Text's "onbekend blok →
   gracieus overslaan" (doen we al), en Block Protocol's getypeerde
   datacontracten — dat is precies de richting van `/api/meta` en het
   formulier-spoor met het bitemporal-project.

## Bronnen

- [Headless CMS 2026: Contentful vs Strapi vs Sanity vs Payload](https://dev.to/pooyagolchian/headless-cms-2026-contentful-vs-strapi-vs-sanity-vs-payload-compared-5bi3)
- [CMS for React (2026), naturaily](https://naturaily.com/blog/best-headless-cms-react) · [focusreactive.com/react-cms](https://focusreactive.com/react-cms/)
- [Puck — GitHub](https://github.com/puckeditor/puck) · [docs](https://puckeditor.com/docs)
- [Automattic isolated-block-editor](https://github.com/Automattic/isolated-block-editor) · [Gutenberg custom block editor guide](https://github.com/WordPress/gutenberg/blob/trunk/docs/how-to-guides/platform/custom-block-editor.md)
- [Portable Text-specificatie](https://www.portabletext.org/specification/) · [GitHub](https://github.com/portabletext/portabletext)
- [Block Protocol](https://blockprotocol.org/) · [GitHub](https://github.com/blockprotocol/blockprotocol) · [Joel on Software over de voortgang](https://www.joelonsoftware.com/2022/12/19/progress-on-the-block-protocol/)

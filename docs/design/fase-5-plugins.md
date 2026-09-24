# Opzet Fase 5 — planning en wiki als eerste plugins

Status: **opzet met besluiten**, 24 september 2026 (de vier keuzes in §6 zijn door Mark beantwoord). Werkt Fase 5 uit het
[revisievoorstel](engine-instance-plugin-architectuur.md) (§6 plugins, §8
instantieconfiguratie, §12 Fase 5) uit tot concrete stappen. De open keuzes
staan in §6; de rest is techniek.

## 1. Doel en exitcriterium

Een plugin is een sitebrede capability die een site aanzet in
`imprint.config.ts` (revisievoorstel §6.1). Planning en wiki zijn de proef:
het is de laatste code in MusicBrain die niet van MusicBrain is (~2.100
regels: schermen, actions, borden, wiki-studio, publieke wiki-route, de
planning-widget).

**Exit (§12):** minimaal één capability is volledig een plugin en kan in een
instantie worden weggelaten zonder enginecode te wijzigen. Concreet:
MusicBrain heeft `plugins: [planningPlugin(), wikiPlugin()]` en werkt zoals
nu (browsertests groen); de Imprint-site heeft `plugins: []` en kent de typen
`planning` en `wiki` niet — geen menu-item, geen lijst, geen API-antwoord.

## 2. Waar het nu vastzit: contenttypen zijn dichtgetimmerd in de kern

Alles wat een plugin zou moeten kunnen bijdragen, staat nu hard in de engine:

| wat | waar | vorm |
|---|---|---|
| de naam van het type | `content-core/src/store.ts` | gesloten `ContentType`-union (14 namen) |
| het schema | `content-core/src/schemas.ts` | `PlanningSchema`, `WikiSchema`, … |
| validatie bij schrijven | `db-store-base.ts` `validate()` | `switch (type)` |
| catalogusregel (label, vlaggen, menuplek) | `content-types.ts` | `CONTENT_TYPES` |
| relatieregels | `relations.ts` | `DEFAULT_RELATION_RULES` |
| formulier per type | `runtime-admin/src/forms.ts` | `switch (type)` |
| startwaarden en sleutel | `admin-server/item-edit.tsx`, `actions.ts` | `emptyData()`, `slugFor()` |

Dat zijn zeven plekken die elk een `switch` of lijst zijn. Widgets hebben dit
probleem niet meer: de kern kent geen concrete widget, een site levert zijn
catalogus. Hetzelfde moet voor contenttypen gebeuren. **Dat is de eigenlijke
inhoud van Fase 5**; planning en wiki verhuizen is daarna verhuiswerk.

## 3. Ontwerp

### 3.1 Contenttypedefinities in plaats van switches

Eén object per type, naar het voorbeeld van `WidgetTypeDefinition`:

```ts
interface ContentTypeDefinition {
  name: string;                 // "planning-item"
  schema: z.ZodType;            // validatie bij schrijven én lezen
  label: string;                // "Planning items"
  flags: ContentTypeFlag[];     // listable, editable, ingestable, overview, viewable
  menu?: { group; section? };   // waar de lijst in het admin-menu hoort
  relations?: RelationRule[];   // regels waarin dit type de bron is
  emptyData?: () => Record<string, unknown>;   // startwaarden in het formulier
  slugOf?: (data) => string;    // default: data.slug
  form?: (schema) => JsonSchema;// default: formulier uit het zod-schema
}
```

- De kern levert zijn eigen typen als definities (page, product, component,
  board-spec, release, menu, theme, site, relations). Ze blijven in de kern;
  een latere `plugin-catalog` (§6.2 van het voorstel) kan product, component,
  release en board-spec eruit halen, maar dat is niet Fase 5.
- Een `ContentTypeRegistry` (kern + plugins + site) vervangt `CONTENT_TYPES`
  en gaat als optie de store in, zoals `widgets` nu: `validate()` zoekt het
  schema op in plaats van te switchen. De `ContentTypeCatalog` (beschikbaar
  versus actief, Fase 3) blijft, maar leest uit het register.
- `ContentType` wordt een open string. De getypeerde leesmethoden
  (`listProducts`, `getPage`, …) blijven voor de kerntypen; plugintypen
  werken via `listItems`/`getItem`, zoals planning en wiki nu al doen.
- Een type dat niemand registreert: schrijven wordt geweigerd, lezen van
  bestaande rijen blijft mogelijk (rauw). Uitschakelen van een plugin gooit
  dus nooit data weg (§6.3, regel 7).

### 3.2 Het plugincontract

```ts
export function definePlugin(plugin: {
  name: string;                       // "planning"
  version: string;
  contentTypes?: ContentTypeDefinition[];
  widgets?: WidgetTypeDefinition[];   // schema's; viewers en editors apart (React)
  viewers?: WidgetViewers;
  editors?: Record<string, WidgetEditor>;
  admin?: {
    contributions?: AdminContribution[];         // menu-items
    screens?: (admin, path: string[]) => ReactNode | null;   // /admin/<name>/…
    actions?: Record<string, (admin, ...args) => Promise<unknown>>;
  };
  publicRoute?: (ctx, slug: string[]) => ReactNode | null;  // de wiki
  relations?: RelationRule[];         // regels tussen typen van verschillende bronnen
}): ImprintPlugin;
```

Alles wat React bevat (viewers, editors, schermen) zit in de plugin, maar de
kern van de plugin (typen, schema's, regels) is React-vrij, net als bij
widgets. **Zoals gebouwd:** `ImprintPluginCore` (extension-api) is de
React-vrije helft die `createImprint` samenvoegt; `ImprintPlugin`
(runtime-admin) breidt hem uit met `screen` en `actions`. Eén object draagt
beide. De React-helften van een widget (viewer, editor) componeert de site
zelf in zijn catalogus (`...planningWidgets`, `...planningViewers`), omdat de
catalogus van de site is; Node-scripts (seed, tests) importeren de React-vrije
entries (`/content-types`, `/schemas`). De instantie (`createImprint`) voegt samen: contenttyperegister,
widgetcatalogus, relatieregels; de `AdminContext` krijgt `plugins` en
bouwt menu en schermen ermee.

### 3.3 Routes: geen bestand per plugin in de site

Next wil routebestanden in de site, en `"use server"`-actions moeten
top-level exports zijn (Fase 3 leerde dat). Daarom bouwtijd-compositie via
drie vaste haken, één keer per site:

| haak | bestand in de site | doet |
|---|---|---|
| admin-schermen | `app/admin/[type]/page.tsx` en `app/admin/[type]/[...path]/page.tsx` | is `type` een contenttype → de generieke lijst; is het een pluginnaam → `plugin.admin.screens(admin, path)`. URL's blijven `/admin/planning`, `/admin/planning/<slug>`, `/admin/wiki/<slug>` |
| plugin-actions | `app/admin/actions.ts` | één extra wrapper: `pluginAction(plugin, action, ...args)` die naar `plugin.admin.actions[action](admin, ...args)` gaat; elke action controleert zelf de sessie, zoals nu |
| publieke route | de catch-all `(site)/[...slug]` en `/members/[...slug]` | vragen eerst de plugins (`publicRoute`), dan pas de pagina's — de wiki-logica die daar nu 31 regels inneemt gaat naar de wiki-plugin |

Een plugin met een echt eigen API-endpoint (later: GitHub-webhook, ingest)
krijgt wél een dun routebestand; dat is de uitzondering, niet de regel.

### 3.4 Waar plugins leven

Workspaces, zoals §7 van het voorstel: `packages/plugin-planning`,
`packages/plugin-wiki`. Vertrouwde code, geactiveerd in `imprint.config.ts`,
geïnstalleerd bij de build (§6.3). Elke plugin heeft zijn eigen tests
(schema's, `applyMove` van de planning, de wiki-boom) en een regel in de
Dockerfile (`COPY`, zoals elk workspace-package).

## 4. Stappen

| stap | wat | maat |
|---|---|---|
| 1 | `ContentTypeDefinition` + `ContentTypeRegistry` in de kern; de zeven switches worden opzoekingen; de kerntypen als definities; store en catalogus lezen uit het register. Geen gedragsverandering: contractsuites en browsertests bewijzen dat | L, klaar |
| 2 | `definePlugin` in `extension-api`; `createImprint` voegt plugins samen; `AdminContext.plugins`; de drie haken in MusicBrain (schermen, actions, publieke route) | M, klaar (publieke haak volgt met de wiki) |
| 3 | `@imprint/plugin-planning`: typen, relaties, widget (schema + viewer + editor), bordadmin, `lib/planning` met tests. MusicBrain: `plugins: [planningPlugin()]`, code weg uit de site | M, klaar |
| 4 | `@imprint/plugin-wiki`: drie typen, wiki-studio, publieke route en ledenroute, `wiki-href` | M–L |
| 5 | Exitproef: de Imprint-site zonder plugins kent de typen niet; MusicBrain met plugins werkt; één plugin uitzetten breekt niets behalve zijn eigen schermen. Browsertest voor planning (bord, kaart verslepen) en wiki (pagina maken, verplaatsen, publiek/beperkt) | M |

Volgorde volgt het voorstel: planning eerst (duidelijk afgebakend), wiki
daarna (publieke route en autorisatie maken hem lastiger).

## 5. Wat bewust niet in Fase 5 zit

- **Product, component, release, board-spec** blijven in de kern; de
  `plugin-catalog` uit het voorstel komt later, als de typedefinities er
  zijn is dat vooral verhuiswerk.
- **Pluginconfig in de admin** (beslispunt §17): nu code-only. Een plugin
  die instellingen nodig heeft, krijgt die in `imprint.config.ts`.
- **Achtergrondtaken, webhooks, migraties** uit het manifest (§6.4): het
  contract laat er ruimte voor, maar geen van beide plugins heeft ze nodig.
- **Runtime installeren** van plugins: nooit (§6.3).

## 6. Keuzes (beantwoord door Mark, 24 september 2026)

| keuze | besluit |
|---|---|
| 1. typen van plugins | ja: `ContentType` wordt open; het register bewaakt op runtime, zoals bij widgets |
| 2. routes | de drie haken (§3.3); een dun routebestand alleen voor een plugin met een echt eigen endpoint |
| 3. volgorde | doorwerken tot planning een plugin is; het register (stap 1) niet apart voorleggen |
| 4. namen | `@imprint/plugin-planning`, `@imprint/plugin-wiki` |

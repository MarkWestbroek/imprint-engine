# Ontwerp — Wiki (site-in-de-site) + autorisatie (PBAC-lite)

Status: **denkstuk**, juli 2026 (sessie met Mark). Nog niet gebouwd;
backlog §"Wiki". Twee verweven onderwerpen: het wiki-contentmodel en de
autorisatielaag die het nodig maakt.

## 1. Wat is een wiki hier?

Een **op zichzelf staande bundel informatie over één onderwerp** — zoals een
boek: hoofdstukken en pagina's zijn waardeloos zonder de band eromheen
("hermetisch" in die zin, niet per se afgeschermd). Voorbeelden: een
**Help/handleiding** van de site zelf, een **deep-dive Cortex**. Een wiki
heeft z'n eigen navigatie (boom links in beeld) en leeft onder één
URL-voorvoegsel; hij mag vrij naar buiten linken en de site mag naar binnen
linken — alles heeft een slug.

## 2. Contentmodel

Drie nieuwe contenttypen (zod-schema's in content-core; alles zachte
slug-referenties, bewaakt door RelationRules — bestaand mechanisme):

| Type | Velden (kern) | Rol |
|---|---|---|
| **Wiki** | `slug, title, description, order, visibility` | de band om het boek; URL-voorvoegsel (`/help/…`) |
| **WikiFolder** | `slug, wiki→, parent→?, title, order` | hoofdstuk/sectie; nestbaar via `parent` |
| **WikiPage** | `slug, wiki→, folder→, title, body (markdown), order` | de pagina |

- **Verplaatsen** van een pagina = het `folder→`-veld wijzigen (één
  referentie; direct bewerkbaar in de admin, drag & drop kan later zoals bij
  het planbord).
- **Relatieregels**: `WikiPage.folder → WikiFolder` en
  `WikiFolder.wiki → Wiki` enforced — een pagina kan niet naar een
  niet-bestaande folder wijzen (bestaande `DbContentStore.putItem`-check).
- **Slugs** zijn per wiki uniek; de volledige URL is
  `/<wiki>/<folder-pad>/<pagina>`.

## 3. Routing & navigatie

- Route `/(site)/[wiki]/[...pad]` met eigen **wiki-chrome**: treeview links
  (bestaande treeview-widget, gevoed uit de folder/pagina-boom), content
  rechts. De site-header blijft; de wiki-nav komt daaronder.
- **Links**: gewone markdown-links werken (`/help/aan-de-slag`); later een
  `[[pagina]]`-shortcut die binnen de eigen wiki oplost (en rood/aangemerkt
  rendert als het doel niet bestaat — goedkope integriteitshint).
- Prerendered zoals alle publieke pagina's; admin-saves revalideren.

## 4. Autorisatie — PBAC-lite (PEP/PDP/PIP/PAP)

### Wat er al is
- `RoleType = admin | editor | reader` ([schemas.ts](../../packages/content-core/src/schemas.ts)),
  sessies (HMAC-cookie), en `canEdit()` in
  [auth.ts](../../sites/musicbrain/src/lib/auth.ts) — feitelijk een
  proto-PEP, maar alleen voor de schrijfkant.
- `ContentUser` (creator/owner/contributor per content-item) zit al in het
  model, wordt nog niet gehandhaafd (S3, backlog).

### Nu bouwen: het PEP met een vaste regelset
Eén centrale functie — het **Policy Enforcement Point** — waar élke
lees/schrijf-beslissing doorheen gaat:

```ts
authorize(subject, action, resource): Decision
// subject:  sessie (of null = publiek) — rol, naam
// action:   "read" | "create" | "update" | "delete"
// resource: { type, slug, visibility?, wiki? }
```

De beslislogica is nú een hardgecodeerde regelset (dat mag; het zit op één
plek en heet vanaf dag één PEP):

1. `admin` mag alles.
2. `editor` mag content maken en bewerken.
3. `reader` (ingelogd) mag alles lezen.
4. Publiek (geen sessie) mag alleen lezen wat `visibility: "public"` heeft.

Daarvoor krijgt content een **`visibility`-veld** (`public | members`,
default `public`) — te beginnen bij `Wiki` (en door te voeren waar nuttig).
Sites/routes roepen niet zelf `session.role === …` aan maar altijd
`authorize()`; `canEdit()` wordt een dunne wrapper of verdwijnt erin.

### Later: policies als data (de "lite" AuthZen-lijn)
Het volwassen patroon (bekend uit Marks bitemporele project/FTV, daar met
een echte backend; hier bewust de lite-variant die op Plesk past):

- **PEP** — het poortje hierboven (blijft, alleen de beslisser wisselt).
- **PDP** — een TS-componentje (geen sidecar-proces; gewoon een module) dat
  policies evalueert met contextinfo.
- **PIP** — de contextbron: sessie + attributen van de gebruiker
  (`UserSchema` uitbreiden met vrije attributen, bijv. `beroep`).
- **PAP** — beheer: policies als content (`type: "policy"`) in de bestaande
  bitemporale tabel — dus geversioneerd, met historie, bewerkbaar in de
  admin zoals RelationRules dat al zijn.

Policyvorm: klein en declaratief, bijv.
`{ effect: "allow", role: "editor", attr: { beroep: "electrotechnicus" }, action: "update", resourceType: "component" }`.
Geen rule-engine-taal; een array van dit soort regels + first-match of
deny-overrides volstaat lang.

### Later²: hiërarchische overerving in wiki's
Een recht op de **Wiki** drilt door naar folders en pagina's, tot een
diepere policy het overneemt. Dit is het ingewikkelde deel (maskeren,
conflicten) — bewust uitgesteld; het model hoeft er alleen op voorbereid te
zijn doordat resources hun `wiki→`/`folder→`-keten kennen (en dat doen ze).

## 5. Bouwvolgorde

1. Schema's (Wiki/WikiFolder/WikiPage + `visibility`) + relatieregels. _(S)_
2. `authorize()` als PEP met de vaste regelset; bestaande checks erdoorheen
   leiden. _(S)_
3. Boom-query + route + wiki-chrome met treeview. _(M)_
4. Admin: wiki's beheren zoals andere typen (schema-formulieren bestaan);
   "verplaats naar folder" is een gewoon veld. _(S)_
5. Gedogfood: de **Help-wiki** vullen met de bestaande handleiding. _(M)_
6. Daarna, los: policies-als-data (PDP/PAP), `[[wiki-links]]`,
   drag-&-drop verplaatsen, overerving. _(M–L)_

## 6. Open punten

- `visibility: members` × prerendering: members-pagina's moeten dynamisch
  (of achter een route-guard) — zelfde patroon als `/admin` (alles onder
  een guard is per definitie dynamisch).
- Zoeken binnen een wiki (later; kan client-side over de boom beginnen).
- Meertaligheid volgt het bestaande `lang`-mechanisme (zie
  design/meertaligheid.md) — wiki's zijn content, dus dat lift mee.

# Claude Code-sessie-export

> **Let op:** export van een **Claude Code**-sessie. Gebruiker- en assistentteksten zijn letterlijk overgenomen; tool-aanroepen staan als compacte `🔧`-annotaties (hun output niet); interne redeneerblokken weggelaten.
>
> - **Datum:** 2026-07-22
> - **Sessie-id:** `0893fc90-b4a0-4d04-8417-549b19060757`
> - **Branch:** `main`

---

## 👤 Gebruiker (1)

wil je naar @docs/mmb-request-3d-tab.md  kijken? MMB kan iets niet: de 3D toevoegen aan een component wel, maar dan wordt het nog niet getoond. Dat is denk ik in het kort het probleem

**🤖 Claude:**

Ik ga eerst het probleem in de codebase onderzoeken voordat ik conclusies trek. Het verzoek noemt twee sporen: (1) ingest-schema stript `view3d` en `assets.model3d`, en (2) de widget-tab. Laat me kijken hoe het nu in elkaar zit.
> 🔧 `Agent` — Find board-spec 3D wiring

**🤖 Claude:**

De verkenner zegt dat de wiring in de **broncode** al helemaal aanwezig is (schema, ingest én widget). Dat botst met wat MMB rapporteert. Voordat ik iets concludeer wil ik dat zelf verifiëren — vooral of die code echt in de huidige HEAD zit, en of er niet toch een bug in de render-keten zit. Laat me een paar dingen direct checken.
> 🔧 `Bash` — Verify 3D commit in HEAD
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\components\board-spec-view.tsx
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\components\board-spec-media.tsx

**🤖 Claude:**

Broncode klopt en zit in HEAD. Het echte probleem dat de gebruiker noemt is een **weergave**-probleem ("toevoegen wel, getoond niet"), terwijl de MMB-doc vooral over ingest gaat. Laat me de render-keten die MMB daadwerkelijk raakt narlopen: hoe de `boardspec`-widget rendert, hoe de publieke bordpagina rendert, en of de model-viewer dependency er echt is.
> 🔧 `Bash` — Check widget viewer, dep, routes
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\components\model-3d.tsx

**🤖 Claude:**

Twee concrete dingen springen eruit. Laat me ze verifiëren — de ontbrekende dependency, het schema zelf, en hoe een **component** (niet een board-spec direct) aan zijn 3D komt, want dat is precies wat de gebruiker noemt.
> 🔧 `Bash` — Confirm model-viewer install state
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\app\api\ingest\board-spec\route.ts
> 🔧 `Read` — d:\Git\Web\Imprint-engine\packages\content-core\src\schemas.ts

**🤖 Claude:**

Nu de doorslaggevende check: in een workspaces-monorepo hoist de dependency naar de **root** `node_modules`. De dynamische `import("@google/model-viewer")` in [model-3d.tsx:94](sites/musicbrain/src/components/model-3d.tsx#L94) resolvet daarheen. Laat me root checken — als die er niet is, blijft de 3D-tab hangen op de poster ("wordt niet getoond") ondanks correcte data.
> 🔧 `Bash` — Check root node_modules for model-viewer

**🤖 Claude:**

Model-viewer **is** geïnstalleerd op root en resolvet prima — dus de viewer laadt. Mijn dep-hypothese klopt niet. Dan zit het echt in de **data**: de `model3d`/`view3d`-velden bereiken de render niet. De gebruiker zegt "toevoegen aan een **component**" — laat me de component→board-spec→3D-keten narlopen en of er überhaupt data met 3D bestaat.
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\widgets\components.tsx
> 🔧 `Bash` — Find component route and 3D data

**🤖 Claude:**

De hele render-keten is compleet: schema accepteert de velden, ingest bewaart ze, de widget toont een "3D"-tab, de dep staat op root, en de GLB's staan in `public/boards/`. Het commit zit in HEAD. Dus "niet getoond" is een **data/deploy-gat**, geen ontbrekende feature. De laatste vraag: draagt een board-spec in de store daadwerkelijk `view3d`/`model3d`? Laat me de store en data checken.
> 🔧 `Bash` — Query DB for board-spec 3D data

**🤖 Claude:**

DB-container draait niet, dus de live data-staat kan ik nu niet queryen (en ik ga niet ongevraagd de DB opstarten/muteren). Eén ding wil ik nog exact verifiëren: het GET-endpoint waarmee MMB "null" zag. Zij testten `GET /api/content/board-spec/<slug>` (enkelvoud) → *Unknown content type*. Laat me de route-mapping checken zodat ik dat precies benoem.
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\app\api\content\[[...path]]\route.ts
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\app\api\content\[[...path]]\route.ts
> 🔧 `Read` — d:\Git\Web\Imprint-engine\sites\musicbrain\src\app\api\content\[[...path]]\route.ts

**🤖 Claude:**

Ik heb de hele keten nagelopen en het beeld is nu compleet. Kernconclusie: **aan de Imprint-kant is de 3D-feature volledig en correct geïmplementeerd** — het "wordt niet getoond" komt niet door een ontbrekende feature of een strippend schema, maar door een data/verificatie-gat aan de MMB-kant. En ik heb de precieze bron van hun verwarring gevonden.

## Wat er aantoonbaar wél goed staat (alles in HEAD)

| Schakel | Status | Bewijs |
|---|---|---|
| Schema accepteert `view3d` + `assets.model3d` | ✅ | [schemas.ts:194-217](packages/content-core/src/schemas.ts#L194-L217) — beide velden gedeclareerd, zod stript ze dus níét |
| Ingest bewaart ze | ✅ | [ingest/board-spec/route.ts:26-80](sites/musicbrain/src/app/api/ingest/board-spec/route.ts#L26-L80) — `rewriteAssets` is schema-agnostisch; GLB-upload → URL, dan `BoardSpecSchema.parse` |
| Widget toont een "3D"-tab + laadt GLB lazy | ✅ | [board-spec-media.tsx:32,53](sites/musicbrain/src/components/board-spec-media.tsx#L32) → [model-3d.tsx](sites/musicbrain/src/components/model-3d.tsx) |
| Rendervoorwaarde | ✅ | [board-spec-view.tsx:25-33](sites/musicbrain/src/components/board-spec-view.tsx#L25-L33): tab verschijnt zodra `spec.assets.model3d ?? spec.view3d?.src` gevuld is |
| `@google/model-viewer` + `three` | ✅ | Geïnstalleerd op **root** `node_modules` (workspace-hoisting), resolvet prima |
| GLB's aanwezig | ✅ | 10+ bestanden in [public/boards/](sites/musicbrain/public/boards/), incl. `musicbrain-busboard.glb` |
| Commit in HEAD | ✅ | `6426753` + follow-ups `f868583`/`a459c8b`/`f184844` zitten in `main` |

Kortom: er is **geen strip-bug** in de huidige code. De 3D-tab verschijnt op elke board-spec die `view3d.src` of `assets.model3d` draagt.

## De echte oorzaak van MMB's verwarring: een GET-asymmetrie

MMB verifieerde met `GET /api/content/board-spec/<slug>` (**enkelvoud**) en kreeg *"Unknown content type board-spec"* — waaruit ze concludeerden "live draait een andere build". Dat klopt niet:

- **POST** accepteert enkelvoud `board-spec` → [route.ts:29-35](sites/musicbrain/src/app/api/content/[[...path]]/route.ts#L29-L35)
- **GET** kent alléén het meervoud `board-specs` → [route.ts:101-110](sites/musicbrain/src/app/api/content/[[...path]]/route.ts#L101-L110); enkelvoud valt in de `default` → `Unknown content type` — **op localhost én live, ook op de huidige build**.

Dus hun "unknown content type" is géén bewijs van een oude build, en hun "velden null bij GET" komt hoogstwaarschijnlijk van (a) datzelfde verkeerde pad, of (b) een board-spec-rij die vóór commit `6426753` in de DB is gezet en die velden simpelweg nooit had. Een oude rij krijgt `view3d` niet vanzelf — er moet **opnieuw gePOST** worden.

Het correcte verificatiepad is meervoud: `GET /api/content/board-specs/<slug>`.

Eén ding kon ik niet live natrekken: de MariaDB-container draait nu niet, dus wat er feitelijk in de DB-rijen staat kon ik niet queryen (en ik start/muteer geen infra zonder je go).

## Mijn voorstel

Twee dingen, klein en gericht:

1. **DX-fix (aanrader):** GET ook enkelvoud `board-spec` laten accepteren (alias naar `board-specs`). Dat haalt precies de val weg die MMB het verkeerde spoor op stuurde — dan verifiëren ze met hetzelfde pad waarmee ze POSTen. ~3 regels + changelog/doc-regel per CLAUDE.md.
2. **Reproductie:** DB opstarten (`npm run db:up`), een board-spec mét `view3d` posten via de multipart-ingest, en met een echte GET aantonen dat de velden terugkomen — zodat we hard bewijs naar de MMB-chat kunnen sturen i.p.v. "het hoort te werken".

Zal ik (1) de GET-alias toevoegen en (2) de round-trip lokaal reproduceren om het sluitend te bewijzen? Of wil je liever eerst alleen het antwoord terug naar de MMB-chat (in [docs/mmb-request-3d-tab.md](docs/mmb-request-3d-tab.md)) met de verificatie-instructie (meervoud-endpoint + opnieuw posten)?

---

## 👤 Gebruiker (2)

"Eén ding kon ik niet live natrekken: de MariaDB-container draait nu niet, dus wat er feitelijk in de DB-rijen staat kon ik niet queryen (en ik start/muteer geen infra zonder je go)." dat is raar, deze draait wel

**🤖 Claude:**

Je hebt gelijk — mijn filter zocht op containernaam "maria", maar de container heet `db-1` (image `mariadb:10.11`). Die draait dus wél. Laat me nu écht de rijen queryen (read-only).
> 🔧 `Bash` — List containers and DB creds

**🤖 Claude:**

Container is `imprint-engine-db-1`, db `musicbrain`, user `imprint`. Nu de daadwerkelijke query op de board-spec-rijen (read-only, wachtwoord uit .env, niet geëchood).
> 🔧 `Bash` — Query board-spec rows for 3D fields

**🤖 Claude:**

Table heet `content_items` (meervoud). Even corrigeren:
> 🔧 `Bash` — Query content_items for board-spec 3D fields

**🤖 Claude:**

Dít is de smoking gun. De data laat het precies zien. Kijk naar `matrix@v0.3c` — exact het bord dat MMB probeert (de patchmatrix center-variant):

```
matrix@v0.3c | old     | NULL                                  | ".../model.3b2f3a73.glb"   ← ooit model3d gezet
matrix@v0.3c | old     | {"src":"/boards/musicbrain-matrix-c.glb"...} | NULL     ← ooit view3d gezet
matrix@v0.3c | CURRENT | NULL                                  | NULL                        ← huidige versie: BEIDE leeg
```

Laat me dit hard bevestigen met de volledige huidige doc en checken of de GLB klaarstaat.
> 🔧 `Bash` — Inspect matrix@v0.3c history and GLB

**🤖 Claude:**

Nu is het sluitend. De volledige tijdlijn van `matrix@v0.3c` legt precies bloot wat er misging:

| tijd (tx_from) | staat | bevat `view3d`? | bevat `assets.model3d`? |
|---|---|---|---|
| 07-21 15:07 | old | — | — |
| 07-22 15:31 | old | — | ✅ `model.3b2f3a73.glb` |
| 07-22 15:33 | old | ✅ `/boards/musicbrain-matrix-c.glb` | — |
| **07-22 15:34** | **CURRENT** | **—** | **—** |

## De oorzaak (bewezen, geen speculatie meer)

MMB **heeft** 3D toegevoegd — twee keer zelfs: om 15:31 landde `assets.model3d` (via de `--glb`-publish) en om 15:33 `view3d.src` (via de andere publish-stap). Beide zitten nog in de bitemporale historie. Maar **35 seconden later, om 15:34, draaide er nóg een gewone publish zonder 3D-blok, en die overschreef alles.** Die laatste, kale versie is de `CURRENT` — en die heeft geen 3D → dus geen tab. Exact "toevoegen lukt wel, maar wordt niet getoond".

Het mechanisme: **elke board-spec-POST is een volledige documentvervanging** (bitemporal put, §B3 — geen veld-merge). MMB's pipeline heeft twee losse publish-stappen (een gewone en een `--glb`/`--3d`), en de **gewone stap draaide als laatste**. Dat busboard wél werkt, is puur omdat dáár de 3D-publish toevallig als laatste liep (`busboard@v3.1` CURRENT heeft `model3d` gezet).

**Aan de Imprint-code hoeft dus niets** voor de rendering — schema, ingest en widget zijn correct. Het is een volgorde-/data-probleem, plus een footgun.

De assets staan klaar: [musicbrain-matrix-c.glb](sites/musicbrain/public/boards/musicbrain-matrix-c.glb) (5,7 MB) en de poster-PNG staan in `public/boards/`, dus statisch geserveerd. `view3d.src` alleen is genoeg (rendervoorwaarde is `assets.model3d ?? view3d.src`).

## Twee beslissingen voor jou

**1 — Matrix nú fixen.** Ik re-post `matrix@v0.3c` met het `view3d`-blok erbij (de rest van de huidige doc ongewijzigd), dan verschijnt de tab meteen. Klein, reversibel (bitemporal historie blijft, admin → restore).

**2 — De footgun structureel dichten.** Zolang MMB's kale publish als laatste kan draaien, wipet die het 3D-blok telkens opnieuw. Twee opties:
- **Procesdiscipline (MMB-kant):** de 3D-publish altijd als laatste, of de gewone publish het `view3d`-blok laten meesturen. Geen Imprint-wijziging, maar fragiel.
- **"Sticky assets" bij ingest (Imprint-kant):** als een board-spec-POST `view3d`/`assets.model3d` weglaat terwijl de huidige versie ze wél heeft, die velden meenemen i.p.v. droppen. Robuust, maar het is een bewuste afwijking van "elke put is een volledig nieuw document" — dus een ontwerpkeuze die ik niet stilletjes wil maken.

Zal ik matrix nu re-posten (beslissing 1)? En welke kant wil je op voor de footgun — procesafspraak terug naar de MMB-chat, of de sticky-asset-merge in de ingest bouwen?

---

## 👤 Gebruiker (3)

kun je mij die API calls laten zien?

**🤖 Claude:**

Ja. Ik haal eerst de exacte huidige doc van `matrix@v0.3c` op (die hergebruik ik als payload) plus het ingest-token, zodat ik je een kant-en-klare call kan geven i.p.v. een schets.
> 🔧 `Bash` — Fetch current matrix doc and ingest token name

**🤖 Claude:**

Ik heb de volledige huidige doc. Voor de fix hoef je de GLB niet te uploaden (die staat al statisch in `public/boards/`), dus het volstaat om het `view3d`-blok toe te voegen via de JSON-route. Even checken of de dev-server draait, zodat ik je echte output kan tonen i.p.v. een gok:
> 🔧 `Bash` — Check dev server and endpoints

**🤖 Claude:**

Dev-server draait, GET werkt en geeft de volledige her-postbare doc terug, en GLB+PNG zijn `200`. Hier zijn de exacte calls. Let op de **enkelvoud/meervoud-asymmetrie**: GET = `board-specs`, POST = `board-spec`.

## Variant A — minimale fix (statische `view3d`, geen upload) ✅ aanrader

De GLB staat al in `public/boards/`, dus we voegen alleen het `view3d`-blok toe aan de huidige doc en posten die terug.

```bash
cd /d/Git/Web/Imprint-engine
BASE=http://localhost:3000
TOKEN=$(grep -m1 INGEST_TOKEN .env | cut -d= -f2- | tr -d '"')
SLUG='matrix@v0.3c'

# 1) huidige 3D-velden (GET = MEERVOUD board-specs)  — read-only
curl -s "$BASE/api/content/board-specs/$SLUG" | jq '{view3d, model3d: .assets.model3d}'
#   → { "view3d": null, "model3d": null }

# 2) fix: huidige doc ophalen, view3d injecteren, terugposten (POST = ENKELVOUD board-spec)
curl -s "$BASE/api/content/board-specs/$SLUG" \
  | jq '. + {view3d: {mode:"glb", src:"/boards/musicbrain-matrix-c.glb", poster:"/boards/musicbrain-matrix-c.png"}}' \
  | curl -s -X POST "$BASE/api/content/board-spec/$SLUG" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        --data-binary @-
#   → {"ok":true,"type":"board-spec","slug":"matrix@v0.3c"}

# 3) verifieer
curl -s "$BASE/api/content/board-specs/$SLUG" | jq '.view3d'
#   → { "mode":"glb", "src":"/boards/musicbrain-matrix-c.glb", "poster":"/boards/musicbrain-matrix-c.png" }
```

Stap 2 haalt de volledige doc op en voegt puur `view3d` toe — alle connectors/pinouts/points/sections blijven exact zoals ze zijn. Dit maakt één nieuwe bitemporale assertie; de kale versie schuift naar de historie.

## Variant B — versioned asset (matcht MMB's `publish_board.py --glb`)

Dit is wat MMB draait: de GLB als spec-asset uploaden → `assets.model3d`. Multipart, via de ingest-route (die de bestandsnaam naar een content-hashed URL herschrijft):

```bash
# doc.json = de huidige doc (evt. mét view3d); model.glb wordt geüpload en
# assets.model3d = "model.glb" wordt herschreven naar /api/assets/matrix/v0.3c/model.<hash>.glb
curl -s -X POST "$BASE/api/ingest/board-spec" \
  -H "Authorization: Bearer $TOKEN" \
  -F "doc=<doc.json;type=application/json" \
  -F "model.glb=@sites/musicbrain/public/boards/musicbrain-matrix-c.glb;type=model/gltf-binary"
```

waarbij `doc.json` in `assets.model3d` de bare naam `"model.glb"` heeft staan (dat rewrite de route). Render-voorwaarde is `assets.model3d ?? view3d.src`, dus **Variant A alleen is al genoeg** — B is alleen nodig als je de GLB versioned/cache-safe in de asset-store wil i.p.v. statisch.

---

Ik heb **nog niets gemuteerd** — dit zijn de calls zoals jij ze kunt draaien. Zal ik Variant A nu voor je uitvoeren en daarna de `.view3d` terugtonen ter bevestiging? Dan staat de 3D-tab op matrix meteen live.

---

## 👤 Gebruiker (4)

1 — Matrix nú fixen: ja graag
2 : we kunnen MMB toch vragen die info niet apart maar tegelijk te POSTen? Als het een stukje van een resource is, dan gebruik je toch PATCH? Of snap ik iets niet?

**🤖 Claude:**

Helder — ik voer eerst de matrix-fix uit, daarna je REST-vraag (die is terecht, en je instinct klopt beter dan mijn eerdere "sticky merge"-voorstel).
> 🔧 `Bash` — Execute matrix view3d fix

**🤖 Claude:**

Token-extractie faalde. Even nagaan waar `INGEST_TOKEN` echt staat en hoe `checkIngestToken` hem leest.
> 🔧 `Bash` — Locate INGEST_TOKEN source
> 🔧 `Bash` — Inspect checkIngestToken impl

**🤖 Claude:**

Gevonden: `INGEST_TOKEN` staat in `sites/musicbrain/.env.local`, niet in root `.env` — daarom was mijn token leeg. Opnieuw, nu uit het juiste bestand:
> 🔧 `Bash` — Re-run fix with correct token

**🤖 Claude:**

✅ **Matrix is gefixt.** De POST gaf `{"ok":true}` en de GET bevestigt dat `matrix@v0.3c` nu een `view3d`-blok heeft (`/boards/musicbrain-matrix-c.glb` + poster). Er staat een nieuwe bitemporale assertie als CURRENT; de kale versie is naar de historie geschoven. Overal waar `matrix@v0.3c` wordt gerenderd verschijnt de "3D"-tab nu.

## Je REST-vraag — je snapt het goed

Je instinct klopt, en hij is zelfs schoner dan mijn eerdere "sticky merge"-voorstel. Er zijn twee nette wegen; het verschil zit 'm in hoe de store schrijft.

**Waarom een POST nu álles vervangt.** De ContentStore is document-versioned/bitemporaal (§B3): elke schrijfactie is een **volledige, onveranderlijke snapshot-rij** van het hele document. De schrijf-eenheid is "een hele documentversie", niet "een veld". Een POST betekent dus: *"dit is vanaf nu de complete waarheid van deze board-spec."* Laat je `view3d` weg, dan zeg je impliciet "die hoort er niet meer bij" → weg. Dát is wat MMB's kale publish deed.

**Optie 1 — tegelijk POSTen (aanrader, geen code).** Precies wat je zegt. Het echte probleem is niet de API maar MMB's pipeline: die vuurt twee losse publishes af (een gewone + een `--glb`/`--3d`), en de gewone liep als laatste. `widget_export.py` genereert het `view3d`/`model3d`-blok al — de fix is dat de board-spec-export **één doc met álles erin** publiceert, en niet een tweede, kale publish erachteraan. Past perfect bij het snapshot-model: generators produceren van nature een heel document.

**Optie 2 — een echte PATCH bouwen.** Kan prima, maar hij is geen gratis "stukje updaten": onder water wordt het **read current → merge body → schrijf een nieuwe vólledige snapshot-rij**. PATCH is dus suiker bovenop read-merge-write, plus je moet merge-semantiek vastleggen (deep/shallow, hoe verwijder je een veld, hoe ga je met arrays om). Zinnig als MMB later 3D wil toevoegen zónder de hele spec te hoeven regenereren — dan is PATCH het juiste REST-gereedschap en bouw ik het.

**Mijn advies:** Optie 1. Het houdt "elke schrijf = volledige versie" intact (dat is juist wat de historie zuiver houdt), en het kost geen endpoint — alleen een afspraak/pipeline-fix aan de MMB-kant: publiceer de board-spec in één POST met het 3D-blok erin, geen kale nabrander. (En mijn eerdere "sticky merge bij ingest" laat ik vallen — dat zou POST stiekem als PATCH laten werken, en dat is precies het soort magie dat "POST = hele waarheid" ondermijnt. Jouw expliciete PATCH-instinct is beter.)

Zal ik dit als antwoord terugschrijven naar de MMB-chat in [docs/mmb-request-3d-tab.md](docs/mmb-request-3d-tab.md) — inclusief de matrix-fix die nu live is en de "publiceer in één POST"-afspraak?

---

## 👤 Gebruiker (5)

ja, wil je dat doen? Ook even uitleggen waarom het fout ging, maar dat staat er msischein al wel

**🤖 Claude:**

Ja. Ik schrijf een antwoord-sectie terug in de doc — met de root-cause-uitleg, de matrix-fix die nu live is, antwoord op hun twee open vragen, en de "één POST"-afspraak.
> 🔧 `Read` — d:\Git\Web\Imprint-engine\docs\mmb-request-3d-tab.md
> 🔧 `Edit` — d:\Git\Web\Imprint-engine\docs\mmb-request-3d-tab.md

**🤖 Claude:**

Gedaan. De antwoord-sectie staat in [docs/mmb-request-3d-tab.md](docs/mmb-request-3d-tab.md#L116).

Over je "staat er misschien al wel": de doc **speculeerde** eerder alleen ("ingest stript nog", "live draait een andere build") — de echte oorzaak stond er níét. Die is nu toegevoegd met bewijs uit de DB-historie: geen strip-bug, maar een **kale publish om 15:34 die de 3D-velden overschreef**. Dat corrigeert meteen de verkeerde aanname dat live een oude build draaide (de "Unknown content type" kwam gewoon van het enkelvoud-GET-pad).

Wat er nu in staat:
- **Root cause** met de tijdlijn-tabel (15:31 `model3d` → 15:33 `view3d` → 15:34 kaal = CURRENT).
- **Matrix is gefixt** op localhost (view3d opnieuw gepost).
- **De afspraak**: publiceer in één POST met het 3D-blok erin, geen kale nabrander — plus het aanbod om een echte PATCH te bouwen als ze 3D later los willen toevoegen.
- **Hun twee open vragen** beantwoord (ja, ingest accepteert het; busboard = `view3d.src` statisch + versioned `model3d`).
- **Verificatie via het meervoud-endpoint**, met de enkelvoud/meervoud-val expliciet benoemd.

Twee kanttekeningen:
- Ik heb **geen CHANGELOG-regel** gezet: er is geen codewijziging: alleen een content-re-post (data) en een doc-antwoord. Zeg maar als je toch een regel wilt.
- De fix is **localhost-only**; live wacht op jouw go (en op MMB die met de "één POST"-afspraak opnieuw post). De doc-wijziging staat nog uncommitted — wil je 'm meenemen in een commit?


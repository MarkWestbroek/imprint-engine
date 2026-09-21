# Deploy op de VPS

Imprint draait op **vps1.paratmos.nl** (mijn.host, Ubuntu, Docker, Caddy op de
host), naast Omnium. Hoe die machine zelf is ingericht — gebruiker, firewall,
Caddy, backups naar de NAS — staat in het Bitemporal-repo:
`bitemp_register_v06/docs/VPS_DEPLOYMENT.md`. Dit document gaat alleen over
wat Imprint daar bovenop zet. Alles wat je nodig hebt staat in
[deploy/vps/](../deploy/vps/) en de [Dockerfile](../Dockerfile) in de root.

De Plesk-deploy (README §"Deploy naar Plesk") is sinds 1 september 2026
historie: de shared hosting heeft Node.js uitgezet.

**Stand (19 september 2026):** beide sites draaien op de VPS (`/srv/imprint`,
`SITES="musicbrain imprint"`):

- **https://musicbrain.nl** (+ `www`) — sinds 19 september weer online, na
  de verhuizing hieronder. DNS bij Quickhost; `editor.musicbrain.nl` staat daar
  nog (statisch).
- **https://imprint-engine.nl** (+ `www`) — DNS bij mijn.host.
  `imprint.musicbrain.nl` (het tijdelijke adres) stuurt door.

## Het model: git levert de bron, containers draaien hem

```mermaid
flowchart LR
    DEV["dev-machine"] -- "git push (+ tag)" --> GH["GitHub"]
    subgraph vps["VPS — /srv/imprint (git-checkout)"]
        DEPLOY["deploy/vps/deploy.sh"]
        TOOLS["tools-image<br/>migrate · seed · user"]
        MB["musicbrain<br/>127.0.0.1:3000"]
        IM["imprint<br/>127.0.0.1:3100"]
        PG[("Postgres 17<br/>db musicbrain · db imprint<br/>127.0.0.1:5434")]
        VOL[("volumes<br/>assets per site")]
        CADDY["Caddy (host)<br/>TLS, :443"]
    end
    GH -- "git pull / checkout tag" --> DEPLOY
    DEPLOY --> TOOLS --> PG
    DEPLOY -- "docker build<br/>(SSG leest de database)" --> MB & IM
    MB & IM --> PG
    MB & IM --> VOL
    CADDY --> MB & IM
```

| Wat | Waar | Verandert bij |
|---|---|---|
| Engine, widgets, site-code, CSS | de image (één per site) | een deploy |
| Content, layouts, users, historie | Postgres, één database per site | een admin-save |
| Uploads (AssetStore) | named volume per site, `/data/assets` | een upload |
| Secrets | `deploy/vps/.env` op de VPS | met de hand |

**Waarom geen "kern als container, widgets en CSS als losse bestanden"?** De
compositie van een imprint is buildtime: viewers zijn React server components
die via `transpilePackages` worden meegecompileerd, de catalogus wordt
geïmporteerd (niet dynamisch geladen) en Tailwind genereert de CSS uit de
`@source`-paden. Er valt tijdens het draaien niets in te mounten. De scheiding
die wél bestaat is die uit de tabel: code in de image, content in de database.

**Waarom bouwen op de VPS en niet in CI?** Publieke pagina's zijn SSG; `next
build` leest de ContentStore. Een build zonder database valt terug op
`sites/<site>/content` en bakt dan verouderde pagina's in, die pas verversen
bij een admin-save. De build krijgt daarom de database mee: als
BuildKit-secret (komt niet in de image of de history) en via `network: host`
naar de loopback-poort van Postgres. Een secret telt niet mee in de
build-cache, en de content in de database al helemaal niet; `deploy.sh` geeft
daarom een `BUILD_ID` mee dat een verse build afdwingt.

**Eén Postgres, per site een database en een rol** (`pg-init.sh`): de ene site
kan de andere niet lezen. MariaDB blijft een geteste backend
(`npm run test:db`), maar draait niet in productie.

**Eigen Postgres, bewust niet die van Omnium** (besluit Mark, 19 september
2026). Delen scheelt vrijwel niets (de Imprint-Postgres gebruikt ±30 MB), en
kost wel: Omnium draait Postgres 16, Imprint is ontwikkeld en getest op 17; een
upgrade of een `down` van de Omnium-stack (ander repo, andere releases) zou
Imprint meenemen; en Imprint zou het netwerk en het superuser-wachtwoord van
Omnium moeten kennen. Omnium zelf houdt OpenFTV om dezelfde reden op een eigen
Postgres. Eén instantie per project, per site een database daarbinnen.

## Eerste keer

Vereist: SSH-toegang tot de VPS en Docker + Caddy zoals in het
Omnium-runbook. `vps1` in de opdrachten hieronder is de alias uit
`~/.ssh/config` (Bitemporal-handover §4.1): gebruiker `omnium`, en het
**IP-adres** 62.129.142.42 — het A-record van `vps1.paratmos.nl` wijst nog
naar de oude webhosting. Wachtwoordlogin staat uit; alleen sleutels werken.

```bash
# op de VPS
sudo mkdir -p /srv/imprint /srv/imprint-backups && sudo chown "$USER": /srv/imprint /srv/imprint-backups
git clone https://github.com/MarkWestbroek/imprint-engine.git /srv/imprint
cd /srv/imprint/deploy/vps
cp .env.example .env && chmod 600 .env     # invullen: openssl rand -hex 24 per geheim

# De Imprint-site eerst: draait al op Postgres, niets te migreren.
docker compose build tools
./deploy.sh migrate imprint                        # start postgres, maakt het schema
./deploy.sh seed imprint --only=site,page,user     # content/ + eerste admin
SITES=imprint ./deploy.sh                          # bouwt (SSG leest de database) en start
curl -I http://127.0.0.1:3100/
```

Eerst seeden, dan bouwen: de seed leegt de Next-cache niet (backlog §6), dus
na een latere seed is opnieuw `./deploy.sh` nodig. Haal `SEED_ADMIN_PASSWORD`
na de eerste seed weer uit `.env`.

Dan Caddy: neem het blok uit [Caddyfile.snippet](../deploy/vps/Caddyfile.snippet)
over in `/etc/caddy/Caddyfile` en `sudo systemctl reload caddy` — **pas als
het A-record naar de VPS wijst**, anders blijft Caddy vergeefs een certificaat
aanvragen. Geen AAAA-record naar een parkeeradres laten staan.

## Bijwerken

```bash
cd /srv/imprint/deploy/vps
./deploy.sh                 # alle sites, git pull op de huidige branch
./deploy.sh v0.11.0         # alle sites, op die tag
SITES=musicbrain ./deploy.sh
```

Per site: migreren → bouwen → herstarten, sites na elkaar (twee gelijktijdige
`next build`-runs lopen uit het geheugen). Faalt de build, dan blijft de
draaiende container op de vorige image staan. **Terugdraaien** = dezelfde
opdracht met de vorige tag.

Gebruikersbeheer: `./deploy.sh user musicbrain passwd mark` (= `npm run user`).

## MusicBrain verhuizen (MariaDB → Postgres)

> **Gedaan op 19 september 2026.** Live (dump van Quickhost) en lokaal bleken
> niet gelijk: lokaal had de opgeschoonde componentnamen, het nieuwere
> board-spec-formaat, vier pagina's, de deepdive-wiki en álle assets; live had
> een handvol admin-bewerkingen (menu, wiki `help` → members, planbord
> `cortex` + 4 kaarten, release `modular-mb-v0.2`) en 38 asset-verwijzingen
> met hash-namen die alleen op Quickhost stonden. Gekozen: **lokaal als basis**,
> de acht live-onderdelen er als nieuwe versies bovenop (`putItem`, `by:
> migratie-live`), `mark` met de live-wachtwoordhash, testaccounts weg. Dat
> resultaat (441 rijen, 1 user) is met `db:copy-to-pg` via de tunnel gekopieerd;
> de assets uit `sites/musicbrain/.assets` (389 bestanden) staan in het volume.
> `npm run smoke https://musicbrain.nl` groen. De stappen hieronder blijven als
> recept voor een volgende site.

MusicBrain draaide op MariaDB. De data gaat over met
`npm run db:copy-to-pg` ([copy-mariadb-to-pg.ts](../scripts/copy-mariadb-to-pg.ts)):
`content_items` en `users` rij voor rij, met id's, de hele bitemporale
historie en de wachtwoordhashes, in één transactie, met een controle rij voor
rij achteraf. Lokaal bewezen: 433 rijen en 3 users, en via de stores gelezen
(actuele content, versiegeschiedenis per item, publieke reads op vijf
momenten in juli) geven MariaDB en de kopie dezelfde antwoorden.

**Bron.** Vergelijk eerst de productiedump met je lokale database — beide
kregen content via de ingest, maar hebben elk een eigen historie en kunnen
uiteenlopen (bij MusicBrain deden ze dat, zie hierboven). Vergelijk de
*actuele* rijen per `(type, slug, lang)` met `JSON_EQUALS`, niet de rijen zelf.
De productiedump is het zekerst voor de **users**: wachtwoorden die live zijn
gezet, staan niet lokaal. Laad die dump desgewenst in de lokale container als aparte database
(`musicbrain_live`) en gebruik die als `--from`.

**Tijden.** De store schrijft `datetime` via drizzle, en drizzle zet altijd UTC
in de kolom — ongeacht de tijdzone van de server. Het script leest daarom als
UTC (`--tz` bestaat voor het geval dat ooit niet zo blijkt). Let op: de
`.jsonl`-bestanden van `npm run backup` bevatten verschoven tijden (backlog §6)
en zijn géén bron voor deze kopie.

1. Op de VPS het schema aanmaken: `./deploy.sh migrate musicbrain`.
2. Vanaf je eigen machine een tunnel naar de Postgres van de VPS:
   `ssh -N -L 5435:127.0.0.1:5434 vps1`
3. Lokaal, in een tweede terminal (wachtwoord = `MUSICBRAIN_DB_PASSWORD` uit
   de `.env` op de VPS):
   ```bash
   npm run db:copy-to-pg --      --from=mysql://imprint:imprint-dev@localhost:3306/musicbrain      --to=postgres://musicbrain:<wachtwoord>@localhost:5435/musicbrain --dry-run
   # ziet het er goed uit (aantallen, steekproef): nogmaals zonder --dry-run
   ```
   Het doel moet leeg zijn; `--replace` leegt het eerst (bijv. om later
   opnieuw te kopiëren vanuit de Quickhost-dump).
4. Assets naar het volume: lokaal `sites/musicbrain/.assets` (±80 MB) of de
   asset-map uit de Quickhost-export.
   ```bash
   tar czf assets.tgz -C sites/musicbrain/.assets . && scp assets.tgz vps1:/srv/imprint/
   # op de VPS:
   docker run --rm -v imprint_musicbrain_assets:/data -v /srv/imprint:/in alpine      sh -c 'tar xzf /in/assets.tgz -C /data && chown -R 1000:1000 /data'
   ```
5. `MUSICBRAIN_SESSION_SECRET`, `_INGEST_TOKEN` en `_GITHUB_WEBHOOK_SECRET`
   uit de Plesk-omgeving (of je lokale `sites/musicbrain/.env.local`)
   overnemen in `.env`; `SITES=musicbrain imprint`.
6. `SITES=musicbrain ./deploy.sh` en controleren vóór de DNS om gaat:
   `ssh -N -L 3000:127.0.0.1:3000 vps1` en dan http://localhost:3000 (ook `/admin`).
7. Caddy-blok aanzetten, bij Quickhost het A-record van `musicbrain.nl` en
   `www` naar de VPS zetten (`editor.musicbrain.nl` blijft voorlopig bij
   Quickhost, dat is statisch en werkt nog), `npm run smoke` tegen de
   live-URL. Daarna de Plesk-webhook op GitHub verwijderen.

## Backups

[backup.sh](../deploy/vps/backup.sh): per site een `pg_dump -Fc` en een tar
van het asset-volume, plus `env.txt` (de secrets, `chmod 600`) en een
manifest, naar `/srv/imprint-backups/<datum>/`; 3 dagen bewaard. **Ook de twee
andere sites op de machine** (volksgebouwzeist.nl, psycholog.pi-utrecht.nl):
die hebben geen database, maar hun docker-volume (uploads, users.json,
evenementen) en hun `.env` staan nergens anders. Dat loopt via de regel `EXTRA`
bovenin het script — een site erbij is daar één vermelding
(`<volume>:<pad naar .env>`). Terugzet-
opdracht staat bovenin het script. `npm run backup` en `npm run assets:gc`
zijn nog MariaDB-only.

- **Cron** (sinds 19 september 2026, gebruiker `omnium`), een kwartier na
  Omnium: `15 3 * * * /srv/imprint/deploy/vps/backup.sh >>
  /srv/imprint-backups/backup.log 2>&1` — cron rekent in UTC, dus 05:15
  zomertijd. Eerste run met de hand gecontroleerd (dumps leesbaar met
  `pg_restore -l`, assets compleet).
- **Buiten de VPS**: de NAS haalt de map op, zoals bij Omnium
  (Bitemporal-runbook §8): TrueNAS → *Data Protection* → *Rsync Tasks* →
  **Pull**, host `62.129.142.42`, user `omnium`, remote path
  `/srv/imprint-backups/`, dagelijks 06:00, *Delete* uit. Zelfde SSH-sleutel
  van de NAS als voor Omnium. **Nog niet ingesteld** (de NAS stond uit).
  Tussendoor vanaf een eigen machine: `scp -r vps1:/srv/imprint-backups/<datum> …`
  (buiten gesynchroniseerde mappen — `env.txt` bevat de secrets).

## Een site erbij

1. `sites/<naam>/` met `next.config.ts` zoals de andere twee (`output` via
   `NEXT_OUTPUT`, `outputFileTracingRoot`) en `assets` uit de omgeving in
   `imprint.config.ts`; de `package.json` erbij in de [Dockerfile](../Dockerfile)
   (de `COPY`-regels vóór `npm ci`).
2. Service in [compose.yml](../deploy/vps/compose.yml) (kopie van `imprint`,
   eigen loopback-poort en volume), `<NAAM>_DB_PASSWORD` en
   `<NAAM>_SESSION_SECRET` in `.env`.
3. Database + rol met de hand (het init-script draait alleen op een lege
   datamap) — de opdracht staat bovenin [pg-init.sh](../deploy/vps/pg-init.sh).
4. Caddy-blok, DNS, `SITES=<naam> ./deploy.sh`.

## Valkuilen

- **`.env`-wachtwoorden in hex**: ze komen in een `postgres://`-URL.
- **Shell-scripts zijn LF** (`.gitattributes`); een CRLF-shebang start niet.
- **Build leest de database via loopback**, niet via de servicenaam
  `postgres`: tijdens een build bestaat het compose-netwerk niet.
- **Docker zet `HOSTNAME` op de container-id** en de standalone-server bindt
  daarop; de image zet daarom `HOSTNAME=0.0.0.0`.
- **Geheugen**: `next build` is het zwaarste wat deze machine doet (op Plesk
  gaf een dubbele build een OOM). Is de VPS krap, zet dan swap aan vóór de
  eerste build; het geheugengebruik op de VPS zelf is nog niet gemeten.

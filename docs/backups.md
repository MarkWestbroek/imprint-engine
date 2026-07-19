# Backups (DB + assets)

`npm run backup` maakt een complete backup: de volledige bitemporale
content-historie, de gebruikers (incl. wachtwoordhashes) en de asset-bestanden.
Node-only — geen mysqldump of shell-toegang nodig, dus hij draait ook op Plesk.

## Wat er in een backup zit

```
backups/2026-07-19T03-00-00/
  content_items.jsonl   # elke rij, hele historie (JSON per regel)
  users.jsonl           # accounts + scrypt-hashes
  assets.tgz            # de AssetStore-map (ASSET_ROOT)
  manifest.json         # aantallen + tijdstip
```

Retentie: de nieuwste **14** blijven staan (`--keep=<n>` om af te wijken);
`--dest=<map>` of `BACKUP_DIR` kiest de doelmap (default `backups/` in de
repo-root, staat in .gitignore).

## Op Plesk (geen SSH): Scheduled Task

Zelfde patroon als de deploy-taak — dagelijks, bijv. 03:00:

```
cd imprint && export PATH="/opt/plesk/node/21/bin:$PATH" && npm run backup
```

Zet **Notify: Errors only** (anders elke dag mail). Belangrijk: `backups/`
staat dan op dezelfde server — download er af en toe één (Plesk File Manager)
of zet `BACKUP_DIR` naar een map die in Plesk's eigen server-backup meegaat.
Een backup die alleen naast de database woont beschermt niet tegen een
kapotte schijf.

## Terugzetten

1. Assets: `assets.tgz` uitpakken naar `ASSET_ROOT`.
2. Database: lege tabellen (of een verse database + `npm run db:migrate`),
   daarna per JSONL-bestand de rijen weer inserten. Een restore-script is er
   bewust (nog) niet — terugzetten is een handmatige, bewuste actie. De
   JSONL-kolommen komen 1-op-1 overeen met de tabelkolommen; met een paar
   regels Node (mysql2, `INSERT INTO … SET ?` per regel) staat alles terug.
3. Controleer met `manifest.json` (aantallen) en `npm run smoke -- <url>`.

Let op: **niet** terugzetten via de write-API of `putItem` — die maken nieuwe
bitemporale versies en de historie klopt dan niet meer. Een restore hoort de
rijen letterlijk terug te zetten, tijdstempels incluis.

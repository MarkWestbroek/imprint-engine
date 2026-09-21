#!/usr/bin/env bash
# backup.sh — nachtelijke backup van alle imprints: per site een pg_dump (de
# hele bitemporale historie + users) en een tar van het asset-volume.
#
# Zelfde opzet als /srv/omnium/backup.sh: schrijft naar $BACKUP_DIR/<datum>/,
# bewaart de laatste $KEEP dagen, en de NAS haalt de map op (rsync-pull over
# SSH) — de VPS opent zelf geen verbinding naar huis. `npm run backup` is
# MariaDB-only en hoort bij de Plesk-tijd; op Postgres is dit de backup.
#
# Cron:  15 3 * * *  /srv/imprint/deploy/vps/backup.sh >> /srv/imprint-backups/backup.log 2>&1
#
# Terugzetten (één site):
#   docker compose exec -T postgres pg_restore -U postgres --clean --if-exists \
#     -d musicbrain < musicbrain.dump
set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR="${BACKUP_DIR:-/srv/imprint-backups}"
KEEP="${KEEP:-3}"
sites_arg="${SITES:-}"
set -a; . ./.env; set +a
SITES="${sites_arg:-${SITES:-musicbrain imprint}}"

stamp="$(date +%Y-%m-%dT%H-%M-%S)"
dest="$BACKUP_DIR/$stamp"
mkdir -p "$dest"

for site in $SITES; do
  echo "[$stamp] $site: database → $dest/$site.dump"
  docker compose exec -T postgres pg_dump -U postgres -d "$site" -Fc > "$dest/$site.dump"
  echo "[$stamp] $site: assets → $dest/$site-assets.tgz"
  docker run --rm --user "$(id -u):$(id -g)" \
    -v "imprint_${site}_assets":/data:ro -v "$dest":/out \
    alpine:3.21 tar czf "/out/$site-assets.tgz" -C /data .
done

# De twee andere sites op deze machine (volksgebouwzeist.nl,
# psycholog.pi-utrecht.nl) hebben hun eigen stack en géén database: hun data is
# één docker-volume (uploads, users.json, evenementen) plus hun .env. Dat staat
# nergens anders, dus het hoort hier mee. Nieuwe site erbij = een regel in
# EXTRA (naam van het volume, en waar zijn .env staat).
EXTRA="${EXTRA:-volksgebouw_data:/srv/volksgebouw/deploy/vps/.env psycholog_data:/srv/psycholog/deploy/vps/.env}"
for pair in $EXTRA; do
  vol="${pair%%:*}"; envfile="${pair#*:}"; name="${vol%_data}"
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    echo "[$stamp] $name: volume → $dest/$name-data.tgz"
    docker run --rm --user "$(id -u):$(id -g)"       -v "$vol":/data:ro -v "$dest":/out       alpine:3.21 tar czf "/out/$name-data.tgz" -C /data .
  else
    echo "[$stamp] $name: volume $vol bestaat niet — overgeslagen"
  fi
  [ -f "$envfile" ] && install -m 600 "$envfile" "$dest/$name-env.txt"
done

cp .env "$dest/env.txt"   # de secrets horen bij de data; de NAS is een vertrouwde plek
( cd "$dest" && stat -c '%n=%s' ./*.dump ./*.tgz 2>/dev/null ) > "$dest/manifest.txt"

# Retentie: alleen de nieuwste $KEEP mappen bewaren.
ls -1d "$BACKUP_DIR"/20* 2>/dev/null | sort | head -n -"$KEEP" | xargs -r rm -rf
echo "[$stamp] klaar"

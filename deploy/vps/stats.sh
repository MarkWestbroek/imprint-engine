#!/usr/bin/env bash
# stats.sh — het bezoekrapport per site uit het toegangslog van Caddy (GoAccess).
# Draait elk uur uit cron (docs/deploy-vps.md, "Bezoekstatistiek"). Geen script
# in de pagina, geen cookies; Caddy kort IP-adressen al in (Caddyfile.snippet)
# en GoAccess anonimiseert ze nog eens. Crawlers en bots blijven buiten het
# rapport. De historie blijft bewaard in een GoAccess-database per site, ook
# als Caddy zijn logbestanden roteert.
#
#   ./stats.sh                 alle sites met een log
#   ./stats.sh commonground    één site
set -euo pipefail

LOGS=/var/log/caddy
OUT=/srv/imprint-stats
SITES="${*:-musicbrain imprint commonground}"

command -v goaccess >/dev/null || { echo "goaccess ontbreekt (sudo apt install goaccess)" >&2; exit 1; }

for site in $SITES; do
  log="$LOGS/$site.log"
  [ -r "$log" ] || { echo "── $site: geen log ($log)"; continue; }
  dir="$OUT/$site"
  mkdir -p "$dir/db"
  # Ook de geroteerde logs van de afgelopen dagen lezen, de database ontdubbelt.
  shopt -s nullglob
  logs=("$log" "$LOGS/$site"-*.log)
  goaccess "${logs[@]}" \
    --log-format=CADDY \
    --persist --restore --db-path="$dir/db" \
    --anonymize-ip --ignore-crawlers \
    --ignore-panel=HOSTS --ignore-panel=GEO_LOCATION \
    --html-report-title="$(TZ=Europe/Amsterdam date '+%Y-%m-%d %Hu%M') Bezoek $site" \
    --tz=Europe/Amsterdam \
    --no-progress \
    -o "$dir/index.new.html" 2>/dev/null
  mv "$dir/index.new.html" "$dir/index.html"
  echo "── $site: $(date -u +%FT%TZ)"
done

#!/usr/bin/env bash
# deploy.sh — Imprint op de VPS bijwerken. Draait vanuit de git-checkout op de
# VPS (/srv/imprint/deploy/vps); git levert de bron, de containers draaien hem.
#
#   ./deploy.sh                      alle sites, huidige branch (git pull)
#   ./deploy.sh v0.11.0              alle sites, op die tag
#   SITES=imprint ./deploy.sh        alleen de genoemde site(s)
#   ./deploy.sh migrate imprint      alleen het schema bijwerken (eerste keer, vóór de seed)
#   ./deploy.sh seed imprint --only=site,page,user
#                                    eenmalig: content/ + eerste admin → database
#                                    (de Imprint-site heeft geen catalogus/planning:
#                                    altijd met --only, zie sites/imprint/README.md)
#   ./deploy.sh user imprint <args>  npm run user (gebruikersbeheer) voor die site
#
# Volgorde per deploy: postgres up → tools-image → per site: migreren, bouwen
# (SSG leest de database), herstarten. Sites na elkaar, nooit tegelijk: twee
# gelijktijdige `next build`-runs lopen uit het geheugen.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "deploy/vps/.env ontbreekt — kopieer .env.example" >&2; exit 1; }
sites_arg="${SITES:-}"            # SITES=… op de opdrachtregel wint van .env
set -a; . ./.env; set +a
SITES="${sites_arg:-${SITES:-musicbrain imprint}}"

dc() { docker compose "$@"; }

# Database-URL van een site: `postgres` is de servicenaam (runtime, tools),
# 127.0.0.1 de loopback-poort (build met network: host).
db_password() { local v="$(echo "$1" | tr '[:lower:]' '[:upper:]')_DB_PASSWORD"; echo "${!v:?$v ontbreekt in .env}"; }
db_url()      { echo "postgres://$1:$(db_password "$1")@${2:-postgres:5432}/$1"; }

tools() { # tools <site> <commando…>
  local site="$1"; shift
  dc run --rm -e DATABASE_URL="$(db_url "$site")" \
    -e SEED_ADMIN_USER="${SEED_ADMIN_USER:-}" -e SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-}" \
    tools "$@"
}

case "${1:-}" in
  migrate)
    site="${2:?gebruik: deploy.sh migrate <site>}"
    dc up -d --wait postgres
    tools "$site" npm run db:migrate:pg
    exit 0 ;;
  seed)
    site="${2:?gebruik: deploy.sh seed <site> [--only=…]}"; shift 2
    tools "$site" npm run db:seed -- --site="$site" "$@"
    echo "Geseed. Bouw nu (SITES=$site ./deploy.sh): de seed leegt de Next-cache niet."
    exit 0 ;;
  user)
    site="${2:?gebruik: deploy.sh user <site> <args>}"; shift 2
    tools "$site" npm run user -- "$@"
    exit 0 ;;
esac

ref="${1:-}"
git fetch --tags --prune
if [ -n "$ref" ]; then git checkout --detach "$ref"; else git pull --ff-only; fi
echo "── bron: $(git describe --tags --always)"

dc up -d --wait postgres
dc build tools

for site in $SITES; do
  echo "── $site: migreren"
  tools "$site" npm run db:migrate:pg
  echo "── $site: bouwen"
  BUILD_ID="$(date +%s)" BUILD_DATABASE_URL="$(db_url "$site" "127.0.0.1:${PG_PORT:-5434}")" dc build "$site"
  echo "── $site: herstarten"
  dc up -d --wait "$site"
done

docker image prune -f >/dev/null
dc ps

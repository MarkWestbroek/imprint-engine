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
#   ./deploy.sh import-pleio commonground [--base-url=https://…]
#                                    publieke pagina's, menu en footer uit Pleio (GraphQL)
#                                    → database; daarna bouwen (SITES=commonground ./deploy.sh)
#   ./deploy.sh import-pleio-files commonground [--dry-run] [--limit=N]
#                                    de bestanden en beelden waar de inhoud naar linkt → bibliotheek,
#                                    links → asset:; daarna bouwen (SITES=commonground ./deploy.sh)
#   ./deploy.sh digest commonground  de dagelijkse mededelingen-mail versturen (cron;
#                                    POST /api/digest met <SITE>_INGEST_TOKEN; --dry telt alleen)
#   ./deploy.sh s3-setup musicbrain  bucket + gebruiker in de eigen MinIO (eenmalig;
#                                    <SITE>_S3_SECRET_KEY en MINIO_ROOT_PASSWORD eerst in .env)
#   ./deploy.sh s3-move musicbrain [--apply]
#                                    bestanden van het volume naar de bucket
#                                    (droog tenzij --apply; herhaalbaar)
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
  import-pleio)
    site="${2:?gebruik: deploy.sh import-pleio <site> [--base-url=…]}"; shift 2
    tools "$site" npm run import:pleio --workspace="$site" -- "$@"
    echo "Geïmporteerd. Bouw nu (SITES=$site ./deploy.sh)."
    exit 0 ;;
  import-pleio-files)
    site="${2:?gebruik: deploy.sh import-pleio-files <site> [--dry-run] [--limit=N]}"; shift 2
    # Als de gebruiker van de site (node) en op het volume van de site: wat hier landt moet zij kunnen lezen én aanvullen.
    dc run --rm --user node -e DATABASE_URL="$(db_url "$site")" \
      -v "imprint_${site}_assets:/data/assets" -e ASSET_ROOT=/data/assets \
      tools npm run import:pleio-files --workspace="$site" -- "$@"
    echo "Klaar. Bouw nu (SITES=$site ./deploy.sh)."
    exit 0 ;;
  digest)
    site="${2:?gebruik: deploy.sh digest <site> [--dry]}"
    SITE="$(echo "$site" | tr '[:lower:]' '[:upper:]')"
    token_var="${SITE}_INGEST_TOKEN"
    token="${!token_var:?$token_var ontbreekt in .env (bv. openssl rand -base64 24)}"
    query=""; [ "${3:-}" = "--dry" ] && query="?dry=1"
    # De poort van de draaiende container (compose kent hem; .env hoeft hem niet te noemen).
    addr="$(dc port "$site" 3000)"; [ -n "$addr" ] || { echo "$site draait niet" >&2; exit 1; }
    # De site zelf verstuurt (zij heeft de SMTP-instellingen); dit is alleen de wekker.
    curl -fsS --max-time 120 -X POST -H "Authorization: Bearer $token" "http://$addr/api/digest$query"
    echo
    exit 0 ;;
  s3-setup)
    site="${2:?gebruik: deploy.sh s3-setup <site>}"
    SITE="$(echo "$site" | tr '[:lower:]' '[:upper:]')"
    bucket_var="${SITE}_S3_BUCKET"; key_var="${SITE}_S3_ACCESS_KEY"; secret_var="${SITE}_S3_SECRET_KEY"
    bucket="${!bucket_var:-imprint-$site}"; key="${!key_var:-imprint-$site}"
    secret="${!secret_var:?$secret_var ontbreekt in .env (bv. openssl rand -base64 24)}"
    : "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD ontbreekt in .env}"
    dc up -d --wait minio
    policy='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetBucketLocation","s3:ListBucket"],"Resource":["arn:aws:s3:::'"$bucket"'"]},{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::'"$bucket"'/*"]}]}'
    # Het geheim gaat via de omgeving de container in, niet via de opdrachtregel.
    dc exec -T -e BUCKET="$bucket" -e KEY="$key" -e SECRET="$secret" -e POLICY="$policy" minio sh -c '
      set -e
      mc alias set loc http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
      mc mb --ignore-existing "loc/$BUCKET" >/dev/null
      printf "%s" "$POLICY" > /tmp/policy.json
      mc admin policy create loc "$BUCKET-rw" /tmp/policy.json >/dev/null
      rm -f /tmp/policy.json
      mc admin user add loc "$KEY" "$SECRET" >/dev/null
      mc admin policy attach loc "$BUCKET-rw" --user "$KEY" >/dev/null 2>&1 || true
      echo "bucket $BUCKET: gebruiker $KEY, policy $BUCKET-rw"'
    exit 0 ;;
  s3-move)
    site="${2:?gebruik: deploy.sh s3-move <site> [--apply]}"; shift 2
    SITE="$(echo "$site" | tr '[:lower:]' '[:upper:]')"
    bucket_var="${SITE}_S3_BUCKET"; key_var="${SITE}_S3_ACCESS_KEY"; secret_var="${SITE}_S3_SECRET_KEY"
    dc up -d --wait minio
    dc run --rm -v "imprint_${site}_assets:/data/assets:ro" \
      -e ASSET_ROOT=/data/assets -e ASSET_S3_ENDPOINT=http://minio:9000 \
      -e ASSET_S3_BUCKET="${!bucket_var:-imprint-$site}" -e ASSET_S3_ACCESS_KEY="${!key_var:-imprint-$site}" \
      -e ASSET_S3_SECRET_KEY="${!secret_var:?$secret_var ontbreekt in .env}" \
      tools npm run assets:to-s3 -- "$@"
    exit 0 ;;
esac

ref="${1:-}"
git fetch --tags --prune
if [ -n "$ref" ]; then git checkout --detach "$ref"; else git pull --ff-only; fi
echo "── bron: $(git describe --tags --always)"

dc up -d --wait postgres
# De eigen MinIO alleen als een site er zijn bestanden in heeft.
if [ -n "${MUSICBRAIN_S3_ENDPOINT:-}${IMPRINT_S3_ENDPOINT:-}" ]; then dc up -d --wait minio; fi
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

#!/bin/sh
# Draait eenmalig, bij de eerste start van een lege Postgres-datamap: per
# imprint een eigen rol + database, zodat de ene site de andere niet kan lezen.
#
# Later een site erbij (het volume bestaat dan al, dit script draait niet meer):
#   docker compose exec postgres psql -U postgres \
#     -c "CREATE ROLE nieuwesite LOGIN PASSWORD '…'" \
#     -c "CREATE DATABASE nieuwesite OWNER nieuwesite"
set -eu

create() {
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -v name="$1" -v pw="$2" <<'SQL'
CREATE ROLE :"name" LOGIN PASSWORD :'pw';
CREATE DATABASE :"name" OWNER :"name";
SQL
  echo "database $1 aangemaakt"
}

create musicbrain "$MUSICBRAIN_DB_PASSWORD"
create imprint "$IMPRINT_DB_PASSWORD"

#!/bin/sh
set -eu

database_dir=/opt/aulaflow/database

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --file "$database_dir/schema.sql"

for migration in "$database_dir"/migrations/*.sql; do
  [ -f "$migration" ] || continue
  psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --file "$migration"
done

if [ "${AULAFLOW_LOAD_DEMO_DATA:-false}" = "true" ]; then
  psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --file "$database_dir/seed.sql"
fi


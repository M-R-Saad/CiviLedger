#!/bin/sh
set -e

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] waiting for Postgres at ${DB_HOST}:${DB_PORT}"
until nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 1
done
echo "[entrypoint] Postgres is up"

# Wait for the contract-deploy step to publish addresses to the shared volume.
if [ -n "$DEPLOYMENTS_FILE" ] && [ "${WAIT_FOR_CHAIN:-true}" = "true" ]; then
  echo "[entrypoint] waiting for $DEPLOYMENTS_FILE"
  i=0
  until [ -f "$DEPLOYMENTS_FILE" ]; do
    i=$((i + 1))
    if [ "$i" -gt 180 ]; then
      echo "[entrypoint] gave up waiting for contract deployment file; starting anyway"
      break
    fi
    sleep 1
  done
fi

if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
  echo "[entrypoint] running migrations"
  npm run migrate
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] seeding (already-applied seeders are skipped)"
  npm run seed || echo "[entrypoint] seed step reported an error, continuing"
fi

echo "[entrypoint] starting: $*"
exec "$@"

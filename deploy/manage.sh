#!/usr/bin/env bash
# Ops shortcuts for the droplet. Run from the deploy/ directory as the deploy user.
#   ./manage.sh logs [service]   tail logs
#   ./manage.sh ps               container status
#   ./manage.sh restart [svc]    recreate service(s)
#   ./manage.sh migrate          run DB migrations now
#   ./manage.sh reseed           re-run seeders (already-applied ones are skipped)
#   ./manage.sh redeploy-chain   wipe local chain + contract addresses, redeploy
#   ./manage.sh nuke             stop everything and delete ALL data volumes
set -euo pipefail
cd "$(dirname "$0")"
C="docker compose --env-file .env.production -f docker-compose.prod.yml"

case "${1:-}" in
  logs)     shift; $C logs -f --tail=100 "$@" ;;
  ps)       $C ps ;;
  restart)  shift; $C up -d --force-recreate "$@" ;;
  migrate)  $C exec backend npm run migrate ;;
  reseed)   $C exec backend npm run seed ;;
  redeploy-chain)
    read -rp "This wipes the local chain and all on-chain state. Type YES: " ok
    [ "$ok" = "YES" ] || exit 1
    $C rm -sf chain contracts-deploy
    docker volume rm civiledger_chain_artifacts
    $C up -d --build
    ;;
  nuke)
    read -rp "This DELETES the database and all volumes. Type YES: " ok
    [ "$ok" = "YES" ] || exit 1
    $C down -v
    ;;
  *) grep '^#' "$0" | sed 's/^# \{0,1\}//' ; exit 1 ;;
esac

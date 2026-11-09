#!/usr/bin/env bash
# Stops the write test servers. With -v their databases are removed too. Takes the servers as arguments, all by default:
#   test/servers/write/down.sh [-v] [ldproxy] [pygeoapi] [qgis] [geoserver]
set -euo pipefail
cd "$(dirname "$0")"

volumes=""
servers=()
for arg in "$@"; do
  if [ "$arg" = "-v" ]; then volumes="-v"; else servers+=("$arg"); fi
done
[ ${#servers[@]} -eq 0 ] && servers=(ldproxy pygeoapi qgis geoserver)

for server in "${servers[@]}"; do
  docker compose -f "$server/docker-compose.yml" down $volumes
done

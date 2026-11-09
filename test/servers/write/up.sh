#!/usr/bin/env bash
# Starts the write test servers (npm run test:live-write), each on its own PostGIS. With --reset the databases are
# recreated from their seed first. Takes the servers to start as arguments, all four by default:
#   test/servers/write/up.sh [--reset] [ldproxy] [pygeoapi] [qgis] [geoserver]
set -euo pipefail
cd "$(dirname "$0")"

reset=false
servers=()
for arg in "$@"; do
  if [ "$arg" = "--reset" ]; then reset=true; else servers+=("$arg"); fi
done
[ ${#servers[@]} -eq 0 ] && servers=(ldproxy pygeoapi qgis geoserver)

for server in "${servers[@]}"; do
  echo "### $server"
  if $reset; then docker compose -f "$server/docker-compose.yml" down -v; fi
  docker compose -f "$server/docker-compose.yml" up -d --wait
done

# GeoServer is configured through its REST API once it answers
for server in "${servers[@]}"; do
  if [ "$server" = "geoserver" ]; then
    echo "### geoserver: waiting for the REST API"
    for _ in $(seq 1 90); do
      curl -sf -o /dev/null -u admin:geoserver http://localhost:8085/geoserver/rest/about/version.json && break
      sleep 2
    done
    if ! curl -sf -o /dev/null -u admin:geoserver http://localhost:8085/geoserver/rest/workspaces/spike.json; then
      ./geoserver/setup.sh > /dev/null 2>&1
    fi
  fi
done

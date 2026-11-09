#!/usr/bin/env bash
# Configures the write test GeoServer through its REST API (idempotent-ish: re-running prints 4xx for existing items).
set -u
GS=${GS:-http://localhost:8085/geoserver}
A="-u admin:geoserver"
J="Content-Type: application/json"
say() { echo; echo "### $*"; }
req() { curl -s -o /dev/stderr -w " -> HTTP %{http_code}\n" $A "$@"; }

say workspace spike
req -X POST -H "$J" "$GS/rest/workspaces" -d '{"workspace":{"name":"spike"}}'

say "PostGIS datastore pg (host postgis:5432 inside the compose network)"
req -X POST -H "$J" "$GS/rest/workspaces/spike/datastores" -d '{"dataStore":{"name":"pg","connectionParameters":{"entry":[
 {"@key":"dbtype","$":"postgis"},{"@key":"host","$":"postgis"},{"@key":"port","$":"5432"},
 {"@key":"database","$":"gis"},{"@key":"schema","$":"public"},{"@key":"user","$":"gis"},
 {"@key":"passwd","$":"gis"},{"@key":"Expose primary keys","$":"true"}]}}}'

for t in cities parcels; do
  say publish $t
  req -X POST -H "$J" "$GS/rest/workspaces/spike/datastores/pg/featuretypes" -d "{\"featureType\":{\"name\":\"$t\",\"nativeName\":\"$t\",\"srs\":\"EPSG:4326\"}}"
done

say roles
for r in ROLE_EDITOR ROLE_VIEWER; do req -X POST "$GS/rest/security/roles/role/$r"; done

say users
for u in editor viewer; do
  req -X POST -H "$J" "$GS/rest/security/usergroup/users" -d "{\"user\":{\"userName\":\"$u\",\"password\":\"$u\",\"enabled\":true}}"
done
req -X POST "$GS/rest/security/roles/role/ROLE_EDITOR/user/editor"
req -X POST "$GS/rest/security/roles/role/ROLE_VIEWER/user/viewer"

say data security rules
# cities : readable by everybody, writable by nobody (ROLE_NOBODY is assigned to no user; admin bypasses rules anyway)
# parcels: readable by editor+viewer only (hidden for anonymous), writable by editor only
req -X POST -H "$J" "$GS/rest/security/acl/layers" -d '{
 "spike.cities.r":"*",
 "spike.cities.w":"ROLE_NOBODY",
 "spike.parcels.r":"ROLE_EDITOR,ROLE_VIEWER",
 "spike.parcels.w":"ROLE_EDITOR"}'

say resulting rules
curl -s $A -H "Accept: application/json" "$GS/rest/security/acl/layers"; echo
curl -s $A -H "Accept: application/json" "$GS/rest/security/acl/services"; echo
curl -s $A -H "Accept: application/json" "$GS/rest/security/acl/catalog"; echo

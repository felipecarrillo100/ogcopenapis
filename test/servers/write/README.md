# Write test servers

The servers of the write tests (`npm run test:live-write`), each in Docker with its own PostGIS. They are the newest
official releases on 2026-11-09, pinned by tag and digest. The research behind them, with what each server does and
where it deviates from OGC API Features Part 4, is in `spikes/*/FINDINGS.md`.

```
test/servers/write/up.sh [--reset] [ldproxy] [pygeoapi] [qgis] [geoserver]   # all four by default
npm run test:live-write
npm run test:record-write   # records the write scenario of ldproxy and pygeoapi in test/fixtures/write
test/servers/write/down.sh [-v] [server...]
```

`--reset` recreates the databases from their seed; `down.sh -v` removes them. The tests remove the features they
create. The images are amd64 only: on Apple Silicon they run emulated, and starting all four takes about two minutes.

| Server | URL | Role | Users | Database |
|---|---|---|---|---|
| ldproxy 4.8.2 | http://localhost:7081/spike/ | writes: create, replace, update (PATCH), delete | bearer JWTs, `ldproxyToken()` in `servers.ts` | 5436 |
| pygeoapi 0.24.0, behind nginx | http://localhost:5002/ (pygeoapi itself: 5011) | writes: create, replace, delete, no PATCH | Basic `editor`/`editor` writes, `viewer`/`viewer` gets 403, anonymous 401 | 5434 |
| QGIS Server 4.2.3, behind nginx | http://localhost:8086/ogc/spike/ogcapi/ | `OPTIONS` `Allow` per user; its writes are not tested | Basic `editor`/`editor`, `viewer`/`viewer` | 5437 |
| GeoServer 3.0.2 | http://localhost:8085/geoserver/ogc/features/v1/ | read-only OGC API Features | Basic `editor`/`editor`, `viewer`/`viewer`, admin `admin`/`geoserver` | 5435 |

The users, passwords and the ldproxy signing key are for these local containers only.

- **ldproxy**: `poi` has CRUD on, without optimistic locking; `roads` has CRUD off, which ldproxy 4.8.2 does not
  enforce. A token with `write` writes every collection, `data:write::spike:poi` only `poi`, `read` none. ldproxy checks
  bearer tokens only, no Basic. Configuration in `ldproxy/ldproxy-data`.
- **pygeoapi**: `places` is editable, `roads` not. pygeoapi has no login of its own: nginx (`pygeoapi/proxy`) asks
  Basic for writes and answers CORS with credentials for `http://localhost:5173`.
- **QGIS Server**: `cities` and `towns_3857` take Insert, Update and Delete, `parcels` none. A server plugin
  (`qgis/plugins/access_control`) gives write rights to `editor` only, with the user nginx authenticated. The project
  `qgis/project/spike/spike.qgs` was made with `qgis/scripts/make_project.py`.
- **GeoServer**: configured through its REST API by `geoserver/setup.sh`, which `up.sh` runs when the workspace is
  missing. `cities` is readable by all and writable by none, `parcels` readable by `editor` and `viewer` and writable by
  `editor` (for WFS-T, its OGC API Features does not write).

# OGC API - Features write support in real server implementations (as of 2026-11-09)

Method: read source code on GitHub (default branch HEAD as of 2026-11-09, via `gh api`), official docs, and live probes of public demo endpoints (GET /conformance, GET /api, OPTIONS, one DELETE of a nonexistent id on CubeWerx). "HEAD" means unreleased code on the default branch unless a release is named.

## Q1. Per-server support matrix (POST/PUT/PATCH/DELETE, media types, ETag/If-Match, declared conformance)

### Takeaway
Of the servers in scope, only pygeoapi, ldproxy, QGIS Server and CubeWerx cubeserv accept writes on `/collections/{id}/items`. They behave very differently. pygeoapi has POST, PUT and DELETE but no PATCH. ldproxy has the fullest Part 4 support: PATCH with merge-patch, optimistic locking via `If-Unmodified-Since` (not ETag), and `Prefer`. QGIS has PATCH, but with a non-standard `{"modify": {...}}` body. CubeWerx answers with a WFS-style transaction summary. GeoServer, MapServer, deegree, GNOSIS and Esri ArcGIS OGC Features have no documented OGC API write support.

| Server (version checked) | POST items | PUT item | PATCH item | DELETE item | Write media types | Optimistic locking | Part 4 conformance URIs declared |
|---|---|---|---|---|---|---|---|
| GeoServer (main / 2.2x / 3.x) | No (POST only for `/search`) | No | No | No | n/a | n/a | none |
| pygeoapi 0.24.0 / HEAD | Yes (201 + Location) | Yes (204) | **No** | Yes (200) | `application/geo+json` only (exact match) | none | `ogcapi-features-4/1.0/conf/create-replace-delete` (static: declared even when nothing is editable) |
| ldproxy HEAD (latest release v4.8.2) | Yes (201 + Location, server-generated id) | Yes (also create with a client id) | Yes | Yes | geo+json (GeoJSON / JSON-FG), `application/gml+xml`; PATCH: `application/merge-patch+json`, `application/geo+json` | `If-Unmodified-Since` / `Last-Modified` (412 / 428); `If-Match` is always rejected with 412 | `ogcapi-common-5/1.0/conf/create-replace-delete`, `ogcapi-common-5/1.0/conf/update`, `ogcapi-features-4/1.0/conf/features` (+ optional classes) |
| QGIS Server 3.40 / 3.44 / 4.0 / master | Yes (201) | Yes | Yes (non-standard `{"modify":{...}}` body) | Yes | GeoJSON | none found | releases: none; master (Oct 2026): `ogcapi-features-4/1.0/conf/create-replace-delete` + `/update` |
| CubeWerx cubeserv 9.7.26 (demo) | Allow header says yes | Allow header says yes | not in Allow | Yes (returns 200 + `transactionSummary`) | not verified | `If-Match` allowed in CORS headers; behaviour not verified | `ogcapi-features-4/1.0/conf/create-replace-delete`, `ogcapi-features-4/1.0/conf/features` |
| MapServer 8.x | No evidence | — | — | — | — | — | none found |
| deegree ogcapi 2.0.4 | No (Parts 1, 2, partial 3 only) | — | — | — | — | — | none |
| GNOSIS Map Server (maps.gnosis.earth) | No evidence | — | — | — | — | — | none (Parts 1, 2, 3, 5 draft 0.0 only) |
| Esri ArcGIS OGC Features (11.x) | No evidence | — | — | — | — | — | none documented |
| pg_featureserv | PR #152 (open, unmerged) | — | — | — | — | — | — |

### Cited Findings

**GeoServer**
- In the GeoServer status table, OGC API - Features Part 4 "Create, Replace, Update and Delete" 1.0.0 (draft) is "Not implemented (volunteers/sponsoring wanted)". Part 1 and Part 2 pass compliance tests; Part 3 and CQL2 are implemented — [GeoServer docs, Features status (main)](https://docs.geoserver.org/main/en/user/services/features/status/)
- Source check: `src/extension/ogcapi/ogcapi-features/src/main/java/org/geoserver/ogcapi/v1/features/FeatureService.java` on main has only `@GetMapping` handlers plus one `@PostMapping(path = "collections/{collectionId}/search")`. There are no PUT, PATCH or DELETE mappings, and no POST on `/items` — [geoserver/geoserver FeatureService.java](https://github.com/geoserver/geoserver/blob/main/src/extension/ogcapi/ogcapi-features/src/main/java/org/geoserver/ogcapi/v1/features/FeatureService.java)
- GeoSolutions training material: "Currently GeoServer provides no implementation for OGCAPI - Features transaction support". It points to WFS-T as the write path — [GeoSolutions edu: Transactions on Features](https://geoserver.geosolutionsgroup.com/edu/en/ogcapi/features/transactions.html)
- The module now lives under `src/extension/ogcapi` (an extension, no longer community) in the repository tree — [geoserver/geoserver tree](https://github.com/geoserver/geoserver/tree/main/src/extension/ogcapi)

**pygeoapi** (latest release 0.24.0, 2026-07-28; [releases](https://github.com/geopython/pygeoapi/releases))
- Transactions implement "OGC API - Features - Part 4: Create, Replace, Update and Delete" (draft 20-002). They are enabled with `editable: true` on the resource provider, and the provider must support create/update/delete. An optional `validator` (for example `GeoJSON`) can be set — [pygeoapi docs: Transactions](https://docs.pygeoapi.io/en/latest/transactions.html)
- Providers with transactions = ✅ in the docs matrix: Elasticsearch, MySQL, OpenSearch, PostgreSQL, SensorThings API, TinyDB. Providers with ❌: CSV, ERDDAP, ESRI Feature Service, GeoJSON, MongoDB, OGR, Oracle, Parquet, SQLiteGPKG, Socrata — [pygeoapi docs/source/publishing/ogcapi-features.rst](https://github.com/geopython/pygeoapi/blob/master/docs/source/publishing/ogcapi-features.rst)
- Flask routes: `/collections/<id>/items` takes `GET, POST, OPTIONS`; `/collections/<id>/items/<item_id>` takes `GET, PUT, DELETE, OPTIONS`. **No PATCH route.** A POST is treated as "create" only when `request.content_type == 'application/geo+json'` (exact string). Any other Content-Type, including `application/geo+json; charset=utf-8`, sends the POST to `get_collection_items` (CQL2 POST query) — [pygeoapi/flask_app.py L274-325](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/flask_app.py)
- `manage_collection_item` in `pygeoapi/api/itemtypes.py`:
  - create returns **201** with a `Location` header;
  - update (PUT) returns **204**;
  - delete returns **200** (not 204), after first checking the item exists (404 via `ProviderItemNotFoundError`);
  - a write to a non-editable collection returns **400** `InvalidParameterValue` "Collection is not editable" (not 405);
  - an empty body returns 400.
  - There is no ETag or If-Match handling anywhere in the handler.
  - [pygeoapi/api/itemtypes.py `manage_collection_item`](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/itemtypes.py)
- `CONFORMANCE_CLASSES_FEATURES` includes `http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/create-replace-delete`. `conformance()` in `pygeoapi/api/__init__.py` adds that list whenever any resource has a `feature` provider, whether or not anything is editable — [pygeoapi/api/__init__.py `conformance`](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/__init__.py)
- Live check: https://demo.pygeoapi.io/master/conformance declares `ogcapi-features-4/1.0/conf/create-replace-delete`, while `OPTIONS /collections/obs/items` returns `allow: HEAD, GET` (not editable) — probe run 2026-11-09 against [demo.pygeoapi.io/master](https://demo.pygeoapi.io/master/conformance?f=json)

**ldproxy** (CRUD building block, module `ogcapi-draft/ogcapi-crud`; latest release v4.8.2, 2026-10-07; some options marked `@since v4.9` are in HEAD only — [releases](https://github.com/interactive-instruments/ldproxy/releases))
- Building block `CRUD` (alias `TRANSACTIONAL`/`TRANSACTIONS`), maturity `DRAFT_OGC`. Its documented basis is the conformance classes "Create/Replace/Delete", "Update", "Optimistic Locking using Timestamps", "Return Resource Representation in Response", "Handling Preference" and "Features" from [draft 20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html) — [CrudBuildingBlock.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app/CrudBuildingBlock.java)
- Limitation: works only with an SQL feature provider with `dialect: PGIS` and `datasetChanges.mode: CRUD`, and a single geometry property with scope RECEIVABLES — same source
- Media types: POST/PUT need `Content-Type: application/geo+json` (GeoJSON or JSON-FG) or `application/gml+xml`. PATCH supports `application/merge-patch+json` (RFC 7396) and `application/geo+json`; GML PATCH returns 415 — same source
- Geometry CRS must be given in a `Content-Crs` header and must be one of the collection's `crs`, otherwise 400. Properties must be in the "receivables" representation; the profile `all-as-receivable` fetches the current feature for editing — same source
- ID assignment: POST on `/items` when ldproxy generates ids (URI in `Location`). PUT on `/items/{featureId}` when the client assigns ids. Clients find out which from OpenAPI or the collection field `supportsNonAutogeneratedResourceIds`. An `id` member in the body is ignored, and a PATCH that would change the id returns 400 — same source
- **ETag/If-Match:** "A PUT, PATCH or DELETE request cannot be made conditional on an entity tag … an 'If-Match' header cannot be met and the request is rejected with HTTP 412 … Use an 'If-Unmodified-Since' header instead" — same source
- Optimistic locking `optimisticLockingLastModified` (since v3.5, default false): PUT/PATCH/DELETE must carry `If-Unmodified-Since`, otherwise **428**. If the feature changed since that time, **412**. A successful PUT/PATCH returns `Last-Modified`. The timestamp comes from a DATETIME property with `isLastModified: true` — [CrudConfiguration.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/domain/CrudConfiguration.java)
- `returnRepresentation` (since v4.9, HEAD): `Prefer: return=representation` gives 201 or 200 with a body and `Preference-Applied`. The default or `return=minimal` gives 201 + Location for create and 204 for change. `Prefer: handling=strict` gives schema validation, and `rejectEmptyValues` (v4.9) adds a check for empty strings — same source
- Declared conformance (`EndpointCrud.getConformanceClassUris`): `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/create-replace-delete`, `…/ogcapi-common-5/1.0/conf/update` and `http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/features`. More classes are added when a collection enables `optimisticLockingLastModified`. A code comment says the draft is co-branded, so the non-feature-specific classes use OGC API - Common - Part 5 URIs — [EndpointCrud.java L110-205](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app/EndpointCrud.java)
- POST, PUT, PATCH and DELETE operations are generated into OpenAPI per collection, under tag "Mutate data" — same source (resource/operation builders for `HttpMethods.POST/PUT/PATCH/DELETE`)

**QGIS Server** (OAPIF handler `src/server/services/wfs3/qgswfs3handlers.cpp`)
- POST (insert), PUT, PATCH and DELETE are all present in the release-3_40, release-3_44 and release-4_0 branches as well as master — [qgswfs3handlers.cpp master](https://github.com/qgis/QGIS/blob/master/src/server/services/wfs3/qgswfs3handlers.cpp); branch check via GitHub API, 2026-11-09
- **PATCH body is non-standard.** The handler parses JSON and requires a top-level `"modify"` object of property values (400 "Missing \"modify\" instruction"). An `"add"` member raises NotImplemented (400). This is neither RFC 7396 merge-patch nor a GeoJSON feature. The PATCH path changes attributes only (`changedGeometries` is left empty) — same file, PatchMethod case (~L3509-3580)
- POST success returns 201 with `Content-Type: application/geo+json` — same file (~L3093)
- Conformance on master lists `http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/create-replace-delete` and `…/update` (comment "From: https://docs.ogc.org/DRAFTS/20-002r1.html"). The release-3_40, release-3_44 and release-4_0 files do not contain the `ogcapi-features-4` string. The file was last changed 2026-10-28 — same file L1160-1162; branch grep
- No ETag/If-Match handling was found in the handler (grep) — same file

**CubeWerx cubeserv** (demo reports `CubeWerx-Suite-Version: 9.7.26`)
- Live `/conformance` at test.cubewerx.com Daraa declares `ogcapi-features-4/1.0/conf/create-replace-delete` and `ogcapi-features-4/1.0/conf/features`. It does not declare `update`. It also declares Parts 5–8 drafts — [CubeWerx demo conformance](https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa/conformance?f=json)
- `OPTIONS …/collections/AgricultureSrf/items` returns `Allow: OPTIONS,HEAD,GET,POST,DELETE`. On `…/items/{id}` it returns `Allow: OPTIONS,HEAD,GET,PUT,DELETE`. PATCH is not listed — live probe 2026-11-09
- An anonymous `DELETE …/items/nonexistent-probe-zz9` returned **200 OK** with body `{"transactionSummary":{"totalInserted":0,"totalUpdated":0,"totalReplaced":0,"totalDeleted":0}}` and `Content-Disposition: … Transaction_….json`. Part 4 expects 404 for a nonexistent resource. The response is a WFS-style transaction report — live probe 2026-11-09
- The OpenAPI document (`/api`, openapi 3.0.3) lists 54 paths and **no** post/put/patch/delete operations under `…/items`; the generic `/collections/{collectionId}/items` has only `get`. Write capability is therefore advertised only through conformance and Allow, not through OpenAPI — live probe 2026-11-09
- The CubeWerx OpenAPI declares global `securitySchemes`:
  - `openIdConnect1` (`https://www.authenix.eu/.well-known/openid-configuration`);
  - API key in query `apiKey`;
  - API key in header `CubeWerx-API-Key`;
  - HTTP scheme `CwAuth` (`x-auth-server: https://test.cubewerx.com/cubewerx/auth`).
  - Top-level `security` is an OR of all four — live probe of [CubeWerx demo /api](https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa/api?f=json)
- CubeWerx's Peter Vretanos is co-editor of Part 4, with Clemens Portele (interactive instruments) — [OGC portal draft 20-002](https://portal.ogc.org/files/108198)

**Others**
- MapServer: the OGC API Features docs cover read-only setup (MapServer ≥ 8.0, `-DWITH_OGCAPI`). No transaction section was found — [MapServer OGC API docs](https://mapserver.org/ogc/ogc_api.html), [MS RFC 134](https://mapserver.gis.umn.edu/fr/development/rfc/ms-rfc-134.html)
- deegree ogcapi 2.0.4 documentation (March 2026) lists Part 1, Part 2 and partial Part 3. No Part 4 — [deegree-ogcapi.pdf 2.0.4](https://download.deegree.org/ogcapi/documentation/2.0.4/deegree-ogcapi.pdf); the OGC implementation DB entry lists Part 1 and Part 2 — [OGC Implementation Database pid=1704](https://www.ogc.org/resource/products/details/?pid=1704)
- GNOSIS (maps.gnosis.earth/ogcapi) declares Features Parts 1, 2, 3 and `ogcapi-features-5/0.0/conf/schemas` and `core-roles-features`. No Part 4 class — live probe of [GNOSIS conformance](https://maps.gnosis.earth/ogcapi/conformance?f=json)
- Esri: ArcGIS Server 11.0 docs describe OGC Features service publishing and read access only, "not yet fully compliant with OGC API Features specification". They are silent on editing — [ArcGIS Enterprise 11.0: OGC Features service](https://enterprise.arcgis.com/en/server/11.0/publish-services/linux/ogc-features-service.htm). ArcGIS Pro treats OGC API Features layers as non-editable — [ArcGIS Pro: Use an OGC API service](https://pro.arcgis.com/en/pro-app/3.5/help/data/services/use-ogc-api-services.htm)
- pg_featureserv: PR #152 "OGC API Features - Part 4: Create Replace Delete" is OPEN and unmerged (last updated 2025-04-14) — [CrunchyData/pg_featureserv#152](https://github.com/CrunchyData/pg_featureserv/pull/152)
- OgcApi.Net (.NET) is listed in search results as supporting Part 4 for PostGIS and SQL Server. Its README did not confirm details when checked — [sam-is/OgcApi.Net](https://github.com/sam-is/OgcApi.Net)

### Inferences
- A client cannot trust `/conformance` alone. pygeoapi declares create-replace-delete with no editable collections. CubeWerx declares it but its OpenAPI advertises no write operations. QGIS releases accept writes but declare nothing. Per-collection signals (OPTIONS `Allow`, OpenAPI paths) disagree across servers.
- There are two URI families for Part 4 classes. pygeoapi, QGIS master and CubeWerx use `ogcapi-features-4/1.0/conf/create-replace-delete`. ldproxy uses `ogcapi-common-5/1.0/conf/create-replace-delete` + `…/update` plus `ogcapi-features-4/1.0/conf/features`. Both reflect different stages of the 20-002 draft.
- PATCH is not interoperable. pygeoapi has none, QGIS uses a proprietary `modify` envelope, ldproxy uses merge-patch, and CubeWerx does not advertise it.

### Gaps
- tipg, SuperMap iServer, TerraBrowser and other entries in the OGC implementation database were not checked; no reliable source on their write support was gathered.
- CubeWerx documentation on write configuration, media types, PATCH and If-Match semantics was not found. Findings come from probes only, and POST/PUT bodies were not tested on the public demo.
- MapServer, GNOSIS and Esri have no explicit "no write support" statement. "No" means none was documented or declared.

## Q2. How write capability is advertised, and whether it is per collection

### Takeaway
Advertisement is per collection in pygeoapi (OpenAPI + OPTIONS), ldproxy (OpenAPI, per-collection building-block config) and QGIS (OPTIONS from per-layer WFS-T settings and ACL plugins). Global conformance does not reflect per-collection config in pygeoapi. CubeWerx shows writes only in Allow and conformance.

### Cited Findings
- pygeoapi: the OpenAPI generator adds a `post` with `application/geo+json` request body and a 201 response to `/collections/{id}/items`, plus `put` (204) on `/items/{featureId}`, only `if p.editable`. The POST operation is merged with the CQL2 POST query operation (`operationId` `getCQL2OrAdd…Features`, summary "… or add item (see media type)") — [pygeoapi/api/itemtypes.py ~L1195-1230, ~L1360-1400](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/itemtypes.py)
- pygeoapi OPTIONS: `Allow: HEAD, GET` plus `POST` (items) or `PUT, DELETE` (item) when the provider is editable — same file, `manage_collection_item` `action == 'options'`
- ldproxy: CRUD is a building block configured per API or per collection (`- buildingBlock: CRUD, enabled: true`). Write operations appear in the OpenAPI per collection under tag "Mutate data". `supportsNonAutogeneratedResourceIds` appears in the collection metadata — [CrudConfiguration.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/domain/CrudConfiguration.java), [CrudBuildingBlock.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app/CrudBuildingBlock.java)
- ldproxy adds optional conformance classes only if any collection enables the matching option (`apiData.getCollections().values().stream().anyMatch(... supportsLastModified)`). So conformance is a union over collections — [EndpointCrud.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app/EndpointCrud.java)
- QGIS: write capability per layer comes from the project's WFS-T settings (`wfstInsertLayerIds`, `wfstUpdateLayerIds`, `wfstDeleteLayerIds`) AND the provider capabilities (AddFeatures / ChangeAttributeValues / ChangeGeometries / DeleteFeatures) AND, when built with Python server plugins, `QgsAccessControl::layerInsert/Update/DeletePermission`. OPTIONS builds `Allow` from these: GET, OPTIONS, plus POST, DELETE, and PUT+PATCH — [qgswfs3handlers.cpp `canInsertFeatures`/`canUpdateFeatures`/`canDeleteFeatures` (~L890-940) and OptionsMethod (~L3116-3135)](https://github.com/qgis/QGIS/blob/master/src/server/services/wfs3/qgswfs3handlers.cpp)
- CubeWerx: Allow header per resource, conformance global, no write ops in OpenAPI — live probe (see Q1)

### Inferences
- In QGIS, `Allow` takes the access-control plugin into account, so it can vary by user, the only server here where that is evident from code. In pygeoapi, `Allow` reflects only `editable`, not the user (auth is external).

### Gaps
- Whether ldproxy's OpenAPI or conformance changes per authenticated user was not established from source.

## Q3. Authentication/authorization, and status codes for unauthorized writes

### Takeaway
- pygeoapi has no built-in access control; it is delegated to fastgeoapi (OIDC/JWT, API keys, OPA) or pygeoapi-auth (OpenAPI injection with an Authelia deployment).
- ldproxy has built-in bearer-token permissions with a `data:write` group, scopes and an optional PDP.
- QGIS uses project WFS-T settings plus access-control plugins and returns 403.
- CubeWerx advertises OIDC, API key and CwAuth.
- Anonymous write behaviour varies: QGIS returns 403, pygeoapi 400 (non-editable), CubeWerx accepted an anonymous DELETE (200).

### Cited Findings
- pygeoapi: "By design, pygeoapi does not have built-in support for access control." The docs list fastgeoapi, pygeoapi-auth-deployment and pygeoapi-auth — [pygeoapi docs/source/security.rst](https://github.com/geopython/pygeoapi/blob/master/docs/source/security.rst); the transactions page says access control must be enforced by a separate service — [pygeoapi docs: Transactions](https://docs.pygeoapi.io/en/latest/transactions.html)
- fastgeoapi: OIDC (OAuth2/JWT Bearer with JWKS), API key authentication and Open Policy Agent policies. Its demo uses the OAuth2 client-credentials flow — [geobeyond/fastgeoapi README](https://github.com/geobeyond/fastgeoapi)
- pygeoapi-auth: a CLI and plugin that injects authorization into the OpenAPI document using Authelia (`pygeoapi-auth openapi inject-auth local-openapi.yml authelia authelia-conf.yml`) — [geopython/pygeoapi-auth README](https://github.com/geopython/pygeoapi-auth)
- ldproxy access control:
  - Permissions are `<group prefix>:<operationId>`. Predefined groups include `data:write` ("mutate features") and a base group `write`.
  - `public` defaults to `[read]`, so writes need an authenticated bearer token.
  - Permissions can be limited per API or collection with suffixes such as `read::daraa` or `data:getItems::daraa:AeronauticSrf`.
  - OAuth2 scopes can be enabled (for example `[BASIC]` gives scopes `read`/`write`).
  - Optional `policies` call a PDP that can Deny.
  - Tokens are sent in `Authorization: Bearer`.
  - [ApiSecurity.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-stable/ogcapi-foundation/src/main/java/de/ii/ogcapi/foundation/domain/ApiSecurity.java)
- ldproxy CRUD has `PolicyAttributeResolverPayloadProperties.java`, which suggests request-body properties can be passed to the policy decision point — [ogcapi-crud app dir](https://github.com/interactive-instruments/ldproxy/tree/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app)
- QGIS: a disallowed write throws `QgsServerApiPermissionDeniedException` ("Features cannot be added to layer …", "No ACL permissions to insert features …"), which defaults to **403 "Forbidden"**. An unimplemented method throws `QgsServerApiNotImplementedException` — [qgsserverexception.h](https://github.com/qgis/QGIS/blob/master/src/server/qgsserverexception.h), [qgswfs3handlers.cpp](https://github.com/qgis/QGIS/blob/master/src/server/services/wfs3/qgswfs3handlers.cpp). The OpenAPI includes a 403 response "Forbidden: the operation requested was not authorized" — same file ~L2016
- pygeoapi: a write to a non-editable collection returns **400** InvalidParameterValue (not 401/403/405). PATCH is not routed, so Flask returns its default 405 — [itemtypes.py](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/itemtypes.py), [flask_app.py](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/flask_app.py)
- CubeWerx: global securitySchemes (OIDC via authenix.eu, apiKey query/header, CwAuth). An anonymous DELETE on the demo returned 200 — live probe (see Q1)
- GeoServer: no OGC API write, so GeoServer security rules for OGC API writes do not apply. Editing goes through WFS-T — [GeoServer status](https://docs.geoserver.org/main/en/user/services/features/status/), [GeoServer WFS-T tutorial](https://geoserver.org/tutorials/2025/04/07/wfs-transaction.html)

### Inferences
- pygeoapi 405 for PATCH is inferred from Flask behaviour for an unrouted method, not tested live.

### Gaps
- The exact ldproxy status codes for a missing or invalid token versus insufficient permission (401 vs 403) were not confirmed from source or a live server (demo.ldproxy.net was unreachable from this environment, 2026-11-09).
- Whether QGIS returns 401 when HTTP auth is handled by an auth plugin depends on the plugin and was not checked.

## Q4. CORS behaviour for write methods

### Takeaway
pygeoapi enables CORS only when `server.cors: true` is set, using flask-cors defaults. CubeWerx's demo answers preflights for PUT/POST/DELETE with `Authorization`, `Content-Type` and `If-Match` reflected.

### Cited Findings
- pygeoapi: `if CONFIG['server'].get('cors', False): CORS(APP, expose_headers='*')` — [pygeoapi/flask_app.py L85-91](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/flask_app.py)
- CubeWerx demo preflight (`Origin: https://example.com`, `Access-Control-Request-Method: PUT`, `Access-Control-Request-Headers: authorization,content-type,if-match`):
  - `Access-Control-Allow-Origin: https://example.com`;
  - `Access-Control-Allow-Methods: GET,HEAD,OPTIONS,PUT,POST,DELETE` (no PATCH);
  - `Access-Control-Allow-Headers: authorization,content-type,if-match`;
  - live probe 2026-11-09.

### Inferences
- flask-cors defaults allow all standard methods and any origin, without credentials unless configured otherwise. This comes from library defaults, not pygeoapi docs.

### Gaps
- ldproxy and QGIS CORS behaviour for write methods was not investigated; no source gathered.
- Whether CubeWerx sends `Access-Control-Allow-Credentials` was not captured.

## Q5. Known deviations from the Part 4 draft, batch extensions, and public write-test endpoints

### Takeaway
- Several deviations need factual reporting:
  - pygeoapi: no PATCH, DELETE returns 200, exact-match Content-Type gating of POST, static conformance;
  - QGIS: proprietary PATCH body, no conformance declared in releases;
  - CubeWerx: 200 + WFS-style summary for deleting a nonexistent item, no write ops in OpenAPI;
  - ldproxy: If-Match always 412.
- No server here exposes a batch or atomic transaction endpoint via OGC API.
- CubeWerx's Daraa demo appears to accept anonymous writes. The pygeoapi master demo collections checked are not editable.

### Cited Findings
- pygeoapi deviations — sources in Q1 (flask_app.py routes; itemtypes.py statuses; api/__init__.py conformance)
- QGIS PATCH `modify`/`add` envelope — [qgswfs3handlers.cpp PatchMethod](https://github.com/qgis/QGIS/blob/master/src/server/services/wfs3/qgswfs3handlers.cpp)
- ldproxy If-Match rejection and the Common-5 URIs for conformance — [CrudBuildingBlock.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app/CrudBuildingBlock.java), [EndpointCrud.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app/EndpointCrud.java)
- ldproxy GML bodies must hold a single feature; `wfs:FeatureCollection` returns 400 (no multi-feature or batch) — [CrudBuildingBlock.java](https://github.com/interactive-instruments/ldproxy/blob/master/ogcapi-draft/ogcapi-crud/src/main/java/de/ii/ogcapi/crud/app/CrudBuildingBlock.java)
- GeoSolutions material says work on the atomic/batch transaction part of the standard had not begun at that time — [GeoSolutions edu: Transactions on Features](https://geoserver.geosolutionsgroup.com/edu/en/ogcapi/features/transactions.html)
- pygeoapi publishes a pub/sub message after each create, update or delete when `pubsub_client` is configured. This is a notification extension, not a batch — [itemtypes.py `publish_message`](https://github.com/geopython/pygeoapi/blob/master/pygeoapi/api/itemtypes.py)
- CubeWerx demo write-capable endpoint: https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa (Allow includes POST/PUT/DELETE; anonymous DELETE accepted) — live probe 2026-11-09
- fastgeoapi runs a public demo protected with the OAuth2 client-credentials flow — [fastgeoapi README](https://github.com/geobeyond/fastgeoapi)

### Inferences
- CubeWerx's `transactionSummary` with `totalReplaced` suggests OGC API writes map onto its WFS-T engine internally.

### Gaps
- Whether the CubeWerx demo persists anonymous POST/PUT, or resets, was not tested; it is a shared public server.
- No public ldproxy, QGIS or GeoServer endpoint allowing OGC API writes was found.
- OGC code sprint reports on Part 4 interoperability were not reviewed within the time budget.

# OGC API Features write support: implementation plan

Based on [OGC API Features write support.md](OGC%20API%20Features%20write%20support.md) and its decisions (§6). Date: 2026-11-09. Target release: **1.6.0**.

Scope: create, replace and delete through LuciadRIA's Store contract, PATCH as an extra method, a schema fetch and a write-support discovery helper. Out: batch, transactions, optimistic locking, writing in a CRS other than CRS84.

## Public API (new and changed)

```ts
// OgcOpenApiFeatureStoreConstructorOptions
writeOperations?: ("add" | "put" | "remove")[];   // default []: read-only, as today

// OgcOpenApiFeatureStore
isOperationSupported(op)        // get, spatialQuery, plus each listed write operation
add(feature): Promise<FeatureId>          // POST /items
put(feature): Promise<FeatureId>          // PUT /items/{id}
remove(id): Promise<boolean>              // DELETE /items/{id}
patch(id, change: {properties?: {[k: string]: unknown}, geometry?: Shape | null}): Promise<FeatureId>
                                          // PATCH /items/{id}, application/merge-patch+json (not used by LuciadRIA)
get(id): Promise<Feature | undefined>     // CHANGED: undefined, not null, for a missing feature or a 404

// OgcOpenApiGetCapabilities
fetchSchema(capabilities, collection, options?): Promise<OgcOpenApiSchema | null>
fetchWriteSupport(capabilities, collection, options?): Promise<OgcOpenApiWriteSupport>

// OgcOpenApiError
body?: string                             // NEW: the response body when it is not problem+json (trimmed)
```

`OgcOpenApiWriteSupport` (a hint, never a guarantee):

```ts
{
  conformance: { createReplaceDelete: boolean, update: boolean },   // any of the known URI families
  allow?: { items?: string[], item?: string[] },                    // undefined when OPTIONS fails or Allow is not readable
  suggested: ("add" | "put" | "remove")[],                          // what the app may pass as writeOperations
  patch: boolean,                                                   // update conformance and PATCH in Allow
  issues: string[]                                                  // inconsistencies, reported as found
}
```

## Phase 1: test servers in the repo

The spikes become test infrastructure; the spikes folder stays as the research record.

1. `test/servers/write/{ldproxy,pygeoapi,qgis,geoserver}/`: docker-compose, seed SQL and config copied from `spikes/`, pinned to the same image digests. Without the probe scripts and transcripts.
2. One script per server, `reset.sh`: recreate the database from the seed, so every live run starts from the same rows. One `up.sh` / `down.sh` for all four.
3. ldproxy tokens: a small TypeScript helper in `test/servers/write/ldproxy/token.ts` that signs HS256 JWTs with node `crypto` (replaces the spike's `token.py`).
4. `vitest.live-write.config.ts` including `test/**/*.write.live.test.ts`, and `npm run test:live-write`. Manual, never in CI (decision 7). README section on how to start the servers.
5. Ports: the free ones the spikes ended on, documented in `test/servers/write/README.md`.

## Phase 2: store contract fixes and errors

1. `get` resolves `undefined` for an empty response and for a 404 (other statuses still reject). Update the existing tests that expect `null`. CHANGELOG notes it as a behaviour change.
2. `OgcOpenApiError`: add `body` for a non-problem+json response (text, trimmed to a few KB). `fromResponse` keeps the status in every case.

## Phase 3: add, put, remove

In `OgcOpenApiFeatureStore`:

1. **Option and capability.** `writeOperations` is stored at construction; `isOperationSupported` reports `get`, `spatialQuery` and those operations. It never changes afterwards (LuciadRIA reads it once).
2. **Write URL.** The items URL (`baseUrl`) and the item URL (`featureUrl + encodeURIComponent(id)`), with the items link parameters **except `f`** (ldproxy rejects `f` on writes with 400; an api key in the link must stay).
3. **Encoding.** Always GeoJSON (`application/geo+json`), whatever the read codec is. The shape is transformed to CRS:84 when the store's reference is another one; no `Content-Crs` header (decision 9). Properties as the feature has them. To check while implementing: the GeoJsonCodec API to encode one feature (or encode a one-feature cursor and take `features[0]`).
4. **Request.** `OgcOpenApiFetchTools.fetch` with `requestHeaders` as the fourth argument, so credentials keep going only to the server's own origin. `credentials` as today.
5. **add:** POST without an `id`. Accept 201 (and 200) with a `Location`; the id is its last path segment, decoded. Set `feature.id`, emit `StoreChanged` `"add"`, resolve the id. No `Location`, or another status: reject with `OgcOpenApiError`.
6. **put:** PUT with the feature's id in the URL **and** in the body (pygeoapi needs it there and would otherwise write another feature). A feature without an id rejects before any request. 200/204: emit `"update"`; 201: emit `"add"`. Resolve the id.
7. **remove:** DELETE. 200/204: emit `"remove"` with the feature undefined, resolve `true`. 404: resolve `false`, no event. Otherwise reject.
8. **Caching.** `get` uses `cache: "no-cache"` when the store has write operations (ldproxy + Chrome stale reads). To check in phase 6: whether items queries after a write are also served stale; if so, the same for `query`.
9. Each failure rejects with `OgcOpenApiError` (status, URL, problem or body). No retries, no status interpretation, no workaround for a server's deviation.

## Phase 4: patch

1. `patch(id, change)`: JSON Merge Patch body `{properties?, geometry?}`, geometry encoded as in phase 3 (`null` removes it, as RFC 7396 says), `Content-Type: application/merge-patch+json`.
2. 200/204: re-read the feature (`no-cache`), emit `"update"` with it, resolve the id. Otherwise reject.
3. Not reported by `isOperationSupported` (LuciadRIA has no such operation). Documented as usable on servers that declare the update conformance class; on others the server's 405 or 400 comes back as the error.

## Phase 5: schema and write-support discovery

In `OgcOpenApiGetCapabilities`, next to `fetchQueryables`:

1. **fetchSchema**: the collection link with rel `http://www.opengis.net/def/rel/ogc/1.0/schema` (or `schema`), else `/collections/{id}/schema`; `Accept: application/schema+json, application/json`. `null` on 404, and also when the answer is not a JSON Schema (QGIS answers the landing page with 200). Typed like `OgcOpenApiQueryables`: the JSON Schema as the server sends it.
2. **fetchWriteSupport**:
   - Conformance: the create-replace-delete and update classes in all three URI families (`ogcapi-features-4/1.0`, `ogcapi-features-4/0.0`, `ogcapi-common-5/1.0`).
   - `OPTIONS` on the items URL, and on one item URL when an id is given in the options. Sent with the app's credentials, through the same fetch path. `Allow` parsed when readable.
   - `suggested`: add if POST is allowed on items; put and remove if PUT/DELETE are allowed on the item (or on items when only that is known); empty when conformance declares nothing.
   - `issues`, worded as facts, for example: create-replace-delete declared but no write method allowed; write methods allowed without the conformance class; update declared but PATCH not allowed; `Allow` not readable.
   - Documented as a hint: GeoServer's `Allow` lists methods that fail, and only QGIS answers per user.

## Phase 6: tests

1. **Unit tests** (mocked fetch) for every write path:
   - URLs (no `f`, link parameters kept), headers, body (CRS84, id in the PUT body, no id in the POST body).
   - `Location` parsing, events and their ids, `isOperationSupported` per option.
   - Statuses: 200/201/204/404, and error rejections with status and body.
   - `get` → `undefined`.
   - `fetchSchema` (link, path, 404, non-schema answer) and `fetchWriteSupport` (URI families, Allow parsing, suggestions, issues).
2. **Recorder.** Writes reuse URLs and change state, so the recorder must key each response by method, URL and sequence number, and keep the headers the writes read: `location`, `allow`, `last-modified`, `cache-control`, `www-authenticate`. The existing read recordings keep working unchanged.
3. **Live write tests** (`*.write.live.test.ts`, phase 1 servers, reset first):
   - ldproxy (token) and pygeoapi (Basic through the proxy): add, get, put, remove, verified by reading back through the store; patch on ldproxy.
   - Denied writes per server and user: assert the status and that the store rejects with it.
   - `fetchWriteSupport` per server, including QGIS's per-user answer and GeoServer's issues.
   - A FeatureLayer-level check: `isOperationSupported` and a full add/put/remove within the 10 s WorkingSet limit.
4. **Recorded write tests**: record the live scenario of ldproxy and pygeoapi once, replay offline in the normal `npm test`.
5. **Browser**: one write scenario through `npm run test:browser`, headless only, against ldproxy and pygeoapi, to keep the CORS findings covered. Optional if it needs more than the existing browser setup.

## Phase 7: demo, docs, release

1. Demo: a writable feature layer from the test servers with `writeOperations` from `fetchWriteSupport`, editing enabled, errors shown with status and body. Only if the demo's layer setup allows it without restructuring.
2. README: writing features, the `writeOperations` option, credentials as an `Authorization` header (not `credentials: true`), what `fetchWriteSupport` can and cannot tell, PATCH, and the server notes of report §4.
3. CHANGELOG 1.6.0, version bump. The commit message is handed to the user; no commits by the assistant.

## Order and size

| Phase | Depends on | Size |
|---|---|---|
| 1 Test servers | – | M |
| 2 Contract fixes, error body | – | S |
| 3 add, put, remove | 2 | L |
| 4 patch | 3 | S |
| 5 Schema, write-support helper | – | M |
| 6 Tests | 1, 3, 4, 5 (unit tests go with each phase) | L |
| 7 Demo, docs, release | 3–6 | M |

Phases 1, 2 and 5 can start in parallel.

## To verify while implementing

- The GeoJsonCodec call to encode one feature and its shape transformation.
- Whether ldproxy item lists (not only single items) are served stale after a write.
- Feature id types: LuciadRIA ids are `string | number`, `Location` gives a string. Decide whether numeric-looking ids become numbers (follow what `query` decodes for the same server).
- The 10 s WorkingSet timeout with emulated (amd64) containers on this Mac.

# OGC API - Features - Part 4: Create, Replace, Update and Delete (CRUD): technical summary for a client implementer

Primary sources used:
- Editor's / latest draft: OGC 20-002r2, "OGC API - Features - Part 4 / OGC API - Common - Part 5: Create, Replace, Update and Delete", version 1.0.0-draft.3: https://docs.ogc.org/DRAFTS/20-002r2.html (referred to below as **r2**)
- Public-comment draft: OGC 20-002r1, version 1.0.0-draft.2: https://docs.ogc.org/DRAFTS/20-002r1.html (referred to below as **r1**)
- Repo README: https://github.com/opengeospatial/ogcapi-features/blob/master/README.md
- Part 5 Schemas (approved): https://docs.ogc.org/is/23-058r2/23-058r2.html
- Part 2 CRS by Reference (approved): https://docs.ogc.org/is/18-058r1/18-058r1.html

Requirement numbers below ("Req N", "Perm N", "Rec N") are those of the cited draft. They are **not stable** across drafts, so the path identifiers (e.g. `/req/create-replace-delete/post-op`) are the references to rely on. Nothing in Part 4 is normative OGC text yet. Both drafts say they are "not an OGC Standard".

## 1. Status, document number, version, dates (as of 2026-11-09)

### Takeaway
Part 4 is **still a draft and not approved**. The latest draft is OGC 20-002r2, version 1.0.0-draft.3, dated 2026-09-21 and described as the "draft for submission to TC". It is now co-branded as **OGC API - Common - Part 5**, and its generic conformance classes moved into the `ogcapi-common-5` URI namespace. It differs substantially from the 2024 public-comment draft (20-002r1, draft.2).

### Cited Findings
- r1 metadata: OGC 20-002r1, external identifier `http://www.opengis.net/doc/IS/ogcapi-features-4/1.0`, version 1.0.0-draft.2, status Draft ("not an OGC Standard ... distributed for review and comment"). Editors are Panagiotis (Peter) A. Vretanos and Clemens Portele; submitters are CubeWerx Inc. and interactive instruments GmbH. Copyright is 2024 and the submission and approval dates are placeholders. — [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- OGC public comment period for Part 4 (20-002r1) and Part 5 (23-058r1): 2024-06-25 to 2024-09-23. Comments were collected as GitHub issues. — [OGC RFC announcement](https://www.ogc.org/requests/ogc-seeks-public-comment-on-ogc-api-features-parts-4-5/)
- r2 metadata: title "OGC API - Features Part 4 / OGC API - Common Part 5: Create, Replace, Update and Delete", version 1.0.0-draft.3 (20-002r2), status Draft ("not an OGC Standard"), copyright 2026, dates still placeholders, same editors. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- r2 revision history (Annex B): 1.0.0-SNAPSHOT on 2020-02-17 (initial) and 2020-06-02 (feature-specific aspects moved to their own requirements class); 1.0.0-draft.1 on 2024-03-07 (OAB review); 1.0.0-draft.2 on 2024-06-04 (Public Comment); 1.0.0-draft.3 on 2026-09-21 ("draft for submission to TC, co-branded as OGC API - Common - Part 5"). The page was last updated 2026-09-24. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- The repo README says Part 4 is not approved and "has passed the Public Comment Period and is being prepared for the approval process". It links the editor's draft at https://docs.ogc.org/DRAFTS/20-002r2.html. The source is `extensions/transactions/create-replace-update-delete/standard/20-002.adoc`. — [README](https://github.com/opengeospatial/ogcapi-features/blob/master/README.md)
- For comparison, Part 5 Schemas (23-058r2, v1.0.0, co-branded OGC API - Common - Part 3) was approved and published on 2026-04-30. Parts 1, 2, 3 and 5 are approved, and Part 11 "Atomic and Batch Transactions" is a proposal. — [README](https://github.com/opengeospatial/ogcapi-features/blob/master/README.md); [23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html)
- An approved standard, OGC API - Connected Systems Part 1 (23-001), already builds its Create/Replace/Delete and Update classes on Part 4 requirements and cites it as "1.0.0-DRAFT". — [23-001](https://docs.ogc.org/is/23-001/23-001.html) (via search result summary)
- Implementations target various drafts. pygeoapi says it supports the "draft specification". GeoServer/GeoCat status pages say an earlier draft is implemented and "being updated to final (no CITE tests yet)". — [pygeoapi docs](https://docs.pygeoapi.io/en/0.23.3/transactions.html); [GeoCat status](https://docs.geocat.net/mapping/services/features/status.html)

### Inferences
- **The editor's draft (r2) differs from the published public-comment draft (r1).** Section 2 lists the main differences. A client written today should follow r2 and tolerate r1-era servers, since most deployed servers (GeoServer, pygeoapi) were built against draft.1 or draft.2.
- The TC vote could still change requirement numbering and possibly URIs. Nothing found indicates a vote has taken place.

### Gaps
- I found no OGC press release or TC vote result for Part 4 dated after 2026-09-21. As of 2026-11-09 it is unknown whether a TC/PC vote is scheduled.
- I did not read the r2 Annex A tests in full.

## 2. Conformance classes, URIs, dependencies; r1 vs r2

### Takeaway
r2 defines six generic classes under `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/` and one feature-specific class, `http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/features`. Every class is optional. A server implements Create/Replace/Delete and/or Update plus Features. The other classes add locking and preferences.

### Cited Findings
- **r2 conformance classes** — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html):
  | Class | URI |
  |---|---|
  | Create/Replace/Delete | `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/create-replace-delete` |
  | Update (PATCH) | `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/update` |
  | Optimistic Locking using Timestamps | `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/optimistic-locking-timestamps` |
  | Optimistic Locking using ETags | `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/optimistic-locking-etags` |
  | Return Resource Representation in Response | `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/return-resource-representation-in-response` |
  | Handling Preference | `http://www.opengis.net/spec/ogcapi-common-5/1.0/conf/handling` |
  | Features | `http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/features` |
- r2 requirement URI pattern: `http://www.opengis.net/spec/ogcapi-common-5/1.0/req/create-replace-delete/post-op` etc. for the generic classes, and `http://www.opengis.net/spec/ogcapi-features-4/1.0/req/features/...` for Features. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- r2 dependencies: Create/Replace/Delete depends on RFC 9110 and W3C LDP 1.0 (for `Accept-Post`). Update depends on RFC 5789 (PATCH). The PATCH parts of the optimistic-locking classes apply only when Update is implemented. Features depends on Create/Replace/Delete and on Features Part 1 Core. It depends conditionally on GeoJSON, GML, Update, Return Representation, JSON Merge Patch (RFC 7396), RFC 6906 (profile link), Part 2 (CRS by Reference), Part 5 (Schemas) and JSON-FG. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- **r1 conformance classes** (Table 2), all under `ogcapi-features-4`: `.../conf/create-replace-delete`, `.../conf/update`, `.../req/optimistic-locking-timestamps`, `.../req/optimistic-locking-etags` and `.../conf/features`. The table mixes `/req/` and `/conf/` for the locking classes, apparently by mistake. — [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- r1 Features dependencies: Create/Replace/Delete and Part 1 Core directly. Conditionally GeoJSON, GML SF-0/SF-2, Update, RFC 7396, Part 2 and Part 5 "Returnables and Receivables". — [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- r2 Annex A contains an abstract test suite, e.g. `/conf/update/update-content-type` (expects 400 when Content-Type is missing), `/conf/optimistic-locking-etags/replace` (expects 412 on an If-Match mismatch), `/conf/features/crs` and `/conf/features/put-create`. In r1, Annex A was a placeholder ("will be added"). — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html); [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)

### Main changes r1 (draft.2, 2024) to r2 (draft.3, 2026), compiled from both documents
- The generic classes moved from `ogcapi-features-4` to `ogcapi-common-5` URIs. Only `conf/features` stays under `ogcapi-features-4`.
- Two new classes: Return Resource Representation in Response (`Prefer: return=...`) and Handling Preference (`Prefer: handling=strict|lenient`).
- A missing `Content-Type` on POST, PUT or PATCH now explicitly gets **400** (Req 4, 9, 22).
- New `Accept-Post` requirement (Req 17) and `Accept-Patch` requirement (Req 19) in OPTIONS responses, plus advisory HTTP link hints (6.5.6).
- PUT-create now returns **201** without requiring `Location` (Perm 6, Req 10). r1 only allowed 200/204.
- PUT identifier mismatch: r1 required that the server "SHALL ignore" an id in the body (Req 11). r2 says ignore **or reject**, depending on the resource type (Req 11). For Features PATCH, the id must be rejected (Req 24, Req 59).
- Optimistic locking now also covers **DELETE** (r2 Req 32/33 for timestamps, Req 41/42 for ETags). r1 covered only PUT and PATCH.
- `async` (202) is now a single Permission 3 / Perm 12. In r1 it was a sub-clause of each response requirement.
- Features: JSON-FG support is added (the `place` member takes precedence over `geometry`, with profile negotiation via a `Link: rel=profile` header). A rule rejects writes to `readOnly` properties, and `id` is read-only.
- `supportsNonAutogeneratedResourceIds` exists in both drafts. r1 put it on `/collections` and `/collections/{id}`. r2 Req 53 puts it on the collection representation.
- 409 no longer appears in the r2 status table. It survives only in Perm 13 and Perm 14 (missing precondition header).

### Inferences
- When checking `/conformance`, a client should accept **both URI families** (`ogcapi-common-5/1.0/conf/...` and `ogcapi-features-4/1.0/conf/...`), and possibly the r1 `/req/optimistic-locking-*` spelling. Deployed servers will advertise the older r1 URIs for some time.

### Gaps
- Some r2 dependency rows (ETags, Return Representation, Handling) were not visible in the fetched text.
- It is unclear whether existing servers (GeoServer, pygeoapi, ldproxy) already advertise the `ogcapi-common-5` URIs. Not checked.

## 3. Operations: methods, paths, bodies, headers, status codes

### Takeaway
Create is POST to `/collections/{collectionId}/items`, which returns 201 with `Location`. Replace is PUT to `/items/{featureId}`, which returns 200 or 204 (201 if it created the feature). Update is PATCH with `application/merge-patch+json`, which returns 200 or 204. Delete is DELETE, which returns 200 or 204. Any of them may return 202 when processing is deferred. A missing Content-Type gets 400. Discovery uses OPTIONS with `Allow`, `Accept-Post` and `Accept-Patch`.

### Cited Findings (r2 unless noted) — all from [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
**Endpoints (Features class)**
- Req 51 `/req/features/resources-endpoint`: the resources endpoint is `{landingPageUri}/collections/{collectionsId}/items`. In r1 this was limited to collections whose `itemType` is absent or `feature`.
- Req 52 `/req/features/resource-endpoint`: the resource endpoint is `{landingPageUri}/collections/{collectionsId}/items/{featureId}`. `featureId` is an `id` obtained from a prior query of the items.

**General**
- Req 1 `/req/core/methods`: for each mutable resource the server implements one or more of POST, PUT and DELETE, and declares them via OPTIONS.
- Perm 1 `content-type-lenient`: the server may accept a generic media type (e.g. `application/json`) if the representation is unambiguous.
- Perm 2 `additional-status-codes`: other status codes are allowed.
- Perm 3 `async`: the server may return 202 for CREATE, REPLACE or DELETE.

**CREATE (POST on the items endpoint)**
- Req 2 `/req/create-replace-delete/post-op`: POST is supported if `Allow` declares it.
- Req 3 `post-body`: the body is the representation of the new resource. Perm 4 `insert-body`: any encoding may be supported.
- Req 4 `post-content-type`: the media type is taken from `Content-Type`. A missing header gets **400**.
- Req 5 `post-response-rid`: the server assigns a new identifier, unique within the collection.
- Perm 5 `/per/create-replace-delete/rid`: the server may use or ignore a client-supplied id in the body.
- Req 6 `post-response`: immediate success is **201** with a `Location` header holding the URI of the new resource. Deferred processing is **202**.
- No response body is required by default. A body is returned only when `Prefer: return=representation` is used (Return Representation class, below).

**REPLACE (PUT on the item)**
- Req 7 `put-op`: PUT is supported if `Allow` declares it.
- Req 8 `put-body`: the body is the complete new content. Perm 7 `update-put-body`: any encoding.
- Req 9 `put-content-type`: a missing `Content-Type` gets 400.
- Req 10 `put-response`: replacing gives 200 or 204, creating gives 201, deferred processing gives 202.
- Req 11 `put-rid`: if the body id differs from the URI id, the server ignores it or rejects the request, per resource type.
- Req 12 `put-rid-exception`: (A) the resource does not exist and PUT-create is unsupported: 404. (B) PUT-create is supported but `If-Match` is present on a non-existent resource: do not create, return 412.
- Perm 6 `/per/create-replace-delete/put-create`: the server "MAY support the PUT method on a non-existing resource". The response is 201 and need not include `Location`. A request with `If-Match` must never be treated as an insert.

**DELETE (on the item)**
- Req 13 `delete-op`: DELETE is supported if `Allow` declares it.
- Req 14 `delete-response`: 200 or 204, or 202 if deferred.
- Rec 1 `no-resource`: SHOULD return 404 if the resource does not exist. In r1 this was `/rec/delete/no-feature`.

**OPTIONS (discovery)**
- Req 15 `options-op`: OPTIONS is supported at each resource endpoint.
- Req 16 `options-response`: 200 with an `Allow` header listing the methods allowed "at that time and in that context". That context may be per user, so authorization can be reflected here.
- Req 17 `/req/create-replace-delete/options-accept-post`: if `Allow` includes POST, the response includes an `Accept-Post` header listing the media types accepted for CREATE.
- Perm 8: the OPTIONS request may have a body, which the server may discard. Perm 9: other methods (GET, HEAD) may be listed. Perm 10: the response body format is undefined.
- 6.5.6 HTTP link hints (advisory): `allow`, `accept-post`, `accept-patch`, `formats` (for REPLACE, since no header exists for it), `precondition-req`, `accept-prefer` and `auth-schemes`. The server's actual behavior overrides the hints. A CRS hint is proposed for a future registry.

**UPDATE (PATCH on the item)**
- Req 18 `/req/update/methods`: PATCH is declared via OPTIONS.
- Req 19 `options-accept-patch`: if `Allow` includes PATCH, the response includes `Accept-Patch`.
- Perm 11: the media type may be accepted leniently.
- Req 20 `update-patch-op`: PATCH is supported.
- Req 21 `update-patch-body`: the body describes the changes. Processing rules depend on the resource type.
- Req 22 `patch-content-type`: a missing Content-Type gets 400.
- Req 23 `update-patch-response`: 200 or 204, or 202 if deferred (Perm 12 `update/async`).
- Req 24 `/req/update/rid`: a differing identifier is ignored or rejected. Features reject it.

**Status codes (r2 Table 3)**
| Code | Meaning |
|---|---|
| 200 | Success with content |
| 201 | Created (POST, PUT-create) |
| 202 | Accepted for asynchronous processing |
| 204 | Success, no content |
| 400 | Client error (e.g. missing `Content-Type`) |
| 401 | Authentication required (with `WWW-Authenticate`) |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 405 | Method not supported |
| 406 | Content negotiation failed |
| 412 | Precondition failed (`If-Match`, `If-Unmodified-Since`) |
| 413 | Request body too large |
| 415 | Unsupported media type |
| 422 | Valid syntax but rejected, e.g. a missing mandatory property |
| 428 | Conditional request required |
| 500 | Internal server error |

409 is mentioned only as an alternative to 428 when a precondition header is missing.

**Media types (r2 Clause 12; same in r1 Clause 10)**
- GeoJSON: CREATE and REPLACE use `application/geo+json`. UPDATE uses `application/merge-patch+json`. Schemas use `application/schema+json`.
- GML: CREATE and REPLACE use `application/gml+xml`. UPDATE and schemas use `application/xml`.
- Perm 16 `/per/features/other-update-vocabularies`: other PATCH vocabularies (JSON Patch, WFS 2.0 Update) are allowed but not defined.

**JSON Merge Patch — Req 59 `/req/features/update-json-merge-patch`**
- PATCH with `application/merge-patch+json` is processed per RFC 7396 against the GeoJSON or JSON-FG representation.
- `geometry` maps to the property with the `primary-geometry` role, and a non-null `place` takes precedence.
- Updates to the `id` property (`x-ogc-role: id`) are rejected.
- Spatial values are parsed as GeoJSON or JSON-FG geometries.
- A `null` value removes (unsets) the property.

**GeoJSON / JSON-FG create and replace**
- Req 60 `/req/features/geojson-create-replace`: on REPLACE, an `id` that differs from `featureId` is ignored or rejected. `place` or `geometry` maps to the primary geometry, with `place` taking precedence. A non-default CRS requires the `Content-Crs` header.
- Req 61 `/req/features/geojson-jsonfg`: the server accepts a `profile` link (RFC 6906) in the request `Link` header and processes JSON-FG profiles.
- Rec 5 `/rec/features/return-profile`: the response uses the same profile and declares it.

**GML**
- Req 62 `/req/features/gml-create-replace`: on REPLACE, a differing `@gml:id` is ignored or rejected.
- Req 63 `/req/features/gml-srsname`: `srsName` on geometries is honored and overrides `Content-Type` (wording as in the draft).

**Return Resource Representation in Response (optional class)**
- Req 43 `/req/return-resource-representation-in-response/http-header`: the server recognizes `Prefer: return=...` (RFC 7240).
- Req 44 `.../response`: for a 200 or 201 response, `return=representation` means the body carries the created or modified resource. `return=minimal` or no preference means no representation.
- Req 45 `.../representation`: the representation is chosen by content negotiation (`Accept`).
- Rec 3 `.../media-type`: with no `Accept` header, the server uses the request body's media type.
- Req 46 `.../preference-applied`: the response includes `Preference-Applied` when the preference is honored.

**Handling Preference (optional class)**
- Req 47 `/req/handling/prefer`: the server supports `Prefer: handling=strict` on CREATE, REPLACE and UPDATE.
- Req 48 `/req/handling/strict`: with `strict`, a body that violates published constraints is rejected with 4xx and an error description (typically 400 for syntax, 422 for constraint violations).
- Req 49 `/req/handling/lenient`: with `lenient`, recoverable errors must not cause rejection.
- Req 50 `/req/handling/preference-applied`: the response includes `Preference-Applied`.

### Inferences
- A client should read the new id from the `Location` header after a 201. Without `return=representation`, the response body is empty, so the client re-GETs the feature if it needs the server-normalized result. It should treat 202 as "accepted, not yet visible".
- Accept 200 and 204 for PUT, PATCH and DELETE, and 201 for PUT-create.
- Always send `Content-Type` (400 otherwise). Use `application/geo+json` for POST/PUT and `application/merge-patch+json` for PATCH. Lenient servers may accept `application/json`.

### Gaps
- Exact wording of r2 Req 1 and the "mutable resource" definition was not retrieved.

## 4. Feature id assignment and client-proposed ids (PUT-create)

### Takeaway
On POST, the server always assigns the id. It may honor an id the client puts in the body, or ignore it. PUT to a non-existent id creates a feature only if the server opts in. It advertises this with `supportsNonAutogeneratedResourceIds: true` on the collection. Otherwise it returns 404.

### Cited Findings
- Req 5 `post-response-rid` (new unique id within the collection); Perm 5 `rid` (the server may use or ignore a client-supplied id). — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Perm 6 `put-create`, Req 12 `put-rid-exception` (404 if unsupported; 412 if `If-Match` is present on a non-existent resource) and Req 10 (201 on create). — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Req 53 `/req/features/collection-endpoint`: if PUT can create features, the collection representation SHALL include `"supportsNonAutogeneratedResourceIds": true`. Test `/conf/features/put-create` checks this. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- In r1 the same boolean was required at both `{landingPageUri}/collections` and `{landingPageUri}/collections/{collectionId}`. — [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- Part 5: the property with `x-ogc-role: id` must be a string or integer, with at most one per schema. In Part 4 r2 the id is read-only on write (Req 58). — [23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html); [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)

### Inferences
- If the client wants to pick ids, it uses PUT and checks `supportsNonAutogeneratedResourceIds` first. With POST, the client must not assume its body `id` was kept, and should take the id from `Location`.

## 5. CRS handling on write

### Takeaway
Without Part 2, write geometries must be CRS84 (or CRS84h). With Part 2, the client declares the CRS with a `Content-Crs: <uri>` header on POST, PUT and PATCH. The default is CRS84, and an unsupported CRS is an error. The server may accept only `storageCrs`.

### Cited Findings
- Req 54 `/req/features/crs-crs84` (Part 2 not implemented): geometries are interpreted as CRS84, or CRS84h with height. A request declaring another CRS gets an error. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Req 55 `/req/features/content-crs-header` (Part 2 implemented): the server reads `Content-Crs` on CREATE, REPLACE and UPDATE. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Req 56 `/req/features/default-crs`: with no CRS declared, CRS84 or CRS84h applies. Req 57 `/req/features/crs-other-crs`: a declared CRS is used, and an unsupported CRS is an error. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Rec 4 `/rec/features/crs-storage-crs`: SHOULD declare `storageCrs` and SHOULD support all CRSs in `crs`. MAY accept only the storage CRS for mutations. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Req 60(C): a GeoJSON body in a non-default CRS requires `Content-Crs`. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Part 2 header syntax: `/req/crs/ogc-crs-header` and `/req/crs/ogc-crs-header-value` define `CRS-value = "<" URI-reference ">"`, e.g. `Content-Crs: <http://www.opengis.net/def/crs/EPSG/0/3395>`. Collection metadata comes from `/req/crs/fc-md-crs-list` (`crs`) and `/req/crs/fc-md-storageCrs` (`storageCrs`). — [18-058r1](https://docs.ogc.org/is/18-058r1/18-058r1.html)

### Inferences
- The safest client strategy is to send CRS84 with no `Content-Crs` header. If it writes in another CRS, it should send `Content-Crs: <storageCrs-uri>`, and use axis order as defined by that CRS (Part 2 semantics).
- The draft gives no specific error code for an unsupported CRS. Expect 400 (or possibly 422).

### Gaps
- The error status for an unsupported Content-Crs is not specified in the text I retrieved.

## 6. Optimistic locking

### Takeaway
There are two optional classes. In the **ETags** class, GET, PUT and PATCH responses carry `ETag`, and PUT, PATCH and DELETE requests carry `If-Match` with a strong ETag. In the **Timestamps** class, responses carry `Last-Modified`, and requests carry `If-Unmodified-Since`. A failed precondition gets 412. A missing precondition header gets 428 or 409, or the server proceeds with 2xx (the server chooses).

### Cited Findings (r2) — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- **Timestamps** (`/req/optimistic-locking-timestamps/...`):
  - Req 25: GET responses include `Last-Modified`.
  - Req 26: a successful PUT response includes `Last-Modified`. Req 27 does the same for PATCH (if Update is implemented).
  - Req 28: a PUT replace SHALL include `If-Unmodified-Since`. Req 29: the server evaluates it per RFC 9110 §13.1.4.
  - Req 30/31: the same for PATCH. Req 32/33: the same for DELETE.
  - Perm 13 `/per/optimistic-locking-timestamps/ifunmodifiedsince-missing`: if the header is omitted, the server MAY respond 428 (RFC 6585) or 409, or MAY execute the operation and return 2xx.
- **ETags** (`/req/optimistic-locking-etags/...`):
  - Req 34 `get-etag-response`: GET returns an `ETag` that reflects the state at the end of handling. Req 35 `put-etag-response` and Req 36 `patch-etag-response`: successful PUT and PATCH return an `ETag`.
  - Req 37/38 `ifmatch-put-op` / `ifmatch-put-eval`: PUT includes `If-Match`, evaluated per RFC 9110 §13.1.1.
  - Req 39/40: the same for PATCH. Req 41/42 `ifmatch-delete-op` / `ifmatch-delete-eval`: the same for DELETE.
  - No ETag is required on DELETE responses.
  - Perm 14 `/per/optimistic-locking-etags/ifmatch-missing`: 428 or 409, or 2xx.
  - Perm 15 `/per/optimistic-locking-etags/ifmatch-star`: `If-Match: *` may be supported.
  - 8.3.3: ETags must be **strong**. A weak ETag in `If-Match` always fails the precondition.
- Failed precondition: normally 412. The server may instead return 2xx if the requested change is already reflected in the resource. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- r1 had the same PUT and PATCH requirements (Req 22–35) but no DELETE locking. Its Req 27 and Req 34 text says "PUT" where PATCH is meant (typos), and Req 26's id says "ifmatch" but concerns If-Unmodified-Since. — [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- Interaction with PUT-create: an `If-Match` request on a non-existent resource gets 412 and never creates the feature (Perm 6, Req 12B). — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)

### Inferences
- Client pattern: GET the feature, store its `ETag` and/or `Last-Modified`, then send `If-Match` (preferred) or `If-Unmodified-Since` on PUT, PATCH or DELETE. Map 412 to a "conflict / stale" error. Map 428 (or 409) to "server requires a conditional request", and retry after a GET. After PUT or PATCH, refresh the stored ETag from the response.
- A weak ETag (`W/"..."`) from the server is unusable for If-Match under this draft.

## 7. Discovery of write support; security and authentication

### Takeaway
Discovery works on several levels: `/conformance` (class URIs), OPTIONS (`Allow`, `Accept-Post`, `Accept-Patch`, possibly per user), optional link hints, `supportsNonAutogeneratedResourceIds` for PUT-create, and the OpenAPI definition. Security is informative. Authentication is required for modification, missing credentials get 401 with `WWW-Authenticate`, and insufficient privileges get 403 (or 404/401 to hide existence). Auth schemes are declared in the OpenAPI definition.

### Cited Findings
- OPTIONS is mandatory at each resource endpoint (Req 15/16). `Allow` reflects the methods allowed "at that time and in that context" (Req 16C). `Accept-Post` (Req 17) and `Accept-Patch` (Req 19) are required when those methods are allowed. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Link hints (6.5.6) include `allow`, `accept-post`, `accept-patch`, `formats`, `precondition-req`, `accept-prefer` and `auth-schemes`. They are advisory only. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Req 2, 7 and 13 make support for POST, PUT and DELETE conditional on `Allow` declaring them. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Security considerations (r2 Clause 13; r1 Clause 11) are non-normative:
  - Modifying users must be authenticated, have modification privileges and have access to the relevant methods.
  - The API definition should reflect this.
  - Missing credentials get 401 with `WWW-Authenticate`. Insufficient privileges get 403.
  - Servers may return other codes (e.g. 404, 401) to hide information.
  - Authentication schemes are declared in the OpenAPI definition.
  — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html); [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- The r2 bibliography cites OAuth 2.0 (RFC 6749), JWT (RFC 7519), RFC 9700 (OAuth security BCP), OpenID and OWASP cheat sheets, and OpenAPI 3.0.4. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)

### Inferences
- A robust client checks conformance first, then OPTIONS on `/collections/{id}/items` and on an item, then optionally the OpenAPI document. OPTIONS gives the most specific per-user, per-resource answer.
- An `Allow` without POST, PUT or DELETE for an anonymous user does not mean that an authenticated user lacks them.
- Being cross-origin, OPTIONS may be intercepted by CORS preflight handling on some servers.

### Gaps
- I found no normative requirement mandating OpenAPI paths or operations per collection for write operations, nor specific `securitySchemes`. OpenAPI is mentioned only in Security Considerations and the bibliography.
- It is not verified whether the r2 Annex tests OPTIONS behavior for Create/Replace/Delete.

## 8. Batch, multiple features, transactions

### Takeaway
Part 4 is single-resource only. POSTing a FeatureCollection is not defined. Batch and atomic transactions are deferred to a separate "Part 11: Atomic & Batch Transactions", which is only a proposal.

### Cited Findings
- r1: batch or atomic transactions are out of scope. "Additional OGC Standards are planned to handle transactions that require batch or atomicity semantics." — [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- The repo has `proposals/atomic-batch-tx`, which "contains the content for OGC API - Features - Part 11: Atomic & Batch Transactions" (subfolders standard/, openapi/, examples/json/). The README lists Part 11 as a proposal. — [atomic-batch-tx](https://github.com/opengeospatial/ogcapi-features/tree/master/proposals/atomic-batch-tx); [README](https://github.com/opengeospatial/ogcapi-features/blob/master/README.md)
- r2 Req 3: the POST body is "the representation of the new resource", which is singular. — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)

### Inferences
- A client should issue one request per feature. Some servers accept a FeatureCollection on POST as a vendor extension, but that is not Part 4 behavior and should not be relied on.

### Gaps
- The Part 11 proposal content (endpoints, media types) was not retrieved.

## 9. Relationship to Part 5 Schemas (receivables vs returnables)

### Takeaway
Part 5 (approved on 2026-04-30) defines one schema resource, `/collections/{collectionId}/schema` (`application/schema+json`, linked with rel `http://www.opengis.net/def/rel/ogc/1.0/schema`). Read-only and write-only properties are marked there with `readOnly` and `writeOnly`. Part 4 r2 Req 58 requires that writes conform to the receivable constraints, that `readOnly` properties (including `id`) are rejected, and that extra properties are accepted unless `additionalProperties: false`.

### Cited Findings
- Part 5 conformance class `http://www.opengis.net/spec/ogcapi-common-3/1.0/conf/returnables-and-receivables`:
  - Req 18 `/req/returnables-and-receivables/link`: collections link to the schema with rel `http://www.opengis.net/def/rel/ogc/1.0/schema`.
  - Req 19 `.../op`: GET with `application/schema+json`.
  - Req 20 `.../response`: 200, and `additionalProperties` (default `true`) states whether undeclared properties are allowed.
  — [23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html)
- Definitions: a *receivable* is a property that can be included when creating or updating a resource. A *returnable* appears when fetching. — [23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html)
- Part 5 Req 2: properties used only on create or update carry `"writeOnly": true`, and properties returned only on fetch carry `"readOnly": true`. — [23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html)
- `x-ogc-role` values: `id` (string or integer, max one), `primary-geometry`, `primary-instant`, `primary-interval-start`, `primary-interval-end`, `primary-interval`, `type` (string, max one) and `reference` (string or integer). — [23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html)
- Part 5 profiles: `valid-domain` is described as important for receivables, since it shows the accepted values. The schema resource may support a `profile` query parameter (Permission 4). There is no separate receivables endpoint or link relation. — [23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html)
- Part 4 r2 Req 58 `/req/features/schema` (if Part 5 is implemented):
  - The schema is at `{landingPageUri}/collections/{collectionId}/schema`.
  - Mutations satisfying the receivable constraints are accepted.
  - Unknown properties are not rejected unless `additionalProperties: false`.
  - Setting a `readOnly` property is rejected.
  - `id` is read-only.
  — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- In r1, Rec 2 `/rec/create-replace-delete/update/schema` said that if schema constraints exist the server SHOULD publish a schema. Req `/req/features/schema` in r1 had parts A–C only, without the readOnly rejection. — [20-002r1](https://docs.ogc.org/DRAFTS/20-002r1.html)
- Merge Patch maps `geometry` to the `primary-geometry` property and rejects changes to the `x-ogc-role: id` property (Req 59). — [20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)

### Inferences
- A client store can fetch `/collections/{id}/schema` and do the following:
  - drop `readOnly` properties and the `x-ogc-role: id` property from write bodies
  - add `writeOnly` properties where needed
  - respect `additionalProperties: false`
  - pick the geometry member via `primary-geometry`
  - optionally pre-validate types or enums (using `valid-domain` if offered)

  Server-side violations surface as 400 or 422, especially with `Prefer: handling=strict`.

### Gaps
- Part 5 Annex A tests 12–16 for returnables and receivables were truncated and not reviewed.

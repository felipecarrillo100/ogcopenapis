# Batch operations and transactions in the OGC API family (successor of WFS-T)

Research date: 2026-11-09. Status labels used: NORMATIVE (approved OGC Standard), DRAFT (editor's/candidate draft, not a standard), PROPOSAL (early draft in the proposals folder), NONEXISTENT.

## Q1. OGC API - Features parts, and which one addresses batch/transactions (does "Part 11" exist?)

### Takeaway
"OGC API - Features - Part 11" does exist, but the user's description of it is slightly off. Its exact title is **"Part 11: Atomic and Batch Transactions"** (OGC 26-018, 1.0.0-draft), and it is only a **PROPOSAL / early draft**, not a standard. Single-feature writes are in Part 4 (Create, Replace, Update and Delete). Part 4 is a DRAFT that has passed public comment and is being prepared for approval. Part 4 deliberately excludes multi-feature, batch and atomic writes and hands them to Part 11.

### Cited Findings
- Parts list and status from the official repo README ([opengeospatial/ogcapi-features](https://github.com/opengeospatial/ogcapi-features)):

| Part | Name | Status | Document |
|---|---|---|---|
| 1 | Core | Approved v1.0.1 | [docs.ogc.org/is/17-069r4](https://docs.ogc.org/is/17-069r4/17-069r4.html) |
| 2 | CRS by Reference | Approved v1.0.1 | [docs.ogc.org/is/18-058r1](https://docs.ogc.org/is/18-058r1/18-058r1.html) |
| 3 | Filtering | Approved v1.0.0 (CQL2 is a separate approved standard) | [docs.ogc.org/is/19-079r2](https://docs.ogc.org/is/19-079r2/19-079r2.html) |
| 4 | Create, Replace, Update and Delete | Draft; passed public comment, being prepared for approval | [docs.ogc.org/DRAFTS/20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html) |
| 5 | Schemas (also OGC API - Common Part 3) | Approved v1.0.0 | [docs.ogc.org/is/23-058r2](https://docs.ogc.org/is/23-058r2/23-058r2.html) |
| 6 | Property Selection | Initial draft | [DRAFTS/24-019](https://docs.ogc.org/DRAFTS/24-019.html) |
| 7 | Geometry Simplification | Initial draft | [DRAFTS/24-020](https://docs.ogc.org/DRAFTS/24-020.html) |
| 8 | Sorting | Initial draft | [DRAFTS/24-030](https://docs.ogc.org/DRAFTS/24-030.html) |
| 9 | Text Search | Initial draft | [DRAFTS/24-031](https://docs.ogc.org/DRAFTS/24-031.html) |
| 10 | Query | Initial draft | [DRAFTS/26-008](https://docs.ogc.org/DRAFTS/26-008.html) |
| 11 | Atomic and Batch Transactions | Proposal | [DRAFTS/26-018](https://docs.ogc.org/DRAFTS/26-018.html) |

  — [ogcapi-features README](https://github.com/opengeospatial/ogcapi-features)
- The Part 11 source lives in the repo at `proposals/atomic-batch-tx`, with subfolders `standard/`, `openapi/` and `examples/json`. Its README says: "This folder contains the content for OGC API - Features - Part 11: Atomic & Batch Transactions." — [proposals/atomic-batch-tx](https://github.com/opengeospatial/ogcapi-features/tree/master/proposals/atomic-batch-tx)
- The Part 4 draft (1.0.0-draft.3, doc 20-002r2) is also published as "OGC API - Common - Part 5". It states: "Additional OGC Standards are planned to handle transactions that require batch or atomicity semantics." — [Part 4 draft](https://docs.ogc.org/DRAFTS/20-002r2.html)
- Issue #942 ("Part 4: Discussions about submitting a list of Features?") was opened 2024-07-16 by m-mohr, who cited STAC's POST of an ItemCollection. On 2024-08-26 cportele recorded the meeting decision: Part 4 scope is restricted to mutations of a single resource/feature, and multi-feature changes go to a future extension. The issue is labeled "Future work". — [issue #942](https://github.com/opengeospatial/ogcapi-features/issues/942)

### Inferences
- The user's belief is essentially correct on the number (Part 11) and topic. It is wrong if they assume Part 11 is a published or approved standard. It is an early draft with no submission or approval dates, and it explicitly says "is not an OGC Standard". Its conformance URIs may change.
- Batch or atomic multi-feature writes have no NORMATIVE OGC API Features standard as of Nov 2026. Even single-feature CRUD (Part 4) is not yet formally approved, according to the repo README.

### Gaps
- No formal OGC timeline for Part 11 (SWG vote, public comment) was found.

## Q2. Drafts and proposals that define transactional multi-feature writes: content of Part 11 (OGC 26-018)

### Takeaway
Part 11 defines a single `POST /transactions` endpoint. It accepts a JSON transaction document (`application/ogc-tx+json` in examples) that lists insert, replace, update and delete actions across one or more collections. Actions are filter-targeted (CQL2), and the transaction runs with either `atomic` semantics (all-or-nothing rollback across collections) or `batch` semantics (each action independent). The response is a WFS-T-like summary with totals and result URIs. Optional async execution reuses the job model from OGC API Processes.

### Cited Findings
All findings below come from [OGC 26-018 draft](https://docs.ogc.org/DRAFTS/26-018.html) unless noted.
- **Metadata:**
  - Title: "OGC API - Features - Part 11: Atomic and Batch Transactions", version 1.0.0-draft.
  - Editors: Panagiotis (Peter) A. Vretanos (CubeWerx) and Clemens Portele (interactive instruments).
  - Submission, approval and publication dates are empty placeholders.
  - The revision history shows a "1.0.0-draft.2 (2024-06-04, Public Comment)" entry. That entry is probably template residue, because the repo labels Part 11 a "proposal". Treat it as unreliable.
- **Scope:** The draft is written as a generic resource extension, with feature-specific content isolated in a "Features" clause. One transaction can span "one or more collections".
- **Conformance classes** (base `http://www.opengis.net/spec/ogcapi-features-11/1.0/conf/`):
  - `transactions`
  - `async-transactions`
  - `atomic-semantics`, which some requirement text spells `atomic-transactions`
  - `batch-semantics`, which some requirement text spells `batch-transactions`
  - `json-transactions`
  - `features`

  The URIs are inconsistent inside the draft itself. HydroServer's issue makes the same observation ([hydroserver #650](https://github.com/hydroserver2/hydroserver/issues/650)).
- **Endpoints:**
  - "The server SHALL support the HTTP POST operation at the transactions endpoint" (`POST /transactions`).
  - For async: `GET /jobs/{jobID}` and `GET /jobs/{jobID}/results`.
- **Payload:**
  - The body carries a transaction representation, and `Content-Type` declares its media type. JSON is recommended, and the examples use `application/ogc-tx+json`.
  - Top-level structure: `semantic` ("atomic" by default, or "batch") plus a `transaction` array of actions.
  - `insert`: `collection` plus `items` (GeoJSON features or links).
  - `replace`: `collection`, the new feature and a filter.
  - `update`: property-level `add`, `modify` and `delete` arrays plus a filter.
  - `delete`: `collection` plus a filter.
  - Each action may have an optional `id`, `title` and `description`.
  - Filters are CQL2, defaulting to `filter-lang=cql2-json` and `filter-crs=CRS84`.
- **Atomic semantics:** "If any action contained within the transaction fails then the entire transaction fails". All affected collections are restored to their prior state.
- **Batch semantics:** Each action is independent. Processing continues past failures, which are reported in an `exceptions` array.
- **Identifiers:** The server assigns new identifiers. A permission lets it use or ignore client-supplied IDs.
- **Response:**
  - HTTP 200 with `semantic`, a `summary` (`totalInserted`, `totalUpdated`, `totalReplaced`, `totalDeleted`), `insertResults`, `updateResults`, `replaceResults` and `deleteResults` (URI arrays), plus optional `exceptions`.
  - `Prefer: return=none|minimal|representation` controls verbosity: empty body, counts only, or counts plus identifiers.
- **Async:**
  - `Prefer: respond-async` triggers background execution, and a `wait` preference may be honored.
  - Job status uses the `statusInfo` schema from OGC API Processes, with `processingEntityType` set to `ogc-api-features`.
  - Exception types: `no-such-job` (404), `result-not-ready` (404) and `results-not-available` (410).
- **Concurrency:** "Optimistic locking" is defined in the terms section (HTTP validators and preconditions, RFC 9110 §8.8). No normative ETag requirement for transactions was found. Codes 412 and 428 are listed only in the generic status-code table. There is no pessimistic locking (no equivalent of WFS LockFeature).
- **Features clause:**
  - GeoJSON encoding when the GeoJSON class of Part 1 is implemented, and the geometry member maps to the primary geometry.
  - CRS84 by default, or `Content-Crs` with Part 2.
  - Schema validation against Part 5 schemas.
  - The clause depends on Parts 1, 2 and 5, and on a "create-replace-delete" class. The relationship to Part 4 is not otherwise spelled out.
- **Editorial state:** The JSON examples contain syntax errors, and requirement lettering is duplicated in places. This confirms immature draft status.
- **Other drafts:** Apart from Part 11, the only related multi-feature mechanism found in OGC channels is the deferred issue #942 (POST of a FeatureCollection to `/items`). That approach was *not* adopted into Part 4 ([issue #942](https://github.com/opengeospatial/ogcapi-features/issues/942)). The STAC API Transaction Extension (community, not OGC) allows POST of an ItemCollection to `/collections/{id}/items` with possible partial success ([stac-api-extensions/transaction](https://github.com/stac-api-extensions/transaction); described in [issue #942](https://github.com/opengeospatial/ogcapi-features/issues/942)).

### Inferences
- The Part 11 design is a near-direct JSON/REST transposition of the WFS 2.0 Transaction operation. It uses the same four action verbs, filter-based targeting for update/replace/delete, and the same `totalInserted/Updated/Replaced/Deleted` summary plus per-action results. Editor Vretanos is also the long-time WFS editor. It adds a "batch" (non-atomic) mode that WFS 2.0 did not have, and it replaces WFS locking with HTTP optimistic concurrency (on paper).
- Because the draft has internal URI inconsistencies, a client should not hard-code Part 11 conformance URIs yet. If it detects them at all, it should match loosely.

### Gaps
- No OGC Testbed or Code Sprint engineering report specifically on Part 11 was found within the search budget. [OGC 20-091 (per)](https://docs.ogc.org/per/20-091.html) came up in search but was not examined.
- The `openapi/` folder of the proposal (the exact OpenAPI path definitions) was not read.

## Q3. Vendor extensions and implementations of transactions over OGC API Features

### Takeaway
Implementations of single-feature Part 4 CRUD exist (pygeoapi; Connected Systems servers reuse it). No vendor implementation of Part 11 `/transactions` was confirmed. GeoServer has no OGC API Features transaction support at all, according to GeoSolutions training material. HydroServer has an open issue proposing to adopt Part 11.

### Cited Findings
- **pygeoapi:** Supports the Part 4 (Create, Replace, Update and Delete) draft for features and records. It is enabled with `editable: true` on a provider that supports create, update and delete, and an optional `validator` plugin can be added. Authentication and authorization are left to external services. No batch or atomic support is documented. — [pygeoapi transactions docs](https://docs.pygeoapi.io/en/latest/transactions.html)
- **GeoServer:** "Currently GeoServer provides no implementation for OGCAPI - Features transaction support." The training page describes "Atomic and Batch" as "No specification has been provided yet", which is outdated relative to the 26-018 draft. — [GeoSolutions GeoServer training: Transactions on Features](https://geoserver.geosolutionsgroup.com/edu/en/ogcapi/features/transactions.html)
- **HydroServer:** Issue #650 proposes adding Part 11 `/transactions` with atomic and batch modes. It notes that HydroServer already does CRUD but does not declare Part 4 conformance. — [hydroserver2/hydroserver #650](https://github.com/hydroserver2/hydroserver/issues/650)
- **STAC API Transaction Extension:** A community extension, not OGC. It provides POST/PUT/PATCH/DELETE on items and allows POST of an ItemCollection with partial success. — [stac-api-extensions/transaction](https://github.com/stac-api-extensions/transaction)
- **CubeWerx:** Its staff co-edit Parts 4 and 11 ([Part 4 draft](https://docs.ogc.org/DRAFTS/20-002r2.html); [26-018](https://docs.ogc.org/DRAFTS/26-018.html)). No public CubeWerx documentation of a `/transactions` endpoint was found.

### Inferences
- A client targeting multi-feature edits today effectively has to loop over Part 4 single-item requests, with no atomicity, unless the server declares Part 11.
- The CubeWerx and ldproxy engines (whose staff edit Part 11) are the likeliest early Part 11 implementers, but that is not confirmed.

### Gaps
- **ldproxy:** Its docs site returned HTTP 403, and search found no ldproxy CRUD or transactions page. Its write support remains unverified in this research.
- **Esri:** Equivalents of Esri applyEdits on OGC API Features were not found. Esri is a Part 4 submitter ([Part 4 draft](https://docs.ogc.org/DRAFTS/20-002r2.html)), but no Esri OGC API write implementation was confirmed.
- QGIS, MapServer and deegree write support was not researched.

## Q4. How WFS-T worked and how it maps to OGC API

### Takeaway
WFS 2.0 defines a Transactional WFS conformance class (a single XML Transaction operation containing Insert/Update/Replace/Delete/Native actions) and a Locking WFS class (LockFeature or GetFeatureWithLock plus lockId). In OGC API, this is split into two pieces. Part 4 covers per-resource REST verbs (POST/PUT/PATCH/DELETE) with *optimistic* locking (ETag/If-Match or Last-Modified/If-Unmodified-Since). Part 11 covers multi-action atomic or batch transactions. Pessimistic WFS-style locking has no OGC API equivalent.

### Cited Findings
- **WFS 2.0 (OGC 09-025r2) Transaction operation:**
  - "Transaction operations allow features to be created, changed, replaced and deleted from the underlying data store."
  - Transaction is XML-only, with no KVP encoding.
  - The Transactional WFS class: "The server shall implement the Basic WFS conformance class and shall also implement the Transaction operation."
  - The Locking WFS class requires Transactional plus "at least one of the GetFeatureWithLock or LockFeature operations".
  - Lock exceptions include CannotLockAllFeatures (lockAction=ALL failed), InvalidLockId, LockHasExpired and FeaturesNotLocked.

  — [WFS 2.0.2, OGC 09-025r2](https://docs.ogc.org/is/09-025r2/09-025r2.html)
- **Part 4 mapping:**
  - POST on `/items` creates. PUT on `/items/{id}` replaces (and may create). PATCH updates; the examples use `application/merge-patch+json` (RFC 7396), but no single encoding is mandated. DELETE removes.
  - Optimistic locking comes via the conformance classes `optimistic-locking-etags` (strong ETags, `If-Match`, 412 on mismatch) and `optimistic-locking-timestamps` (`If-Unmodified-Since`).
  - Batch and atomic transactions are out of scope, and pessimistic locking is not described.

  — [Part 4 draft 20-002r2](https://docs.ogc.org/DRAFTS/20-002r2.html)
- **Part 11 mapping:** A transaction document with insert/replace/update/delete actions, filter-based targeting, and a summary with `totalInserted/totalUpdated/totalReplaced/totalDeleted`. It has no lock operations; it only defines "optimistic locking" as a term. — [OGC 26-018](https://docs.ogc.org/DRAFTS/26-018.html)

### Inferences
- Element-by-element (from comparing the two specs):
  - wfs:Insert → `insert` action / POST `/items`
  - wfs:Update (property-level, Filter) → `update` action with add/modify/delete arrays plus CQL2 filter / PATCH
  - wfs:Replace → `replace` / PUT
  - wfs:Delete (Filter) → `delete` action / DELETE
  - fes:Filter → CQL2 JSON
  - wfs:TransactionResponse totals and InsertResults → the Part 11 `summary` and `insertResults`
  - LockFeature/GetFeatureWithLock/lockId → no equivalent; ETags and preconditions replace them
  - wfs:Native → no equivalent seen
- No explicit statement by OGC API designers that says "Part 11 is the successor of WFS-T" was found. Neither 26-018 nor the visible part of Part 4 mentions WFS Transaction. The lineage is inferred from structure and editorship.

### Gaps
- Exact WFS 2.0 clause-15 quotes could not be retrieved. These include the atomicity wording (a failed transaction leaves the store unchanged), the `idgen` values GenerateNew/UseExisting/ReplaceDuplicate, `releaseAction` ALL/SOME, lock `expiry`, and the Native action. The 900 KB page was only partially read via fetch, so these details are from general knowledge and should be checked against [09-025r2](https://docs.ogc.org/is/09-025r2/09-025r2.html) clauses 12, 13 and 15 before being stated as quoted fact.
- A designer-authored WFS-T-to-OGC-API migration note was not found.

## Q5. Other OGC API standards with transaction or batch concepts, and how write support is declared

### Takeaway
Write support across the family reuses Part 4 / Common Part 5 per-resource REST semantics, discovered via `/conformance` URIs, OpenAPI, and HTTP `OPTIONS`/`Allow`/`Accept-Post`/`Accept-Patch`. Processes Part 2 (Deploy/Replace/Undeploy) is a proposed standard that has completed public comment (Aug–Sep 2026). Connected Systems Parts 1 and 2 are approved and use Features Part 4 CRUD. Records Part 1 is read-only; a CRUD/harvest part is a work-in-progress draft. No family member other than Features Part 11 defines multi-resource atomic transactions.

### Cited Findings
- **Discovery in Part 4 / Common Part 5:**
  - Servers declare the conformance classes (`.../ogcapi-common-5/1.0/conf/create-replace-delete`, `update`, `optimistic-locking-*`, `return-resource-representation-in-response`, `handling`, and `.../ogcapi-features-4/1.0/conf/features`).
  - The `Allow` header returned for OPTIONS must reflect allowed methods "at the time and within the context of the request".
  - `Accept-Post` and `Accept-Patch` list the accepted media types, and HTTP Link Hints are mentioned as advisory.
  - 202 async is allowed, but outcome reporting is deferred to the future.

  — [Part 4 draft](https://docs.ogc.org/DRAFTS/20-002r2.html)
- **Part 11 discovery:** The atomic, batch and async classes are declared in `/conformance`. — [26-018](https://docs.ogc.org/DRAFTS/26-018.html)
- **OGC API - Processes Part 2 (Deploy, Replace, Undeploy), OGC 20-044:**
  - Proposed standard, part of the "Processes Version 2" package with Part 1 Core 18-062r3.
  - Public comment ran 2026-08-06 to 2026-09-05. It lets implementations "dynamically add, modify and/or delete individual processes".

  — [OGC public comment request](https://www.ogc.org/requests/ogc-api-processes-standard-version-2-public-comment/)
  - Endpoints: POST `/processes`, PUT `/processes/{processID}`, DELETE `/processes/{processID}` — [Draft 20-044](https://docs.ogc.org/DRAFTS/20-044.html); [repo extension](https://github.com/opengeospatial/ogcapi-processes/tree/master/extensions/deploy_replace_undeploy)
- **OGC API - Connected Systems:**
  - Parts 1 and 2 are approved OGC Standards.
  - Resources are created, replaced and deleted with POST/PUT/DELETE, and updated with PATCH, "as defined by" Features Part 4.

  — [OGC Connected Systems standard page](https://www.ogc.org/standards/ogc-api-connected-systems/); [Part 1 23-001](https://docs.ogc.org/is/23-001/23-001.html); [Part 2 draft 23-002r0](https://docs.ogc.org/DRAFTS/23-002r0.html)
- **OGC API - Records:**
  - Part 1 is approved and read-only, and create/update/delete is planned for future parts. — [OGC API Records](https://www.ogc.org/standards/ogcapi-records/)
  - A draft CRUD/Harvest part was described as "very much a work-in-progress". — [OSGeo Discourse](https://discourse.osgeo.org/t/clarification-on-ogc-api-records-purpose-and-xml-schema-handling/147088)
  - pygeoapi applies Features Part 4 to records. — [pygeoapi](https://docs.pygeoapi.io/en/latest/transactions.html)

### Inferences
- Connected Systems Part 2 normatively references Features Part 4 even though Part 4 is not yet approved, which shows how widely the Part 4 pattern is already being relied on. This comes from search-result summaries and should be confirmed against the approved text.
- The Part 11 async mode reuses the Processes `statusInfo`/jobs model, which means a cross-family "jobs" pattern is emerging.

### Gaps
- Not researched within the budget: OGC API EDR write support (none expected), and Styles (draft, which historically included style create/update/delete) and Tiles write operations.
- The exact Records CRUD part number and document ID were not confirmed.
- Whether Processes v2 Part 2 has received a final TC/PC vote after public comment was not found.

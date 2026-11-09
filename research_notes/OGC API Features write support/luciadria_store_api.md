# LuciadRIA Store write contract and its mapping to OGC API - Features Part 4

Installed version researched: **@luciad/ria 2026.1.1** (`node_modules/@luciad/ria/package.json`, `"version": "2026.1.1"`). The repo's package.json declares `"@luciad/ria": ">=2026.1.0"` as peer dependency and `2026.1.1` as dev dependency.

All `.d.ts`/`.js` paths below are relative to `/Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/`. They are the primary source. The `.js` facts come from reading the minified shipped code. The web documentation at dev.luciad.com could not be retrieved for this version (see Gaps).

Important version note: in **2026.1**, `Store` changed from an *interface with optional methods* (callers checked `typeof store.add === "function"`, as the 2026.0.x reference says) to an **abstract class** with `isOperationSupported(name)`. Every operation is now always defined, and unsupported ones throw `ProgrammingError`. Code written for 2026.0 that relies on method presence will be wrong in 2026.1. — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts); 2026.0.07 behavior as summarized by a web search of [LuciadRIA 2026.0.07 Store reference](https://dev.luciad.com/portal/productDocumentation/LuciadRIA/docs/reference/LuciadRIA/interfaces/_luciad_ria_model_store_Store.Store.html) (the page now returns 404, so this is a search-snippet summary only)

## 1. Store interface: signatures, semantics, events, errors

### Takeaway
`Store<TFeature>` is an abstract class. Only `query` is abstract. `spatialQuery`, `get`, `add`, `put` and `remove` are implemented to throw `ProgrammingError`, and `isOperationSupported` returns `false` by default. A writable store overrides `add`/`put`/`remove`, reports them from `isOperationSupported`, calls `this.emitStoreChangedEvent(...)` on success, and returns the id (or a Promise of it). LuciadRIA never calls an operation that is not reported as supported.

### Cited Findings
- `export type StoreOperationName = "spatialQuery" | "get" | "add" | "put" | "remove";` (@since 2026.1). `query` is excluded because it is always supported. — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- Class doc: "To create a custom store, extend `Store` and implement `query`: it is the only abstract operation. Every other operation is implemented as unsupported - it throws a ProgrammingError … Override an operation to support it, override `isOperationSupported` to report it, and report the changes it makes with `emitStoreChangedEvent`." Also: "overriding an operation without reporting it from isOperationSupported leaves the operation unused: LuciadRIA never calls an operation that the store does not report as supported." — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- Signatures (2026.1):
  - `abstract query(query?: any, options?: QueryOptions): Cursor<TFeature> | Promise<Cursor<TFeature>>`
  - `spatialQuery(bounds?: Bounds, query?: any, options?: QueryOptions): Cursor<TFeature> | Promise<Cursor<TFeature>>`
  - `add(feature: TFeature, options?: any): FeatureId | Promise<FeatureId>`
  - `get(id: FeatureId, options?: any): TFeature | undefined | Promise<TFeature | undefined>`
  - `put(feature: TFeature, options?: any): FeatureId | Promise<FeatureId>`
  - `remove(id: FeatureId): boolean | Promise<boolean>` (no `options` parameter in the base signature)
  - `isOperationSupported(methodName: StoreOperationName): boolean`
  - `on(event: "StoreChanged", callback: (eventType: "add" | "update" | "remove", feature: TFeature, id: FeatureId) => any, context?: any, options?: StoreChangedOptions): Handle`
  - `protected emitStoreChangedEvent(eventType: "add" | "update" | "remove", feature: TFeature | undefined, id: FeatureId): void`
  — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- `QueryOptions` has only `abortSignal?: AbortSignal`. `StoreChangedOptions` has `query?: any`, and the base `on` ignores it ("override this method to filter the events that this store reports"). — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- **add semantics:** on success the store must "Update the Feature.id ID of the Feature to reflect the ID assigned by the server, if the Feature's ID was undefined prior to addition. If an ID was already defined, the Store should respect the provided ID unless overridden by the server." It must emit `StoreChanged` with `"add"`, the added feature (with the updated id), and the updated id. "Failure to do so will result in a map not displaying newly added features." It returns the id or a Promise of the id. — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- **put semantics:** "Updates an existing Feature in the store or adds it if it does not already exist." The store emits `"update"` for an existing feature or `"add"` for a new one. "The implementation of this method may follow the semantics of an HTTP PUT request. This means that if the feature does not already exist in the store, it may be added as a new entry." It returns the id or a Promise of the id. — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- **remove semantics:** on success the store emits `StoreChanged` with `"remove"` and the id; `feature` "should be `undefined`" for remove. It returns `true` or a Promise of `true`. "If the Store does not emit the StoreChanged event, the map visualization will not reflect the removal." — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- **get semantics:** "When no feature with that id exists, the returned value must be `undefined` … (a promise resolving to `undefined`). Reject the promise only for an actual failure, such as a network or parsing error." — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- **isOperationSupported:** "The result must remain stable for the lifetime of the store. A FeatureLayer reads it when it is added to a map, and does not pick up later changes." — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- spatialQuery support also drives the default loading strategy: `LoadSpatially` if it is supported, otherwise `LoadEverything`. — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts), [FeatureLayer.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/feature/FeatureLayer.d.ts)
- Base implementation (shipped JS): each unsupported operation does `throw new ProgrammingError('Store: this store does not support the "add" operation')`, `isOperationSupported(){return false}`, and `emitStoreChangedEvent` calls `this._eventedSupport.emit("StoreChanged", type, feature, id)`. The module also exports a helper `isEditableStore(s) = s.isOperationSupported("add") && s.isOperationSupported("put") && s.isOperationSupported("remove")`. — [Store.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.js)
- Error types available for stores: `ProgrammingError` (unsupported operation or misuse), `RequestError(message, code?, response?)` (HTTP failure; `code` holds the HTTP status and `response` the response, although the JSDoc comments on those two fields are swapped in the .d.ts), `WFSTransactionError` (WFS-T specific), `InvalidXMLError`, all extending `LuciadError`. The `Store` contract does not prescribe an error type for add/put/remove failures; rejection is the implied mechanism. — [error/RequestError.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/error/RequestError.d.ts), [WFSTransactionError.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSTransactionError.d.ts)
- `MemoryStore` reference behavior: synchronous `add`/`put`/`remove` returning `FeatureId`/`boolean`. `add` notes "If an id is present on the feature, the Store may not yet contain a Feature with that same ID". `put` adds when the id is unknown and fires "update" or "add" accordingly. `get` returns `undefined` when the feature is missing. — [MemoryStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/MemoryStore.d.ts)
- `UrlStore` declares only `query` (read-only; `UrlStoreQueryOptions.requestBody` lets a query POST a body), so it is not a write example. — [UrlStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/UrlStore.d.ts)

### Inferences
- For an OGC store, the simplest implementation is: async `add`/`put`/`remove` that perform the HTTP call, set `feature.id` from the server response, call `emitStoreChangedEvent` only after a 2xx response, and otherwise reject (for example with `RequestError`, carrying the HTTP status, which matches the repo's 1.4.0 behavior of "failures with their HTTP status").
- Because `isOperationSupported` must be stable from construction onward, write capability has to be known when the store is created (from an options flag or from a prior capability probe in a `createFromURL`-style factory). It cannot be discovered lazily after the layer is on the map.
- Observation on the local repo: `OgcOpenApiFeatureStore.get` resolves `null` when the feature is missing (`cursor.hasNext() ? cursor.next() : null`), but the 2026.1 contract says it must resolve `undefined`. — [src/OgcOpenApiFeatureStore.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/src/OgcOpenApiFeatureStore.ts) lines 159-166

### Gaps
- No documented guidance on *which* error class a custom store should reject with on write failure, and no documented behavior if a store emits `StoreChanged` with a different id than the one it returns.

## 2. FeatureModel: forwarding, ModelChanged, promises and rejections

### Takeaway
`FeatureModel` is a thin pass-through. Each of `spatialQuery`, `get`, `add`, `put` and `remove` first checks `store.isOperationSupported(op)`, throws `ProgrammingError` if it is not supported, and otherwise returns the store's return value unchanged (sync value or Promise). It does not wrap or catch Promises: rejections reach the caller as-is. `ModelChanged` is a re-emission of `StoreChanged`, so no store event means no model event.

### Cited Findings
- Shipped code: `add(e,t){return this.checkOperationSupported("add"),this._store.add(e,t)}`, with identical patterns for `put(e,t)`, `remove(e)`, `get(e)` and `spatialQuery`. `checkOperationSupported` throws `ProgrammingError('FeatureModel: the store of this model does not support the "add" operation')`. Note that `get(e)` does **not** forward options, and `remove(e)` forwards only the id. — [FeatureModel.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/FeatureModel.js)
- The constructor subscribes `this._store.on("StoreChanged",(type,feature,id)=>this._eventSupport.emitModelChangedEvent(type,feature,id))`. When `on("ModelChanged", cb, ctx, {query})` is called with a query option, it subscribes directly on the store with that options object, which lets a store filter events per query. — [FeatureModel.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/FeatureModel.js)
- Documented: "the FeatureModel fires ModelChanged events when its Store reports its changes on the StoreChanged event. A store that does not report its changes will not produce these events." The signature is `on("ModelChanged", (modelChangeType: "add"|"update"|"remove", feature: Feature, id: FeatureId) => void, context?)`. — [FeatureModel.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/FeatureModel.d.ts)
- `FeatureModel.put` documents `@throws ProgrammingError if the model's store does not support the "put" operation. Check with FeatureModel.isOperationSupported first.` The same applies to add, remove, get and spatialQuery. `FeatureModel.isOperationSupported` (@since 2026.1) delegates to the store. — [FeatureModel.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/FeatureModel.d.ts)
- The constructor only requires that `store.query` is a function. — [FeatureModel.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/FeatureModel.js)

### Inferences
- Yes, `FeatureModel.put` requires store support: it throws synchronously, before calling the store, when `isOperationSupported("put")` is false.
- Since the model adds no retry, rollback or error handling, the store owns all failure semantics. The UI layer (WorkingSet/controllers, section 4) is where rejection becomes visible.

### Gaps
- None for the installed version.

## 3. Built-in WFS-T support in WFSFeatureStore; transaction/batch concepts

### Takeaway
Yes. Since 2026.1, `WFSFeatureStore` implements `add`/`put`/`remove` as WFS 2.0.0 `<wfs:Transaction>` Insert/Update/Delete, with one feature per call. It also offers WFS locking (`lockFeatures`, `queryWithLock`, `WFSLock.release`, `WFSTransactionOptions {lock, releaseAction}`). Capability comes from the WFS capabilities document (the `Transaction`, `LockFeature` and `GetFeatureWithLock` operations, WFS 2.x only). The public API has no multi-operation transaction or batch: the internal builder takes an array of operations, but the public methods send one each.

### Cited Findings
- Class doc: "Store implementation for querying an OGC WFS server and optionally inserting, updating, deleting, and locking features through WFS-T." Editing methods "require a store created through createFromCapabilities or createFromURL, so the store can verify that the server advertises the required operations" and "require WFS 2.0.0 and always send version="2.0.0" requests." — [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts)
- `isOperationSupported(methodName: WFSFeatureStoreOperationName)`, where `WFSFeatureStoreOperationName = StoreOperationName | "lockFeatures" | "queryWithLock"`. Doc: "add, put and remove require a WFS 2.x service that advertises the Transaction operation". Shipped code: `get` and `spatialQuery` are always true; otherwise the result is `_supportsWfs2 && supportedOperations.has(TRANSACTION | LOCK_FEATURE | GET_FEATURE_WITH_LOCK)`. — [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts), [WFSTransactionSupport.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSTransactionSupport.js)
- Options: `transactionURL?` overrides the Transaction endpoint from the capabilities. `transactionCodec?: GMLCodec` encodes transactions. `insertFeatureType?: string | QName` sets the `wfs:Insert` element name. `geometryName?` sets the geometry property used by BBOX filters and transactions. — [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts)
- `add(feature): Promise<FeatureId>`: "Adds a feature … using a <wfs:Transaction> Insert operation. If the server returns a feature ID, the feature's id is updated. @returns the feature ID assigned by the server." The code sets `e.id = insertedIds[0]` (from `InsertResults`/`ResourceId`), then calls `emitStoreChangedEvent("add", e, e.id)` and returns `e.id`. — [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts), [WFSTransactionSupport.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSTransactionSupport.js), [WFSFeatureStore.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.js)
- `put(feature, options?: WFSTransactionOptions): Promise<FeatureId>`: a "<wfs:Transaction> Update operation. All defined properties and the geometry are sent to the server. Set a property to null to clear it. Properties that are undefined or absent from feature.properties are omitted and left unchanged on the server." It throws `WFSTransactionError` "including when no feature matches feature.id" (the code checks `totalUpdated === 0`). In other words, WFS `put` is **update-only** and does not do the upsert that the base contract allows. It emits `"update"`. — [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts), [WFSTransactionSupport.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSTransactionSupport.js)
- `remove(id, options?: WFSTransactionOptions): Promise<boolean>`: a Delete operation with a `ResourceId` filter. It emits `("remove", undefined, id)`. — [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts), [WFSFeatureStore.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.js)
- Errors on writes: `WFSTransactionError` (server rejects the transaction or lock, e.g. an expired lock), `InvalidXMLError`, `RequestError` (HTTP failure not recoverable as an OGC exception), and `ProgrammingError` (operation not advertised, or `feature.shape.reference` differs from the store reference). — [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts), [WFSTransactionError.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSTransactionError.d.ts)
- Locking: `WFSLock { readonly lockId: string; release(): Promise<void> }`, `WFSLockOptions { lockAction?: "ALL"|"SOME"; expiry (seconds) }`, `WFSTransactionOptions { lock?: WFSLock; releaseAction?: "ALL"|"SOME" }` (default "SOME" when a lock is set). — [WFSLock.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSLock.d.ts), [WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts)
- Internally, `WFSTransactionRequestBuilder.buildInsert(e,t)` calls `this.buildTransaction([{type:"insert", feature:e, ...}])`, which takes an array of insert/update/delete ops. No public API exposes multi-op transactions. — [WFSTransactionRequestBuilder.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSTransactionRequestBuilder.js)
- No `.d.ts` in the package mentions ETag or If-Match. The only "batch"/"transaction" hits outside WFS are in 3D Tiles files (unrelated). — grep over `node_modules/@luciad/ria/**/*.d.ts`

### Inferences
- `WFSFeatureStore` is the closest built-in model for an OGC API Features write store. It shows the pattern: decide capability once from service metadata, use a factory method, send one HTTP request per operation, adopt the server-assigned id on insert, use update-only put that fails when the feature is missing, and emit events after server success.
- WFS locks are the only optimistic or pessimistic concurrency concept in LuciadRIA, and they are WFS-specific (`options.lock`). By analogy, an OGC store could accept an ETag through the free-form `options` of `put` (but `remove` has no options in the base or FeatureModel signature).

### Gaps
- Whether WFS `add` with a pre-set `feature.id` sends it (e.g. `idgen`/`fid`) was not determined from the minified code.

## 4. Editing workflow (EditController, CreateController, FeatureLayer.editable, WorkingSet)

### Takeaway
Editing goes through the layer's `WorkingSet`. `CreateController.onObjectCreated` calls `layer.workingSet.add(feature)`, and `EditController.onFinish` calls `layer.workingSet.put(feature)`. The WorkingSet wraps the model call in a Promise that resolves only when the matching `WorkingSetChanged` event arrives (which requires the store's `StoreChanged`). It rejects on store rejection or after a 10 s timeout. `FeatureLayer.editable` defaults to `true` only when the store supports **all three** of add, put and remove. Setting it to `true` otherwise throws.

### Cited Findings
- `FeatureLayerConstructorOptions.editable`: "Whether the new layer is editable, true by default for feature layers." In practice the constructor does `this.editable = isDefined(n.editable) ? n.editable : isEditableStore(model.store)`. The setter throws `ProgrammingError("Cannot set FeatureLayer.editable to true. The FeatureModel's store does not support editing operations (add/put/remove).")` when the store is not editable. — [FeatureLayer.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/feature/FeatureLayer.d.ts), [FeatureLayer.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/feature/FeatureLayer.js), [Store.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.js) (`isEditableStore`)
- `CreateController.onObjectCreated(map, layer, feature)`: "The default implementation of this method adds the created object to the model of the given layer … When the return is a Promise, the controller will deactivate when the promise is resolved or when the promise is rejected." Code: `let r = t.workingSet.add(n); if (isPromise(r)) return this._commitPromise = r.then(()=>{})`. `onChooseLayer` picks the top-most `FeatureLayer` "that is editable and visible". — [CreateController.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/controller/CreateController.d.ts), [CreateController.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/controller/CreateController.js)
- `EditController.onFinish()`: "By default, this calls WorkingSet.put on the layer's workingSet to update the feature in the layer/model. This will return a Promise if there is an asynchronous WorkingSet.put operation on-going." Code: `let e = this._layer.workingSet.put(this._feature); if (isPromise(e)) return e.then(()=>void 0)`. `onDeactivate` returns that Promise. Editing does not start unless `layer.editable` and `layer.visibleInTree`. — [EditController.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/controller/EditController.d.ts), [EditController.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/controller/EditController.js)
- `WorkingSet.add/put/remove` docs: "If this method returns a Promise, then that Promise will resolve once the newly added feature has been added to the working set. This requires that the underlying model generates a change event … If the model does not generate a change event, the Promise will be rejected after an implementation dependent timeout." `put` and `remove` are "supported only if the model's store reports 'put'/'remove' through FeatureModel.isOperationSupported". `remove` returns `FeatureId | Promise<FeatureId>`. — [WorkingSet.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/feature/WorkingSet.d.ts)
- Implementation (WorkingSetUpdater): the wrappers are installed only if `model.isOperationSupported(op)`. Each returns a `new Promise` that listens for `WorkingSetChanged` of the expected type (an `"update"` wait also accepts `"add"`, matching put-as-upsert). It sets a timeout `CRUD_TIMEOUT = 1e4` ms that rejects with `Error("Timed out waiting for confirmation of model <op>")`. It calls `Promise.resolve(transformer[op](model, arg0, arg1))`. If the resolved id is undefined it throws "WorkingSetUpdater: missing feature ID … Please check Store API", and `.catch(e => reject(e))` propagates store rejections. — [WorkingSetUpdater.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/feature/WorkingSetUpdater.js)
- `EditController` docs point to guides on undo/redo (`articles://guide/view/controllers/undoredo.html`) and custom editing (`articles://tutorial/view/controllers/custom_editing.html`). — [EditController.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/controller/EditController.d.ts)

### Inferences
- For the OGC store this means:
  - (a) The store must emit `StoreChanged` with the **same id it returns**. For `add`, that is the server-assigned id. A mismatch makes the WorkingSet wait for the 10 s timeout.
  - (b) Server round-trips longer than 10 s cause a WorkingSet rejection even if the server later succeeds.
  - (c) A collection that supports only POST, or that lacks DELETE, is not editable by default and cannot be forced editable. All of add, put and remove must be reported for the standard controllers to work.
- The app learns that a layer is editable from `layer.editable` (derived from the store) or from `model.isOperationSupported("add"|"put"|"remove")`.
- On rejection, the edited feature object already holds the user's new geometry. LuciadRIA does no rollback, so the app must refresh or restore it (for example, re-`get` the feature).

### Gaps
- How `CreateController` and `EditController` surface rejections to the app beyond the returned Promise (no "EditFailed" event exists in the .d.ts files read).

## 5. Feature id semantics and server-assigned ids

### Takeaway
`FeatureId = string | number`. A feature may be constructed without an id before `add`. The store is responsible for assigning the server id to `feature.id` and returning it. Features returned by queries must have ids.

### Cited Findings
- `export type FeatureId = string | number;` (@since 2023.1). The `id` getter and setter are public. "This ID must uniquely identify the feature within a FeatureModel." The constructor's `id` "can be omitted when creating a new feature, for example, before adding it to a MemoryStore. However, features returned by FeatureModel.query are required to have IDs." — [Feature.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/Feature.d.ts)
- `Store.add`: update `feature.id` to the server-assigned id if it was undefined; respect a provided id "unless overridden by the server". Return the id. — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- `FeatureIDProvider = (feature) => FeatureId` can be passed to GeoJsonCodec/GMLCodec/KMLCodec for decoding. The default codec ids are "unique within a single model" but not globally. — [FeatureIDProvider.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/FeatureIDProvider.d.ts)
- `GeoJsonCodec.encode(cursor): EncodeResult {content: string, contentType: "application/json"}` and `encodeShape(shape)` (which returns a GeoJSON geometry object) are available for building request bodies. — [GeoJsonCodec.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/codec/GeoJsonCodec.d.ts), [Codec.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/codec/Codec.d.ts)

### Inferences
- POST `/collections/{id}/items` returns 201 with a `Location: .../items/{fid}` header in Part 4. The store should parse the last path segment of `Location` (URL-decoded), set `feature.id`, emit `"add"`, and return that id. If the store cannot read the header, it should reject instead of returning undefined, because WorkingSetUpdater throws on a missing id. Note that reading `Location` cross-origin requires the server to send `Access-Control-Expose-Headers: Location`.
- The codec's default id must align with the server's `id` member, otherwise query-decoded ids will not match ids used for PUT/DELETE. A `FeatureIDProvider` or GeoJSON `id` mapping matters here.
- Since `Feature.id` may be a number, path construction must stringify it and URI-encode it (the existing `get` already does `encodeURIComponent(String(id))`).

### Gaps
- No LuciadRIA guidance on whether `add` may change an id that the client pre-assigned, beyond "unless overridden by the server".

## 6. LuciadRIA docs and samples on saving to a server

### Takeaway
I found no retrievable LuciadRIA developer-guide article or "RestStore" sample on saving to a custom server. The authoritative material is the 2026.1 JSDoc in the installed `.d.ts`. Its snippets `StoreSnippets.ts_CAN_ADD` and `StoreSnippets.ts_CUSTOM_STORE` are referenced but not shipped in the package.

### Cited Findings
- `Store.d.ts` references `[[include:model/store/StoreSnippets.ts_CAN_ADD]]` and `[[include:model/store/StoreSnippets.ts_CUSTOM_STORE]]`. The snippet sources are not in the npm package. — [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts)
- The 2026.0.07 Store reference page, as summarized by a search engine, stated that optional methods should be tested with `typeof store.add === "function"` and showed an `add` that emits `StoreChanged`. Fetching that URL now returns HTTP 404. — [LuciadRIA 2026.0.07 Store](https://dev.luciad.com/portal/productDocumentation/LuciadRIA/docs/reference/LuciadRIA/interfaces/_luciad_ria_model_store_Store.Store.html)
- Searches for a LuciadRIA custom/REST store tutorial on dev.luciad.com returned no relevant pages. A [LuciadRIA 2026.0 Beta release guide](https://dev.luciad.com/portal/beta/2026.0/ReleaseGuide_LuciadRIA_2026_0_Beta.pdf) exists but was not shown in search results to cover Store writes.

### Inferences
- The `WFSFeatureStore` 2026.1 implementation, together with the abstract `Store` JSDoc, is the de facto reference design.

### Gaps
- I could not access the dev.luciad.com 2026.1 API reference, the developer guide (e.g. a "custom store" article or the `articles://` guides), or samples. The portal may require login or use different URLs. No release notes for 2026.1 describing the Store API change were found.

## 7. Mapping table: LuciadRIA operation to OGC API - Features Part 4, and gaps

### Takeaway
add maps to POST, put maps to PUT, and remove maps to DELETE. LuciadRIA has no equivalent of PATCH, ETag/If-Match, or batch/transactions. Those must be either store-specific extensions (through the free-form `options`) or left out.

### Cited Findings (LuciadRIA side, all from [Store.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/Store.d.ts) unless noted)

| LuciadRIA call | Contract | OGC API Features Part 4 request | Notes |
|---|---|---|---|
| `isOperationSupported("add")` | stable, read once by the FeatureLayer | Capability: conformance class *Create/Replace/Delete* plus the OpenAPI definition exposing POST on `/collections/{cId}/items` | Must be decided before the layer is added to the map |
| `add(feature, options?)` | assign the server id to `feature.id`, emit `"add"`, return the id | `POST /collections/{cId}/items` with a GeoJSON Feature body (`Content-Type: application/geo+json`), plus `Content-Crs` when the CRS is not CRS84 | Server returns 201 + `Location` and the id comes from it. Needs `Access-Control-Expose-Headers: Location` cross-origin |
| `put(feature, options?)` | update or (optionally) add, emit `"update"` (or `"add"`), return the id | `PUT /collections/{cId}/items/{fId}` with the full feature | Part 4 PUT is a full replacement, while WFS store `put` is update-only (fails when missing) and omits undefined properties ([WFSFeatureStore.d.ts](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSFeatureStore.d.ts)) |
| `remove(id)` | emit `("remove", undefined, id)`, return `true` | `DELETE /collections/{cId}/items/{fId}` | The base and FeatureModel signatures take no options, so there is no place to pass an ETag |
| `get(id, options?)` | `undefined` when not found, reject only on real failure | `GET /collections/{cId}/items/{fId}` (404 means resolve `undefined`) | `FeatureModel.get` drops `options` ([FeatureModel.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/feature/FeatureModel.js)) |
| (none) | no PATCH concept | `PATCH /collections/{cId}/items/{fId}` (Update class, JSON Merge Patch) | Could be a store-specific `put` option (e.g. `{patch: true}`) or a separate store method; not reachable from the controllers |
| (none) | no ETag concept; only WFS `options.lock` exists | `ETag` / `If-Match` optimistic locking | Possible through `put(feature, {ifMatch})`, but not through `remove(id)` via FeatureModel |
| (none) | no public batch/transaction | Part 4 defines none either (single-feature ops) | `WFSFeatureStore` builds multi-op transactions internally only ([WFSTransactionRequestBuilder.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/model/store/WFSTransactionRequestBuilder.js)) |

### Inferences
- Partial server support (e.g. Create but no Delete) leaves `FeatureLayer.editable` false by default and makes it impossible to set true ([FeatureLayer.js](file:///Users/felipe.carrillo.romero/git/ogcopenapis/node_modules/@luciad/ria/view/feature/FeatureLayer.js)), although `model.add` can still be called directly when `isOperationSupported("add")` is true.
- Two choices determine what `put` should do on a 404 from PUT: reject, like `WFSFeatureStore`, or fall back to POST to honor the base "may add" semantics. If it falls back, it must emit `"add"`, and the WorkingSet accepts `"add"` while waiting on an update.
- Emit events only after a 2xx response, and never optimistically: WorkingSet confirmation relies on the event, and no rollback mechanism exists.
- The OGC-side details (status codes, conformance URIs, Content-Crs, ETag rules) should be confirmed against the Part 4 research notes. This file only covers the LuciadRIA side.

### Gaps
- Whether LuciadRIA calls `remove` with extra arguments from WorkingSet: the wrapper passes `(model, s[0], s[1])` to the transformer, but `FeatureModel.remove(e)` forwards only the id, so in practice options do not reach the store.

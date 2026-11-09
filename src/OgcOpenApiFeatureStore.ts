import {type QueryOptions, Store, type StoreOperationName} from '@luciad/ria/model/store/Store.js';
import type {Cursor} from '@luciad/ria/model/Cursor.js';
import {Feature} from '@luciad/ria/model/feature/Feature.js';
import {Bounds} from '@luciad/ria/shape/Bounds.js';
import {Codec, type CodecDecodeOptions} from '@luciad/ria/model/codec/Codec.js';
import {createBounds} from '@luciad/ria/shape/ShapeFactory.js';
import {CoordinateReference} from '@luciad/ria/reference/CoordinateReference.js';
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory.js";
import {OgcOpenApiCrsTools} from "./OgcOpenApiCrsTools.js";
import {OgcOpenApiError} from "./OgcOpenApiError.js";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {GMLCodec} from "@luciad/ria/model/codec/GMLCodec.js";
import type {ProxifyFunction} from "./OgcOpenApiGetCapabilities.js";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools.js";
import type {FeatureId} from "@luciad/ria/model/feature/Feature.js";
import type {Shape} from "@luciad/ria/shape/Shape.js";
import {createPoint} from "@luciad/ria/shape/ShapeFactory.js";
import type {Transformation} from "@luciad/ria/transformation/Transformation.js";

/**
 * The write operations of LuciadRIA's Store that a store can be given (OGC API Features Part 4): add is a POST to the
 * items, put a PUT and remove a DELETE of an item.
 */
export type OgcOpenApiFeatureWriteOperation = "add" | "put" | "remove";

/**
 * A partial update of a feature, sent as a JSON Merge Patch (RFC 7396, OGC API Features Part 4): the properties
 * given replace those of the feature, a property set to null is removed, and geometry, when given, replaces the
 * geometry (null removes it).
 */
export interface OgcOpenApiFeaturePatch {
  properties?: { [name: string]: unknown };
  geometry?: Shape | null;
}

export interface OgcOpenApiFeatureStoreConstructorOptions {
  swapAxes?: string[];
  dataUrl: string;
  featureUrl?: string;
  outputFormat: string;
  useCrs84Bounds?: boolean;
  codec: Codec;
  credentials?: boolean;
  requestHeaders?: { [key: string]: string };
  extent?: { spatial: { bbox: any[] } };
  crs: string;
  proxify?: ProxifyFunction
  // Called once for each query that succeeds, with what the response says about its size
  onQueryResult?: (result: OgcOpenApiFeatureQueryResult) => void;
  // The write operations the store performs, none by default: the store is read-only. LuciadRIA asks once, when a
  // layer is made, so they are fixed here. The server decides on each write: a write it refuses rejects with its
  // status. OgcOpenApiGetCapabilities.fetchWriteSupport suggests them from what the server advertises
  writeOperations?: OgcOpenApiFeatureWriteOperation[];
}

// What the response to a query says about its size (OGC API Features Part 1)
export interface OgcOpenApiFeatureQueryResult {
  // The request, and the query it was made from
  url: string;
  query: OgcOpenApiFeatureStoreQueryOptions;
  // The number of features that match the query, left out when the server gives none (it is optional, PDOK)
  numberMatched?: number;
  // The number of features in the response. Servers cap limit: it can be less than limit (pygeoapi gives 10)
  numberReturned?: number;
  // The response links a next page. Left out when the response has no links to tell: a GML response whose Link
  // header the browser may not read (CORS)
  hasNext?: boolean;
}

export interface OgcOpenApiFeatureStoreQueryOptions {
  f?:string;
  limit?: number;
  offset?: number;
  bbox?: number[];
  "bbox-crs"? : string;
  datetime?: string;
  filter?: string;
  "filter-crs"?: string;
  "filter-lang"?: string;
  crs?: string | any;
  skipGeometry?: boolean;
  properties?: string[];
  sortby?: string[];
  ident?: string;
  name?: string;
  q?: string[];
  maxAllowableOffset?: number;
  level?: string;
  sector?: string;
  milCode?: string;
  localType?: string;
  upperLimitDesc?: number;
  upperLimitValue?: number;
  upperLimitUnit?: string;
  upperLimitCode?: string;
  lowerLimitDesc?: string;
  lowerLimitValue?: number;
  lowerLimitUnit?: string;
  lowerLimitCode?: string;
  onshore?:boolean;
  exclusion?: boolean;
  wkhrCode?: string;
  wkhrRemark?: string;
}

const WRITE_OPERATIONS: OgcOpenApiFeatureWriteOperation[] = ["add", "put", "remove"];

const CRS84_IDENTIFIER = "CRS:84";

interface OgcOpenApiFeaturesCodecDecodeOptions extends CodecDecodeOptions {
  contentCrs?: string;
  contentLength?: number;
}

export class OgcOpenApiFeatureStore extends Store {
  private dataUrl: string;
  private codec: Codec;
  private baseUrl: string;
  private dataFormat: string | undefined;
  // The query of the items link, such as f=json or an api key: kept in every request
  private linkParameters: { [key: string]: string };
  private customCrs: string | undefined;
  private dataBounds: Bounds;
  private requestHeaders: { [key: string]: string };
  private reference: CoordinateReference;
  private outputFormat: string;
  private useCrs84Bounds: boolean;
  private featureUrl: string;
  private proxy: ProxifyFunction;
  private credentials: boolean;
  private serverOptions: { proxy: (url: string, fetchOptions) => { fetchOptions: any; url: string }; hostname: string; complete: (url: string) => string };
  private swapAxes: string[] | undefined;
  private onQueryResult: ((result: OgcOpenApiFeatureQueryResult) => void) | undefined;
  private writeOperations: OgcOpenApiFeatureWriteOperation[];

  constructor(options: OgcOpenApiFeatureStoreConstructorOptions) {
    super();
    // console.log(options);
    this.writeOperations = Array.isArray(options.writeOperations) ?
        WRITE_OPERATIONS.filter(operation => options.writeOperations.indexOf(operation) > -1) : [];
    this.swapAxes = options.swapAxes;
    this.onQueryResult = options.onQueryResult;
    this.useCrs84Bounds = typeof options.useCrs84Bounds !== "undefined" ? options.useCrs84Bounds : false;
    this.dataUrl = options.dataUrl;
    this.outputFormat = options.outputFormat;
    const predictedFeatureUrl =  this.dataUrl.replace(/\.[^/.]+$/, "");

    this.featureUrl = options.featureUrl ? OgcOpenApiFeatureStore.cleanUrl(options.featureUrl, true) : OgcOpenApiFeatureStore.cleanUrl(predictedFeatureUrl, true);

    this.baseUrl = OgcOpenApiFeatureStore.cleanUrl(this.dataUrl);
    this.linkParameters = OgcOpenApiFeatureStore.getQueryParameters(this.dataUrl);
    this.dataFormat = this.linkParameters.f;
    this.customCrs = options.crs === "http://www.opengis.net/def/crs/OGC/1.3/CRS84" ? undefined : options.crs;
    this.codec = options.codec;
    this.requestHeaders = options.requestHeaders ? options.requestHeaders : {};
    const referenceName = OgcOpenApiCrsTools.getReferenceName(options.crs)
    this.reference = getReference(referenceName);
    this.proxy = options.proxify;
    this.credentials = options.credentials;

    this.serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: this.dataUrl, proxify: options.proxify});

    if (
      options.extent &&
      options.extent.spatial &&
      options.extent.spatial.bbox &&
      options.extent.spatial.bbox.length > 0
    ) {
      const bbox = options.extent.spatial.bbox[0];
      const WGS84 = getReference("CRS:84");
      const tmpBounds = createBounds(WGS84, [
        bbox[0],
        bbox[2] - bbox[0],
        bbox[1],
        bbox[3] - bbox[1],
      ]);
      this.dataBounds = OgcOpenApiFeatureStore.targetBounds(tmpBounds, this.reference);
    }
  }

  // Store defines bounds as a getter, the extent is kept in dataBounds
  get bounds(): Bounds {
    return this.dataBounds;
  }

  isOperationSupported(methodName: StoreOperationName): boolean {
    return methodName === "get" || methodName === "spatialQuery" ||
        this.writeOperations.indexOf(methodName as OgcOpenApiFeatureWriteOperation) > -1;
  }

  // A feature the server does not have, a 404, resolves undefined, as LuciadRIA's Store expects. A store that writes
  // asks the server again for each feature: a cache, such as the browser's for ldproxy's immutable items, could give
  // a feature as it was before a write
  get(id: FeatureId, optionsInput?: any): Promise<Feature | undefined> {
    const options = optionsInput ? { ...optionsInput } : {};
    options.query = (options.query ? options.query : {}) as OgcOpenApiFeatureStoreQueryOptions;
    options.query.f = options.query.f ? options.query.f : this.dataFormat;
    options.query.crs = options.query.crs ? options.query.crs : this.customCrs;
    const request = this.withQuery(this.featureUrl + encodeURIComponent(String(id)), {f: options.query.f, crs: options.query.crs});
    const cache: RequestCache | undefined = this.writeOperations.length > 0 ? "no-cache" : undefined;
    return this.fetchFeatures(request, options.abortSignal, undefined, {notFoundIsEmpty: true, cache})
        .then(cursor => cursor && cursor.hasNext() ? cursor.next() : undefined);
  }

  /**
   * Creates the feature on the server: a POST of it to the items, in GeoJSON. The server gives the feature its id, in
   * the Location of its answer: the feature takes that id, the store emits "add", and the promise resolves it. Rejects
   * with an OgcOpenApiError when the server answers anything but 201 or 200 with a Location, with its status.
   */
  add(feature: Feature, options?: any): Promise<FeatureId> {
    return this.whenWritable("add").then(() => {
      const url = this.writeUrl();
      return this.send("POST", url, {
        contentType: "application/geo+json",
        content: JSON.stringify(this.encodeFeature(feature, false)),
      }).then(async response => {
        if (response.status !== 201 && response.status !== 200) throw await OgcOpenApiFeatureStore.failure(response, "POST", url);
        const id = OgcOpenApiFeatureStore.idFromLocation(response.headers.get("Location"));
        if (typeof id === "undefined") {
          throw new OgcOpenApiError("No Location of the created feature in the answer " + response.status + " for POST " + url, {status: response.status, url});
        }
        feature.id = id;
        this.emitStoreChangedEvent("add", feature, id);
        return id;
      });
    });
  }

  /**
   * Replaces the feature on the server: a PUT of it, in GeoJSON, to the item of its id. The id is also in the body,
   * as Part 4 allows. The store emits "update", or "add" when the server answers 201 (it created the feature).
   * Rejects with an OgcOpenApiError when the feature has no id, or with the status of any other answer than 200, 201
   * or 204.
   */
  put(feature: Feature, options?: any): Promise<FeatureId> {
    return this.whenWritable("put").then(() => {
      const id = feature.id;
      if (!OgcOpenApiFeatureStore.hasId(id)) throw new OgcOpenApiError("A feature without an id cannot be replaced");
      const url = this.writeUrl(id);
      return this.send("PUT", url, {
        contentType: "application/geo+json",
        content: JSON.stringify(this.encodeFeature(feature, true)),
      }).then(async response => {
        if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
          throw await OgcOpenApiFeatureStore.failure(response, "PUT", url);
        }
        this.emitStoreChangedEvent(response.status === 201 ? "add" : "update", feature, id);
        return id;
      });
    });
  }

  /**
   * Deletes the feature of id on the server. Resolves true and emits "remove" when the server answers 200 or 204,
   * false when it has no such feature (404). Rejects with an OgcOpenApiError with the status of any other answer.
   */
  remove(id: FeatureId): Promise<boolean> {
    return this.whenWritable("remove").then(() => {
      const url = this.writeUrl(id);
      return this.send("DELETE", url).then(async response => {
        if (response.status === 404) return false;
        if (response.status !== 200 && response.status !== 204) throw await OgcOpenApiFeatureStore.failure(response, "DELETE", url);
        this.emitStoreChangedEvent("remove", undefined, id);
        return true;
      });
    });
  }

  /**
   * Updates part of the feature of id on the server: a PATCH with a JSON Merge Patch (RFC 7396), the update of OGC API
   * Features Part 4. LuciadRIA does not call it: put replaces the whole feature. The store must have put among its
   * write operations. Once the server accepts it, the store reads the feature again, emits "update" with it, and
   * resolves the id. Servers that do not update features answer 405 or 400: it rejects with an OgcOpenApiError with
   * that status, as for any other answer than 200 or 204.
   */
  patch(id: FeatureId, change: OgcOpenApiFeaturePatch): Promise<FeatureId> {
    return this.whenWritable("put").then(() => {
      const url = this.writeUrl(id);
      const body: { properties?: { [name: string]: unknown }, geometry?: any } = {};
      if (change && typeof change.properties !== "undefined") body.properties = change.properties;
      if (change && typeof change.geometry !== "undefined") body.geometry = this.encodeGeometry(change.geometry);
      return this.send("PATCH", url, {contentType: "application/merge-patch+json", content: JSON.stringify(body)})
          .then(async response => {
            if (response.status !== 200 && response.status !== 204) throw await OgcOpenApiFeatureStore.failure(response, "PATCH", url);
            const feature = await this.get(id);
            if (feature) this.emitStoreChangedEvent("update", feature, id);
            return id;
          });
    });
  }

  // Rejects when the store was not given the operation
  private whenWritable(operation: OgcOpenApiFeatureWriteOperation): Promise<void> {
    return this.writeOperations.indexOf(operation) > -1 ? Promise.resolve() :
        Promise.reject(new OgcOpenApiError("The store does not " + operation + " features: " + operation + " is not in its writeOperations"));
  }

  // The items, or the item of id, without the parameters of the items link: they choose a representation to read,
  // such as f or profile, and a write targets the resource itself (ldproxy 4.8 refuses any query parameter on a write)
  private writeUrl(id?: FeatureId) {
    return typeof id === "undefined" ? this.baseUrl : this.featureUrl + encodeURIComponent(String(id));
  }

  // A write request, with the headers and credentials of the app, sent only to the server's own origin. Accept asks
  // for application/problem+json, so that a refusal can tell why
  private send(method: string, url: string, body?: { contentType: string, content: string }) {
    const headers: { [name: string]: string } = {...this.requestHeaders, Accept: "application/problem+json, application/json;q=0.9, */*;q=0.1"};
    if (body) headers["Content-Type"] = body.contentType;
    const init: RequestInit = {method, credentials: OgcOpenApiFetchTools.toFetchCredentials(this.credentials), headers};
    if (body) init.body = body.content;
    return OgcOpenApiFetchTools.fetch(url, init, this.serverOptions, this.requestHeaders);
  }

  private static failure(response: Response, method: string, url: string) {
    return OgcOpenApiError.fromResponse(response, "Invalid response: " + response.status + " for " + method + " " + url, url);
  }

  // A GeoJSON feature in CRS84, the CRS of a write without Content-Crs. withId: the id of the feature, for a PUT
  private encodeFeature(feature: Feature, withId: boolean) {
    const encoded: { type: string, id?: FeatureId, geometry: any, properties: any } = {
      type: "Feature",
      geometry: this.encodeGeometry(feature.shape),
      properties: feature.properties ? feature.properties : {},
    };
    if (withId) return {type: encoded.type, id: feature.id, geometry: encoded.geometry, properties: encoded.properties};
    return encoded;
  }

  // The GeoJSON geometry of shape, its coordinates transformed to CRS84 when the shape is in another reference
  private encodeGeometry(shape: Shape | null | undefined) {
    if (!shape) return null;
    const codec = this.codec instanceof GeoJsonCodec ? this.codec : (this.writeCodec ? this.writeCodec : (this.writeCodec = new GeoJsonCodec()));
    const geometry = codec.encodeShape(shape);
    const reference = shape.reference;
    if (geometry && reference && reference.identifier !== CRS84_IDENTIFIER) {
      OgcOpenApiFeatureStore.transformGeometry(geometry, createTransformation(reference, getReference(CRS84_IDENTIFIER)), reference);
    }
    return geometry;
  }

  private writeCodec: GeoJsonCodec | undefined;

  private static transformGeometry(geometry: any, transformation: Transformation, reference: CoordinateReference) {
    if (!geometry || typeof geometry !== "object") return;
    if (Array.isArray(geometry.geometries)) {
      geometry.geometries.forEach(g => OgcOpenApiFeatureStore.transformGeometry(g, transformation, reference));
    }
    if (Array.isArray(geometry.coordinates)) {
      geometry.coordinates = OgcOpenApiFeatureStore.transformCoordinates(geometry.coordinates, transformation, reference);
    }
  }

  // A position, or nested arrays of positions, transformed
  private static transformCoordinates(coordinates: any[], transformation: Transformation, reference: CoordinateReference): any[] {
    if (coordinates.length > 0 && typeof coordinates[0] === "number") {
      const point = transformation.transform(createPoint(reference, coordinates.slice(0, 3)));
      return coordinates.length > 2 ? [point.x, point.y, point.z] : [point.x, point.y];
    }
    return coordinates.map(c => Array.isArray(c) ? OgcOpenApiFeatureStore.transformCoordinates(c, transformation, reference) : c);
  }

  private static hasId(id: FeatureId | undefined | null) {
    return (typeof id === "number" && isFinite(id)) || (typeof id === "string" && id !== "");
  }

  // The id at the end of the path of a Location, decoded. An integer, written as integers are, is a number, as a
  // GeoJSON id decodes; any other id a string
  private static idFromLocation(location: string | null): FeatureId | undefined {
    if (!location) return undefined;
    const path = location.split("#")[0].split("?")[0].replace(/\/+$/, "");
    const segment = path.substring(path.lastIndexOf("/") + 1);
    if (!segment) return undefined;
    let id: string;
    try {
      id = decodeURIComponent(segment);
    } catch (e) {
      id = segment;
    }
    const n = Number(id);
    return /^-?\d+$/.test(id) && Number.isSafeInteger(n) && String(n) === id ? n : id;
  }

  query(receivedQuery?: OgcOpenApiFeatureStoreQueryOptions, options?: QueryOptions): Cursor | Promise<Cursor> {
    const query = receivedQuery ? { ...receivedQuery } : {};
    query.f = query.f ? query.f : this.dataFormat;
    query.crs = query.crs ? query.crs : this.customCrs;
    query.limit = query.limit ? query.limit : undefined;
    return this.fetchFeatures(this.withQuery(this.baseUrl, query), options?.abortSignal, query) as Promise<Cursor>;
  }

  // The parameters of the items link, then those of the request, which replace a link parameter of the same name.
  // f comes first, every value is encoded
  private withQuery(url: string, parameters: { [key: string]: any }) {
    const merged = {...this.linkParameters};
    for (const key of Object.keys(parameters)) {
      if (typeof parameters[key] !== "undefined" && parameters[key] !== null) merged[key] = parameters[key];
    }
    const keys = Object.keys(merged).sort((a, b) => (a === "f" ? -1 : b === "f" ? 1 : 0));
    if (keys.length === 0) return url;
    return url + "?" + keys.map(k => encodeURIComponent(k) + "=" + OgcOpenApiFetchTools.encodeQueryValue(merged[k])).join("&");
  }

  // Fetches and decodes features. The promise always settles: it rejects with the reason when the request,
  // the response or the decoding fails, and when LuciadRIA aborts the request through abortSignal.
  // A query is reported to onQueryResult once its features are decoded, unless it was aborted
  private fetchFeatures(request: string, abortSignal?: AbortSignal, query?: OgcOpenApiFeatureStoreQueryOptions,
                        fetchOptions?: { notFoundIsEmpty?: boolean, cache?: RequestCache }): Promise<Cursor | null> {
    // Mod starta
    const itemsAccept =
      typeof this.requestHeaders.accept !== 'undefined'
        ? this.requestHeaders.accept.split(';')
        : typeof this.requestHeaders.Accept !== 'undefined'
        ? this.requestHeaders.Accept.split(';')
        : [];
    itemsAccept.push(this.outputFormat);
    const accept = itemsAccept.join(';');
    // Mod end
    const headers = { ...this.requestHeaders, Accept: accept };
    const init: RequestInit = {
      method: 'GET',
      credentials: OgcOpenApiFetchTools.toFetchCredentials(this.credentials),
      headers,
      signal: abortSignal,
    };
    if (fetchOptions && fetchOptions.cache) init.cache = fetchOptions.cache;
    return OgcOpenApiFetchTools.fetch(request, init, this.serverOptions).then(async (response) => {
      if (response.status === 404 && fetchOptions && fetchOptions.notFoundIsEmpty) return null;
      if (response.status !== 200) {
        throw await OgcOpenApiError.fromResponse(response, "Invalid response: " + response.status + " for " + request, request);
      }
      return response.text().then((content) => {
        let contentType = response.headers.get('Content-Type');
        const contentCrs = response.headers.get('content-crs') ? response.headers.get('content-crs') : this.customCrs;
        const contentLengthStr = response.headers.get('Content-Length');
        const contentLength = Number(contentLengthStr);
        contentType = contentType ? contentType : 'text/plain';
        // GeoJsonCodec reads the CRS84 URI, GML is given the URN
        content = content
          .split('srsName="http://www.opengis.net/def/crs/OGC/1.3/CRS84"')
          .join('srsName="urn:ogc:def:crs:OGC:1.3:CRS84"');
        const codecOptions: OgcOpenApiFeaturesCodecDecodeOptions = {
          content, contentType, contentCrs, contentLength
        };
        const cursor = this.codec instanceof GeoJsonCodec || this.codec instanceof GMLCodec ?
            this.codec.decode({...codecOptions, reference: getReference(OgcOpenApiCrsTools.getReferenceName(contentCrs))}) :
            this.codec.decode(codecOptions);
        if (query && this.onQueryResult && !abortSignal?.aborted) {
          this.onQueryResult({url: request, query, ...OgcOpenApiFeatureStore.getResultSize(content, contentType, response.headers.get('Link'))});
        }
        return cursor;
      });
    });
  }

  spatialQuery(
    bounds?: Bounds,
    receivedQuery?: OgcOpenApiFeatureStoreQueryOptions,
    options?: QueryOptions
  ): Promise<Cursor> | Cursor {
    const query = (receivedQuery ? { ...receivedQuery } : {}) as OgcOpenApiFeatureStoreQueryOptions;
    delete query.bbox;
    query.limit = query.limit ? query.limit : undefined;
    if (bounds) {
      if (this.useCrs84Bounds) {
        const crs84Bounds = OgcOpenApiFeatureStore.getCRS84BoundingBox(bounds);
        query.bbox = query.bbox
            ? query.bbox
            : [
              crs84Bounds.x,
              crs84Bounds.y,
              crs84Bounds.x + crs84Bounds.width,
              crs84Bounds.y + crs84Bounds.height,
            ];
      } else {
        query.bbox = query.bbox
            ? query.bbox
            : [
              bounds.x,
              bounds.y,
              bounds.x + bounds.width,
              bounds.y + bounds.height,
            ];
        if (this.customCrs) {
          query["bbox-crs"] = this.customCrs;
        }
        const referenceName = OgcOpenApiCrsTools.getReferenceName(this.customCrs);
        if (this.swapAxes && this.swapAxes.findIndex(f=>f===referenceName)>-1) {
          query.bbox = [query.bbox[1], query.bbox[0],query.bbox[3], query.bbox[2]]
        }
      }
    }
    return this.query(query, options);
  }

  // The size of a response: the members of a JSON response, or the attributes of the root element of GML, and the
  // next link of the response or of its Link header
  private static getResultSize(content: string, contentType: string, linkHeader: string | null) {
    const size: { numberMatched?: number, numberReturned?: number, hasNext?: boolean } = {};
    const count = (value: any) => {
      const n = typeof value === "string" ? (/^\d+$/.test(value) ? Number(value) : undefined) : value;
      return typeof n === "number" && isFinite(n) && n >= 0 ? n : undefined;
    };
    if (/json/i.test(contentType)) {
      let data: any;
      try {
        data = JSON.parse(content);
      } catch (e) {
        data = undefined;
      }
      if (data && typeof data === "object") {
        size.numberMatched = count(data.numberMatched);
        size.numberReturned = count(data.numberReturned);
        if (Array.isArray(data.links)) size.hasNext = data.links.some(l => l && l.rel === "next");
      }
    } else if (/xml/i.test(contentType)) {
      // WFS 2.0 allows numberMatched="unknown"
      const root = /<(?:[\w.-]+:)?FeatureCollection\b([^>]*)>/.exec(content);
      const attribute = (name: string) => {
        const match = root ? new RegExp("\\s" + name + "=[\"']([^\"']*)[\"']").exec(root[1]) : null;
        return match ? count(match[1]) : undefined;
      };
      size.numberMatched = attribute("numberMatched");
      size.numberReturned = attribute("numberReturned");
    }
    if (linkHeader) {
      const next = linkHeader.split(/,\s*(?=<)/).some(link => {
        const rel = /;\s*rel\s*=\s*"?([^";]*)"?/i.exec(link);
        return rel !== null && rel[1].split(/\s+/).indexOf("next") > -1;
      });
      size.hasNext = size.hasNext || next;
    }
    for (const key of Object.keys(size)) if (typeof size[key] === "undefined") delete size[key];
    return size;
  }

  private static getCRS84BoundingBox(shape: Bounds) {
    const WGS84 = getReference("CRS:84");
    const bounds = shape.bounds;
    const toWgs84 = createTransformation(bounds.reference, WGS84);
    return toWgs84.transformBounds(bounds);
  }

  private static targetBounds(bounds: Bounds, targetReferenceBounds: CoordinateReference) {
    const WGS84 = getReference("CRS:84");
    const toTargetReference = createTransformation(WGS84, targetReferenceBounds);
    return toTargetReference.transformBounds(bounds);
  }

  private static cleanUrl(dataUrl: string, addSlash=false) {
    const parts = dataUrl.split('?');
    return parts[0].endsWith('/') ? parts[0] : (addSlash ? parts[0] + '/' : parts[0]);
  }

  private static getQueryParameters(url: string) {
    const parameters: { [key: string]: string } = {};
    const query = url.split("?")[1];
    if (query) new URLSearchParams(query).forEach((value, key) => parameters[key] = value);
    return parameters;
  }
}

export type {
  OgcOpenApiFeaturesCodecDecodeOptions
}

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
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {GMLCodec} from "@luciad/ria/model/codec/GMLCodec.js";
import type {ProxifyFunction} from "./OgcOpenApiGetCapabilities.js";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools.js";

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

interface OgcOpenApiFeaturesCodecDecodeOptions extends CodecDecodeOptions {
  contentCrs?: string;
  contentLength?: number;
}

export class OgcOpenApiFeatureStore extends Store {
  private dataUrl: string;
  private codec: Codec;
  private baseUrl: string;
  private dataFormat: string | undefined;
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

  constructor(options: OgcOpenApiFeatureStoreConstructorOptions) {
    super();
    // console.log(options);
    this.swapAxes = options.swapAxes;
    this.useCrs84Bounds = typeof options.useCrs84Bounds !== "undefined" ? options.useCrs84Bounds : false;
    this.dataUrl = options.dataUrl;
    this.outputFormat = options.outputFormat;
    const predictedFeatureUrl =  this.dataUrl.replace(/\.[^/.]+$/, "");

    this.featureUrl = options.featureUrl ? OgcOpenApiFeatureStore.cleanUrl(options.featureUrl, true) : OgcOpenApiFeatureStore.cleanUrl(predictedFeatureUrl, true);

    this.baseUrl = OgcOpenApiFeatureStore.cleanUrl(this.dataUrl);
    this.dataFormat = OgcOpenApiFeatureStore.dataFormatInQuery(this.dataUrl);
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
    return methodName === "get" || methodName === "spatialQuery";
  }

  get(id: number | string, optionsInput?: any): Promise<Feature> {
    const options = optionsInput ? { ...optionsInput } : {};
    options.query = (options.query ? options.query : {}) as OgcOpenApiFeatureStoreQueryOptions;
    options.query.f = options.query.f ? options.query.f : this.dataFormat;
    options.query.crs = options.query.crs ? options.query.crs : this.customCrs;
    let request = this.featureUrl + id;
    const simpleQuery = [];
    if (options.query.f) simpleQuery.push("f");
    if (options.query.crs) simpleQuery.push("crs");
    if (simpleQuery.length > 0) {
      const queryString = simpleQuery.map( k => ""+k+"="+options.query[k]).join("&");
      request += "?" + queryString;
    }
    return this.fetchFeatures(request, options.abortSignal).then(cursor => cursor && cursor.hasNext() ? cursor.next() : null);
  }

  query(receivedQuery?: OgcOpenApiFeatureStoreQueryOptions, options?: QueryOptions): Cursor | Promise<Cursor> {
    const query = receivedQuery ? { ...receivedQuery } : {};
    query.f = query.f ? query.f : this.dataFormat;
    query.crs = query.crs ? query.crs : this.customCrs;
    query.limit = query.limit ? query.limit : undefined;
    let request = this.baseUrl;

    const allKeys = Object.keys(query);
    if (allKeys.length>0) {
      const filteredKeys = allKeys.filter(e => (typeof query[e] !== "undefined" && query[e] !== null));
      const indexOfFormat = filteredKeys.indexOf("f");
      if (indexOfFormat > -1) {
        filteredKeys.splice(indexOfFormat, 1);
        filteredKeys.unshift("f");
      }
      const queryString = filteredKeys.map( k => ""+k+"="+query[k]).join("&");
      request += "?" + queryString;
    }
    return this.fetchFeatures(request, options?.abortSignal);
  }

  // Fetches and decodes features. The promise always settles: it rejects with the reason when the request,
  // the response or the decoding fails, and when LuciadRIA aborts the request through abortSignal.
  private fetchFeatures(request: string, abortSignal?: AbortSignal): Promise<Cursor> {
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
    return OgcOpenApiFetchTools.fetch(request, {
      method: 'GET',
      credentials: this.credentials ? "same-origin": "omit",
      headers,
      signal: abortSignal,
    }, this.serverOptions).then((response) => {
      if (response.status !== 200) {
        throw new Error("Invalid response: " + response.status + " for " + request);
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
        if (this.codec instanceof GeoJsonCodec || this.codec instanceof GMLCodec) {
          return this.codec.decode({...codecOptions, reference: getReference(OgcOpenApiCrsTools.getReferenceName(contentCrs))});
        }
        return this.codec.decode(codecOptions);
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

  private static dataFormatInQuery(dataUrl: string) {
    let format;
    const parts = dataUrl.split('?');
    if (parts.length > 1) {
      const query = parts[1];
      const qs = query.split('&');
      for (const q of qs) {
        if (q.startsWith('f=')) {
          format = q.slice(2);
          return format;
        }
      }
    }
    return format;
  }
}

export type {
  OgcOpenApiFeaturesCodecDecodeOptions
}

import {type FetchServerOptions, OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools.js";
const SCALE_DENOMINATOR_TOLERANCE = 1e-8;

type RequestHeaders = {[headerName: string]: string;} | null
export interface LinkType {
  rel: string;
  type: string;
  title: string;
  href: string;
  // The profiles of the representation, such as JSON-FG for application/geo+json (ldproxy)
  profile?: string | string[];
}

// JSON-FG, OGC Features and Geometries JSON: a media type of its own, or application/geo+json with the JSON-FG profile.
// Reading it needs a JSON-FG codec, GeoJsonCodec reads GeoJSON
export const JSON_FG_MEDIA_TYPE = "application/vnd.ogc.fg+json";
export const JSON_FG_PROFILE = "http://www.opengis.net/def/profile/OGC/0/jsonfg";

// The conformance class of OGC API Tiles for the collections parameter of dataset tiles (OGC 20-057, Table 7)
export const COLLECTIONS_SELECTION_CONFORMANCE = "http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collections-selection";
// The same class under another name, also accepted. Not in the standard: ldproxy declares it so, and supports the
// collections parameter as the standard requires. To be removed once ldproxy declares the class of the standard
export const COLLECTIONS_SELECTION_CONFORMANCE_VARIANTS = ["http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collection-selection"];

// The conformance class of OGC API Features Part 3 for the filter parameter of the items of a collection
export const FEATURES_FILTER_CONFORMANCE = "http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/features-filter";
// The conformance classes of CQL2 1.0 (OGC 21-065) share this prefix, the encodings and the levels of the language
export const CQL2_CONFORMANCE_PREFIX = "http://www.opengis.net/spec/cql2/1.0/conf/";
// The CQL2 encodings, as conformance classes name them. They are also the values of the filter-lang parameter
export const CQL2_ENCODINGS = ["cql2-text", "cql2-json"];

export interface OgcOpenApiFilterSupport {
  // The server declares the Features Filter class of OGC API Features Part 3: the items of its collections take a filter
  filter: boolean;
  // The CQL2 encodings the server declares, cql2-text or cql2-json
  encodings: string[];
  // The other CQL2 classes the server declares, such as basic-cql2, advanced-comparison-operators or spatial-functions
  levels: string[];
}

// The queryables of a collection (OGC API Features Part 3): a JSON Schema, as the server sends it. Each property has
// a JSON Schema of its own, with type, format, title, enum or x-ogc-role among others
export interface OgcOpenApiQueryables {
  $schema?: string;
  $id?: string;
  type?: string;
  title?: string;
  properties?: { [name: string]: { [keyword: string]: any } };
  [keyword: string]: any;
}

// The media types of a queryables document, in the order they are preferred
const QUERYABLES_MEDIA_TYPES = ["application/schema+json", "application/json"];

export interface TileMatrix {
  id: string,
  scaleDenominator: number;
  cellSize: number;
  cornerOfOrigin: string;
  pointOfOrigin: number[];
  matrixWidth: number;
  matrixHeight: number;
  tileWidth: number;
  tileHeight: number;
  variableMatrixWidths: {
    coalesce: number;
    minTileRow: number;
    maxTileRow: number;
  }[]
}
export interface TileSetData {
  id: string;
  title: string;
  uri: string;
  crs: string;
  orderedAxes: string[];
  tileMatrices: TileMatrix[];
  boundingBox: {
    lowerLeft: number[],
    upperRight: number[],
  }
}

export interface TileSetLayer {
  id: string;
  title?: string;
  dataType?: string;
  geometryDimension?: number;
  minTileMatrix?: string;
  maxTileMatrix?: string;
}

// A tileset of a collection, as listed in its tilesets (/collections/{collectionId}/tiles)
export interface CollectionTileSetInfo {
  // The URI of the tile matrix set, which identifies it whatever id the server gives it
  tileMatrixSetURI?: string;
  tileMatrixSetId?: string;
  dataType?: string;
  crs?: string;
  // The tileset itself, its self link
  href: string;
  // The definition of the tile matrix set, when the server links it
  tilingSchemeHref?: string;
  // The definition of the tile matrix set, when the tileset includes it
  tileMatrixSet?: TileSetData;
}

export interface CollectionTileSet {
  dataType?: string;
  links: LinkType[];
  layers: TileSetLayer[];
  tileMatrixSetLimits?: TileMatrixLimits[];
  // Where the data is, when the server tells: in the CRS of boundingBox.crs, or of the tile matrix set
  boundingBox?: {lowerLeft: number[], upperRight: number[], crs?: string};
}

export interface TileMatrixLimits {
  tileMatrix: string;
  minTileRow: number;
  maxTileRow: number;
  minTileCol: number;
  maxTileCol: number;
}

export interface TileSetMeta {
  id: string;
  title: string;
  links: LinkType[];
}

export interface OgcOpenApiCapabilitiesObject {
  name: string;
  collections: OgcOpenApiCapabilitiesCollection[];
  version: string;
  service: string;
  info: any;
  crs?: any[];
  baseUrl: string;
  // The landing page link to the tile matrix sets (rel tiling-schemes)
  tileMatrixSetsUrl?: string;
  // The links of the landing page, to the tilesets and styles of the dataset among others
  links?: LinkType[];
  // The conformance classes the server declares, empty when it declares none or they cannot be read
  conformsTo?: string[];
  serverOptions: FetchServerOptions;
}

export interface OgcOpenApiCapabilitiesCollection {
  id: string;
  name: string;
  title: string;
  defaultReference: string;
  outputFormats: string[];
  description: string;
  keywords: string[];
  links: OgcOpenApiCapabilitiesCollectionServiceLinkType[];
  extent: any;
  crs?: any;
  storageCrs?: any;
}

export interface OgcOpenApiCapabilitiesCollectionServiceLinkType {
  rel: string;
  type: string;
  title: string;
  href: string;
  profile?: string | string[];
}

export enum CollectionLinkType {
  Items = 'items',
  Styles = 'styles',
  Map = 'map',
  Tiles = 'tiles',
  VectorTiles = 'vectorTiles',
}

const CollectionLinkTypeAlternatives = {
  [CollectionLinkType.Items]: ["items", "item"],
  [CollectionLinkType.Styles]: ["http://www.opengis.net/def/rel/ogc/1.0/styles", "styles"],
  [CollectionLinkType.Map]: ["http://www.opengis.net/def/rel/ogc/1.0/map", "map"],
  [CollectionLinkType.Tiles]: ["http://www.opengis.net/def/rel/ogc/1.0/tilesets-map", "tilesets-map"],
  [CollectionLinkType.VectorTiles]: ["http://www.opengis.net/def/rel/ogc/1.0/tilesets-vector", "tilesets-vector"],
}

// OGC API link relations are given in full or, by older servers, short: tiling-scheme or http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme
const OGC_REL = "http://www.opengis.net/def/rel/ogc/1.0/";
const isRel = (link: LinkType, rel: string) => link.rel === OGC_REL + rel || link.rel === rel;

const CollectionLinkTypeDefaultFormat = {
  [CollectionLinkType.Map]: "image/png",
  [CollectionLinkType.Tiles]: "image/png",
  [CollectionLinkType.VectorTiles]: "application/vnd.mapbox-vector-tile",
}

interface FetchLinkContentOptions {
  hostUrl: string;
  credentials?: boolean;
  requestHeaders?: {
    [headerName: string]: string;
  } | null;
}

export type ProxifyFunction = (url: string, fetchOptions: RequestInit) => {
  url: string;
  fetchOptions: RequestInit;
}

export interface OgcOpenApiGetCapabilitiesFromURL {
  filterCollectionsByLinkType?: CollectionLinkType
  credentials?: boolean;
  requestHeaders?: {
    [headerName: string]: string;
  } | null;
  proxify?: ProxifyFunction
}

export class OgcOpenApiGetCapabilities {

  /**
   * Reads the landing page of a server, its collections, the API document and the conformance classes, asking for
   * JSON. Rejects with an Error when the landing page or the collections cannot be read, and with the error of the
   * request as it is when it fails, an AbortError included. The API document and the conformance classes are
   * optional: without them the capabilities have no version and declare no conformance classes.
   */
  public static async fromURL(inputRequest: string, fromUrlOptions?: OgcOpenApiGetCapabilitiesFromURL): Promise<OgcOpenApiCapabilitiesObject> {
    const options: OgcOpenApiGetCapabilitiesFromURL = fromUrlOptions ? fromUrlOptions : {};
    // The landing page, with the query it was given, such as an api key. baseUrl is without it
    const baseUrl = OgcOpenApiFetchTools.cleanUrl(inputRequest);
    const requestUrl = OgcOpenApiFetchTools.appendPath(inputRequest, "");
    const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: requestUrl, proxify: options.proxify});
    // The requests before the capabilities exist
    const server = {serverOptions} as OgcOpenApiCapabilitiesObject;
    const getJson = (href: string, accept?: string) =>
        OgcOpenApiGetCapabilities.fetchJson(server, href, options, accept).catch(e => {
          throw OgcOpenApiGetCapabilities.toError(e, href);
        });

    const landing = await getJson(requestUrl);
    if (!landing || !Array.isArray(landing.links)) throw new Error("Invalid format: (property 'links' is missing) in " + requestUrl);
    const links: OgcOpenApiCapabilitiesCollectionServiceLinkType[] = landing.links;
    const linkToData = links.find(link => link.rel === 'data' && link.type === 'application/json') || links.find(link => link.rel === 'data');
    if (!linkToData) throw new Error("Invalid format: (property 'links' contains no links with rel=data) in " + requestUrl);
    const linkToApi = links.find(link => (link.rel === 'service-desc' || link.rel === 'service') && (link.type || "").indexOf('openapi+json') > -1);
    const tilingSchemes = links.filter(link => isRel(link, 'tiling-schemes'));
    const linkToTileMatrixSets = tilingSchemes.find(link => link.type === 'application/json') || tilingSchemes.find(link => !link.type);
    const conformance = links.find(link => isRel(link, 'conformance'));
    // The links of the landing page are relative to it, the links of the collections to /collections
    const resolveLink = (link: OgcOpenApiCapabilitiesCollectionServiceLinkType, documentUrl: string) =>
        ({...link, href: OgcOpenApiFetchTools.resolveUrl(link.href, documentUrl, serverOptions)});
    const collectionsLink = resolveLink(linkToData, requestUrl);

    // The collections are required, the API document (in its own media type) and the conformance classes are not
    const [collectionsDocument, api, conformsTo] = await Promise.all([
      getJson(collectionsLink.href),
      linkToApi ? getJson(resolveLink(linkToApi, requestUrl).href, linkToApi.type).catch(() => undefined) : Promise.resolve(undefined),
      conformance ?
          getJson(resolveLink(conformance, requestUrl).href).then(data => Array.isArray(data.conformsTo) ? data.conformsTo as string[] : [], () => [] as string[]) :
          Promise.resolve([] as string[]),
    ]);
    if (!collectionsDocument || !Array.isArray(collectionsDocument.collections)) {
      throw new Error("Invalid format: (property 'collections' is missing) in " + collectionsLink.href);
    }

    const crsArray = typeof collectionsDocument.crs !== "undefined" ? {crs: collectionsDocument.crs} : {};
    const foundCollections = collectionsDocument.collections
        .filter(c => options.filterCollectionsByLinkType ?
            OgcOpenApiGetCapabilities.filterCollectionLinks(c.links, options.filterCollectionsByLinkType).length > 0 : true)
        .map((collection: any) => {
          const name = typeof collection.id !== 'undefined' ? collection.id : collection.name;
          const collectionCrsObject = {} as any;
          if (typeof collection.crs !== "undefined") collectionCrsObject.crs = collection.crs;
          if (typeof collection.storageCrs !== "undefined") collectionCrsObject.storageCrs = collection.storageCrs;
          const layer: OgcOpenApiCapabilitiesCollection = {
            description: collection.description,
            id: name,
            name,
            title: collection.title,
            keywords: OgcOpenApiGetCapabilities.readKeywords(collection.keywords),
            defaultReference: 'CRS:84',
            links: collection.links,
            outputFormats: options.filterCollectionsByLinkType ?
                this.filterCollectionLinks(collection.links, options.filterCollectionsByLinkType).map(link => this.detectTypeFormat(link)) :
                collection.links.map(link => this.detectTypeFormat(link)),
            extent: collection.extent,
            ...collectionCrsObject
          };
          return layer;
        });
    return {
      name: '',
      collections: foundCollections.map(col => ({...col, crs: col.crs ? col.crs : [], links: col.links.map(l => resolveLink(l, collectionsLink.href))})),
      version: api ? api.openapi : '',
      service: '',
      info: api ? api.info : {},
      ...crsArray,
      serverOptions: serverOptions,
      links: links.map(l => resolveLink(l, requestUrl)),
      baseUrl,
      tileMatrixSetsUrl: linkToTileMatrixSets ? resolveLink(linkToTileMatrixSets, requestUrl).href : undefined,
      conformsTo,
    };
  }

  // The keywords of a collection, always strings. OGC API Common Part 2 defines keywords as an array of strings, kept
  // as they are. Also accepted, not in the standard: a keyword as an object with a string keyword, the shape of OGC Web
  // Services Common that PDOK sends ({"keyword": "bak"}), read as that string. Anything else is left out, and a value
  // that is not an array gives no keywords
  private static readKeywords(keywords: any): string[] {
    if (!Array.isArray(keywords)) return [];
    return keywords
        .map(k => typeof k === "string" ? k : k && typeof k === "object" && typeof k.keyword === "string" ? k.keyword : undefined)
        .filter(k => typeof k === "string" && k !== "");
  }

  // An Error for a failed request of fromURL: the error of fetch as it is, such as an AbortError, otherwise its message
  // and the URL. An error of fetch can come from another realm (a DOMException of jsdom is not instanceof Error), so
  // anything with a name and a message is kept; the {error, message} of fetchJson has no name
  private static toError(e: any, href: string): Error {
    if (e instanceof Error || (e && typeof e.name === "string" && typeof e.message === "string")) return e;
    return new Error((e && e.message ? e.message : String(e)) + " for " + href);
  }

  static filterCollectionLinks(
    links: OgcOpenApiCapabilitiesCollectionServiceLinkType[],
    linkType: CollectionLinkType
  ) {
    switch (linkType) {
      case CollectionLinkType.Items:
      case CollectionLinkType.Map:
      case CollectionLinkType.Styles:
      case CollectionLinkType.Tiles:
      case CollectionLinkType.VectorTiles:
        return links.filter((link: any) => CollectionLinkTypeAlternatives[linkType].some(e=>e===link.rel));
      default:
        return [];
    }
  }

  public static getDataLink(
    currentLayer: OgcOpenApiCapabilitiesCollection,
    preferedFormat: string
  ) {
    const dataLink = OgcOpenApiGetCapabilities.filterCollectionLinks(
      currentLayer.links,
      CollectionLinkType.Items
    ).find((link) => link.type === preferedFormat);
    return dataLink ? dataLink.href : '';
  }

  /**
   * Whether the link is to JSON-FG: by its media type, or by the JSON-FG profile of an application/geo+json link
   */
  public static isJsonFgLink(link: LinkType) {
    const type = link.type ? link.type.toLowerCase() : "";
    const profiles = Array.isArray(link.profile) ? link.profile : link.profile ? [link.profile] : [];
    return type.indexOf(JSON_FG_MEDIA_TYPE) === 0 || profiles.indexOf(JSON_FG_PROFILE) > -1;
  }

  // JSON-FG is reported as JSON-FG also when the server types it application/geo+json with the JSON-FG profile
  private static detectTypeFormat(link: OgcOpenApiCapabilitiesCollectionServiceLinkType) {
    if (link.type && OgcOpenApiGetCapabilities.isJsonFgLink(link) && link.type.indexOf(JSON_FG_MEDIA_TYPE) !== 0) return JSON_FG_MEDIA_TYPE;
    if (link.type) return link.type;
    for (const key in CollectionLinkTypeAlternatives) {
      if (CollectionLinkTypeAlternatives.hasOwnProperty(key) && CollectionLinkTypeAlternatives[key].some(e=>e===link.rel)) {
        if (CollectionLinkTypeDefaultFormat[key]) return CollectionLinkTypeDefaultFormat[key];
        break;
      }
    }
    return "application/json"
  }

  /**
   * The tile matrix sets of the server, with their definitions. A definition that cannot be read is left out, so one
   * broken definition does not hide the others. Rejects only when none can be read.
   */
  public static async fetchTileSetsInFull(capabilities: OgcOpenApiCapabilitiesObject | null, options?:{credentials?:boolean, requestHeaders?: RequestHeaders}) {
    const tileSetMetaArray = await this.fetchTileSets(capabilities, options);
    const settled = await Promise.all(tileSetMetaArray.map(tml => this.fetchTileset(capabilities, tml, options).then(
        tileSet => ({tileSet, error: undefined}),
        error => ({tileSet: undefined as TileSetData, error})
    )));
    const tileSets = settled.filter(s => s.tileSet).map(s => s.tileSet);
    const failed = settled.find(s => !s.tileSet);
    if (tileSets.length === 0 && failed) throw failed.error;
    return tileSets;
  }

  public static getQuadTreeCompatibleLevelOffset(tileMatrixSet: TileSetData) {
    const levels = tileMatrixSet.tileMatrices;
    const reference = levels[levels.length - 1];

    for (let level = levels.length - 2; level >= 0; level--) {
      const current = levels[level];

      // tslint:disable-next-line:no-bitwise
      const multiplier = 1 << (levels.length - level - 1);

      const errorMargin = current.scaleDenominator * SCALE_DENOMINATOR_TOLERANCE;
      if (Math.abs(current.scaleDenominator - reference.scaleDenominator * multiplier) > errorMargin) {
        return level + 1;
      }

      if (current.pointOfOrigin[0] !== reference.pointOfOrigin[0]) {
        return level + 1;
      }

      if (current.tileWidth !== reference.tileWidth || current.tileHeight !== reference.tileHeight) {
        return level + 1;
      }

      if (typeof current.variableMatrixWidths!=="undefined") {
        return level + 1;
      }

      if (current.matrixWidth !== (reference.matrixWidth / multiplier) || current.matrixHeight !== (reference.matrixHeight / multiplier)) {
        return level + 1;
      }
    }
    return 0;
  }

  private static async fetchTileSets(capabilities: OgcOpenApiCapabilitiesObject | null, options?:{credentials?:boolean, requestHeaders?: RequestHeaders}): Promise<TileSetMeta[]> {
    if (capabilities === null) throw {error: true, message: "No capabilities"};
    const url = capabilities.tileMatrixSetsUrl ? capabilities.tileMatrixSetsUrl : capabilities.baseUrl + "tileMatrixSets";
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, url, options);
    if (!data.tileMatrixSets) throw {error: true, message: "tileMatrixSets not defined"};
    const resolve = (href: string) => OgcOpenApiFetchTools.resolveUrl(href, url, capabilities.serverOptions);
    return data.tileMatrixSets.map(tml => ({
      ...tml,
      href: resolve(tml.href),
      links: (tml.links ? tml.links : []).map(l => ({...l, href: resolve(l.href)}))
    }));
  }

  // GETs a JSON document. Servers answer JSON for the Accept header, or for the f parameter that their links carry.
  // accept is the media type to ask for, application/json by default; requestHeaders can replace it. A failed request
  // rejects with the error of fetch as it is, such as an AbortError
  private static async fetchJson(capabilities: OgcOpenApiCapabilitiesObject, href: string, options?: {credentials?: boolean, requestHeaders?: RequestHeaders},
                                 accept = "application/json") {
    const result = await OgcOpenApiFetchTools.fetch(href, {
      method: "GET",
      credentials: options?.credentials ? "same-origin" : "omit",
      headers: {Accept: accept, ...(options?.requestHeaders ? options.requestHeaders : {})}
    }, capabilities.serverOptions);
    if (result.status !== 200) throw {error: true, message: "Invalid response: " + result.status};
    try {
      return await result.json();
    } catch (err) {
      throw {error: true, message: "Not JSON data"};
    }
  }

  // The link that identifies the tile matrix set of a tileset, relative to the document that has it
  private static getTilingSchemeHref(capabilities: OgcOpenApiCapabilitiesObject, links: LinkType[], documentUrl: string) {
    const tilingScheme = links.find(l => isRel(l, "tiling-scheme"));
    return tilingScheme ? OgcOpenApiFetchTools.resolveUrl(tilingScheme.href, documentUrl, capabilities.serverOptions) : undefined;
  }

  public static getTilesLink (
      capabilities: OgcOpenApiCapabilitiesObject | null,
      currentCollection: OgcOpenApiCapabilitiesCollection,
      tileMatrixId: string,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders},
      linkType: CollectionLinkType = CollectionLinkType.Tiles
  ) {
    return this.fetchCollectionTileSet(capabilities, currentCollection, tileMatrixId, options, linkType).then(tileSet => tileSet.links);
  }

  // The tilesets link of a collection, the JSON one when the server types its links
  private static getTileSetsHref(collection: OgcOpenApiCapabilitiesCollection, linkType: CollectionLinkType) {
    const dataLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, linkType);
    const link = dataLinks.find((link) => link.type === "application/json");
    return link ? link.href : dataLinks.length > 0 ? dataLinks[0].href : '';
  }

  // The tilesets link of the landing page: the tilesets of the dataset, with all its collections in each tile
  private static getDatasetTileSetsHref(capabilities: OgcOpenApiCapabilitiesObject, linkType: CollectionLinkType) {
    const dataLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(capabilities.links ? capabilities.links : [], linkType);
    const link = dataLinks.find((link) => link.type === "application/json") || dataLinks.find((link) => !link.type) || dataLinks[0];
    return link ? link.href : '';
  }

  /**
   * Whether the server supports the collections parameter of dataset tiles (OGC API Tiles, collections selection),
   * as its conformance classes declare: the class of the standard, or the variant of COLLECTIONS_SELECTION_CONFORMANCE_VARIANTS
   */
  public static supportsCollectionSelection(capabilities: OgcOpenApiCapabilitiesObject | null) {
    const conformsTo = capabilities && capabilities.conformsTo ? capabilities.conformsTo : [];
    return conformsTo.indexOf(COLLECTIONS_SELECTION_CONFORMANCE) > -1 ||
        COLLECTIONS_SELECTION_CONFORMANCE_VARIANTS.some(variant => conformsTo.indexOf(variant) > -1);
  }

  /**
   * Whether, and how, the server filters features, as its conformance classes declare: the Features Filter class of
   * OGC API Features Part 3, and the CQL2 1.0 classes by their names, in the order the server lists them. Each is
   * reported as declared, a CQL2 encoding without the Features Filter class gives filter false. Pre-standard CQL
   * classes (ogcapi-features-3/1.0/conf/cql-text) are not CQL2 and are left out.
   */
  public static getFilterSupport(capabilities: OgcOpenApiCapabilitiesObject | null): OgcOpenApiFilterSupport {
    const conformsTo = capabilities && capabilities.conformsTo ? capabilities.conformsTo : [];
    const cql2 = conformsTo
        .filter(uri => uri.indexOf(CQL2_CONFORMANCE_PREFIX) === 0)
        .map(uri => uri.substring(CQL2_CONFORMANCE_PREFIX.length));
    return {
      filter: conformsTo.indexOf(FEATURES_FILTER_CONFORMANCE) > -1,
      encodings: cql2.filter(name => CQL2_ENCODINGS.indexOf(name) > -1),
      levels: cql2.filter(name => CQL2_ENCODINGS.indexOf(name) === -1),
    };
  }

  /**
   * Fetches the queryables of a collection (OGC API Features Part 3), the properties a filter can use: a JSON Schema,
   * as the server sends it. Resolves null for a collection that has none: a collection without features, or a
   * queryables request that answers 404. Rejects with an Error otherwise, and with the error of the request as it is
   * when it fails, an AbortError included.
   */
  public static async fetchQueryables(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      collection: OgcOpenApiCapabilitiesCollection,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ): Promise<OgcOpenApiQueryables | null> {
    if (capabilities === null) throw new Error("No capabilities to fetch the queryables of " + collection.id);
    const href = OgcOpenApiGetCapabilities.getQueryablesHref(capabilities, collection);
    if (!href) return null;
    let response: Response;
    try {
      response = await OgcOpenApiFetchTools.fetch(href, {
        method: "GET",
        credentials: options?.credentials ? "same-origin" : "omit",
        headers: {Accept: QUERYABLES_MEDIA_TYPES.join(", "), ...(options?.requestHeaders ? options.requestHeaders : {})}
      }, capabilities.serverOptions);
    } catch (e) {
      throw OgcOpenApiGetCapabilities.toError(e, href);
    }
    if (response.status === 404) return null;
    if (response.status !== 200) throw new Error("Invalid response: " + response.status + " for " + href);
    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error("Not JSON data for " + href);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid format: (not a JSON Schema) in " + href);
    return data;
  }

  // The queryables link of the collection, in JSON. Some servers (ldproxy, PDOK) list it only in the collection
  // document, not in /collections: then the path of the standard, /collections/{collectionId}/queryables, for a
  // collection with features. Other collections have no queryables, '' then
  private static getQueryablesHref(capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection) {
    const links = collection.links ? collection.links : [];
    const queryables = links.filter(l => isRel(l, "queryables"));
    const link = QUERYABLES_MEDIA_TYPES.map(type => queryables.find(l => l.type === type)).find(l => l) ||
        queryables.find(l => !l.type);
    if (link) return link.href;
    if (OgcOpenApiGetCapabilities.filterCollectionLinks(links, CollectionLinkType.Items).length === 0) return '';
    // The self link keeps its query, such as f=json (PDOK)
    const self = links.find(l => l.rel === "self" && (!l.type || l.type === "application/json"));
    const collectionHref = self ? self.href : capabilities.baseUrl + "collections/" + encodeURIComponent(collection.id);
    return OgcOpenApiFetchTools.appendPath(collectionHref, "queryables");
  }

  /**
   * Whether the server tiles the dataset as a whole, all its collections in each tile, for linkType Tiles or VectorTiles
   */
  public static hasDatasetTileSets(capabilities: OgcOpenApiCapabilitiesObject | null, linkType: CollectionLinkType) {
    return capabilities !== null && OgcOpenApiGetCapabilities.getDatasetTileSetsHref(capabilities, linkType) !== '';
  }

  /**
   * Lists the tilesets of a collection: the tile matrix sets the collection is tiled in, which can be fewer than the
   * tile matrix sets of the server.
   */
  public static async fetchCollectionTileSets(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      collection: OgcOpenApiCapabilitiesCollection,
      linkType: CollectionLinkType = CollectionLinkType.Tiles,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ): Promise<CollectionTileSetInfo[]> {
    if (capabilities === null) throw {error: true, message: "No capabilities"};
    const href = OgcOpenApiGetCapabilities.getTileSetsHref(collection, linkType);
    if (href === '') throw {error: true, message: "Collection " + collection.id + " has no " + linkType + " link"};
    return OgcOpenApiGetCapabilities.fetchTileSetList(capabilities, href, options);
  }

  /**
   * Lists the tilesets of the dataset (/tiles of the landing page): each tile has the data of all its collections.
   * Some servers tile only the dataset (PDOK).
   */
  public static async fetchDatasetTileSets(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      linkType: CollectionLinkType = CollectionLinkType.Tiles,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ): Promise<CollectionTileSetInfo[]> {
    if (capabilities === null) throw {error: true, message: "No capabilities"};
    const href = OgcOpenApiGetCapabilities.getDatasetTileSetsHref(capabilities, linkType);
    if (href === '') throw {error: true, message: "The dataset has no " + linkType + " link"};
    return OgcOpenApiGetCapabilities.fetchTileSetList(capabilities, href, options);
  }

  private static async fetchTileSetList(capabilities: OgcOpenApiCapabilitiesObject, href: string, options?: {credentials?: boolean, requestHeaders?: RequestHeaders}) {
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, href, options);
    if (!Array.isArray(data.tilesets)) throw {error: true, message: "Response has no tilesets"};
    const tileSets: CollectionTileSetInfo[] = [];
    for (const tileSet of data.tilesets) {
      const links: LinkType[] = tileSet.links ? tileSet.links : [];
      const selfLinks = links.filter(l => l.rel === "self");
      const self = selfLinks.find(l => l.type === "application/json") || selfLinks[0];
      if (!self) continue;
      tileSets.push({
        tileMatrixSetURI: tileSet.tileMatrixSetURI,
        tileMatrixSetId: tileSet.tileMatrixSetId,
        dataType: tileSet.dataType,
        crs: typeof tileSet.crs === "string" ? tileSet.crs : undefined,
        href: OgcOpenApiFetchTools.resolveUrl(self.href, href, capabilities.serverOptions),
        tilingSchemeHref: OgcOpenApiGetCapabilities.getTilingSchemeHref(capabilities, links, href),
        tileMatrixSet: OgcOpenApiGetCapabilities.getInlineTileMatrixSet(tileSet),
      });
    }
    return tileSets;
  }

  /**
   * The tile matrix set of a tileset among the tile matrix sets of the server (fetchTileSetsInFull): by URI, which
   * servers give with their own ids (CubeWerx: WebMercatorQuad is smerc), then by id.
   */
  public static matchTileMatrixSet(tileSet: CollectionTileSetInfo, tileMatrixSets: TileSetData[]): TileSetData | undefined {
    const lastSegment = (url: string) => url.split("?")[0].replace(/\/$/, "").split("/").pop();
    const byUri = tileSet.tileMatrixSetURI ? tileMatrixSets.find(t => OgcOpenApiGetCapabilities.sameUri(t.uri, tileSet.tileMatrixSetURI)) : undefined;
    if (byUri) return byUri;
    const ids = [tileSet.tileMatrixSetId,
      tileSet.tileMatrixSetURI ? lastSegment(tileSet.tileMatrixSetURI) : undefined,
      tileSet.tilingSchemeHref ? lastSegment(tileSet.tilingSchemeHref) : undefined].filter(id => !!id);
    return tileMatrixSets.find(t => ids.indexOf(t.id) > -1);
  }

  // Both forms name the same resource: http or https, the case of the scheme and host, a trailing slash
  private static sameUri(a: string | undefined, b: string | undefined) {
    const normalize = (uri: string) => uri.trim().replace(/\/$/, "")
        .replace(/^https?:\/\/[^/]*/i, prefix => prefix.toLowerCase().replace(/^https:/, "http:"));
    return !!a && !!b && normalize(a) === normalize(b);
  }

  /**
   * The tile matrix set of a tileset: matched among the tile matrix sets of the server, or otherwise fetched from the
   * tiling-scheme link of the tileset. A tileset in a list of tilesets is a summary that need not identify its tile
   * matrix set, then the tileset itself is read (CubeWerx).
   */
  public static async fetchTileMatrixSetOfTileSet(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      tileSet: CollectionTileSetInfo,
      tileMatrixSets: TileSetData[],
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ): Promise<TileSetData> {
    if (capabilities === null) throw {error: true, message: "No capabilities"};
    if (tileSet.tileMatrixSet) return tileSet.tileMatrixSet;
    let identified = tileSet;
    if (!tileSet.tileMatrixSetURI && !tileSet.tileMatrixSetId && !tileSet.tilingSchemeHref) {
      identified = {...tileSet, ...await OgcOpenApiGetCapabilities.fetchTileSetIdentity(capabilities, tileSet.href, options)};
      if (identified.tileMatrixSet) return identified.tileMatrixSet;
    }
    const match = OgcOpenApiGetCapabilities.matchTileMatrixSet(identified, tileMatrixSets);
    if (match) return match;
    if (!identified.tilingSchemeHref) {
      throw {error: true, message: "No tile matrix set for " + (identified.tileMatrixSetURI || identified.href)};
    }
    return OgcOpenApiGetCapabilities.fetchTileset(capabilities, {id: identified.tileMatrixSetId, title: "", links: [{rel: "self", type: "application/json", title: "", href: identified.tilingSchemeHref}]}, options);
  }

  // What identifies the tile matrix set in a tileset: its URI, its id or its tiling-scheme link
  private static async fetchTileSetIdentity(capabilities: OgcOpenApiCapabilitiesObject, href: string, options?: {credentials?: boolean, requestHeaders?: RequestHeaders}) {
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, href, options);
    return {
      tileMatrixSetURI: data.tileMatrixSetURI as string | undefined,
      tileMatrixSetId: data.tileMatrixSetId as string | undefined,
      tilingSchemeHref: OgcOpenApiGetCapabilities.getTilingSchemeHref(capabilities, data.links ? data.links : [], href),
      tileMatrixSet: OgcOpenApiGetCapabilities.getInlineTileMatrixSet(data),
    };
  }

  // A tileset can include the definition of its tile matrix set instead of linking it
  private static getInlineTileMatrixSet(tileSet: any): TileSetData | undefined {
    const tileMatrixSet = tileSet ? tileSet.tileMatrixSet : undefined;
    return tileMatrixSet && typeof tileMatrixSet.id !== "undefined" && Array.isArray(tileMatrixSet.tileMatrices) && tileMatrixSet.crs ?
        tileMatrixSet : undefined;
  }

  /**
   * Fetches the tileset of a collection for one tile matrix set: the tile URL templates (rel item) and, for vector
   * tiles, the layers contained in each tile.
   */
  public static async fetchCollectionTileSet (
      capabilities: OgcOpenApiCapabilitiesObject | null,
      // null for a tileset of the dataset
      currentCollection: OgcOpenApiCapabilitiesCollection | null,
      // The id of the tile matrix set, or a tileset from fetchCollectionTileSets or fetchDatasetTileSets
      tileMatrix: string | CollectionTileSetInfo,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders},
      linkType: CollectionLinkType = CollectionLinkType.Tiles
  ): Promise<CollectionTileSet> {
    if (capabilities === null) throw {error: true, message: "No capabilities"};
    const tileSetsHref = currentCollection ?
        OgcOpenApiGetCapabilities.getTileSetsHref(currentCollection, linkType) :
        OgcOpenApiGetCapabilities.getDatasetTileSetsHref(capabilities, linkType);
    const tileInfoUrl = typeof tileMatrix === "string" ? OgcOpenApiFetchTools.appendPath(tileSetsHref, tileMatrix) : tileMatrix.href;
    // pygeoapi answers 500 without f=json or an Accept header
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, tileInfoUrl, options);
    const links = data.links ? data.links.filter(l => l.rel === "item" || l.rel === "items").map(a => ({...a, href: OgcOpenApiFetchTools.resolveUrl(a.href, tileInfoUrl, capabilities.serverOptions)})) : [];
    if (links.length === 0) throw {error: true, message: "Invalid"};
    return {
      dataType: data.dataType,
      links,
      layers: data.layers ? data.layers : [],
      tileMatrixSetLimits: data.tileMatrixSetLimits,
      boundingBox: data.boundingBox && Array.isArray(data.boundingBox.lowerLeft) && Array.isArray(data.boundingBox.upperRight) ? data.boundingBox : undefined,
    };
  }

  /**
   * Fetches the definition of a tile matrix set, by its JSON link as the server gives it: with the query that tells
   * the server to answer JSON (f=json), if it has one.
   */
  public static async fetchTileset(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      tileset: TileSetMeta,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ): Promise<TileSetData> {
    if (capabilities === null) throw {error: true, message: "No capabilities"};
    const jsonLink = tileset.links.find(l => l.type === "application/json") || tileset.links.find(l => !l.type) || tileset.links[0];
    if (!jsonLink) throw {error: true, message: "Tile matrix set " + tileset.id + " has no link"};
    const data: TileSetData = await OgcOpenApiGetCapabilities.fetchJson(capabilities, jsonLink.href, options);
    if (typeof data.id === "undefined" || !data.tileMatrices || !data.crs) throw {error: true, message: "TileSet has invalid data"};
    return data;
  }
}

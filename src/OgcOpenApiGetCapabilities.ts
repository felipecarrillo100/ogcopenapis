import {type FetchServerOptions, OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools.js";
import {OgcOpenApiError} from "./OgcOpenApiError.js";
import type {OgcOpenApiFeatureWriteOperation} from "./OgcOpenApiFeatureStore.js";
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

// The conformance classes of OGC API Maps Part 1 share this prefix, as OGC 20-058 Table 1 writes it, with https
export const MAPS_CONFORMANCE_PREFIX = "https://www.opengis.net/spec/ogcapi-maps-1/";

// OGC URIs (www.opengis.net: conformance classes, link relations, profiles) are written with http by some OGC standards
// and with https by others: OGC API Tiles (20-057) and Features write http, OGC API Maps (20-058) writes https, and
// servers follow either (GeoServer 3.0: https://www.opengis.net/def/rel/ogc/1.0/map). Both schemes name the same URI and
// are accepted wherever an OGC URI is compared. Nothing else is taken as equal: not the /0 version alias, nor CURIEs
const OGC_URI_START = /^https?:\/\/www\.opengis\.net\//i;
const normalizeOgcUri = (uri: string) => uri.replace(OGC_URI_START, "http://www.opengis.net/");
export const isSameOgcUri = (a: string | undefined, b: string | undefined) =>
    typeof a === "string" && typeof b === "string" && normalizeOgcUri(a) === normalizeOgcUri(b);
// The rest of the URI after an OGC prefix, in http or https; undefined when it doesn't start with the prefix
const afterOgcPrefix = (uri: string, prefix: string) => {
  const normalized = normalizeOgcUri(uri), normalizedPrefix = normalizeOgcUri(prefix);
  return normalized.indexOf(normalizedPrefix) === 0 ? normalized.substring(normalizedPrefix.length) : undefined;
};

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

// The schema of the features of a collection (OGC API Features Part 5): a JSON Schema, as the server sends it
export type OgcOpenApiSchema = OgcOpenApiQueryables;

// What a server advertises about writing the features of a collection, see OgcOpenApiGetCapabilities.fetchWriteSupport
export interface OgcOpenApiWriteSupport {
  conformance: { createReplaceDelete: boolean, update: boolean };
  allow: { items?: string[], item?: string[] };
  suggested: OgcOpenApiFeatureWriteOperation[];
  patch: boolean;
  issues: string[];
}

// The conformance classes of OGC API Features Part 4, in the URIs they have had: draft 2 (ogcapi-features-4/1.0),
// draft 3, also OGC API Common Part 5 (ogcapi-common-5/1.0), and ldproxy 4.8 (ogcapi-features-4/0.0)
const WRITE_CONFORMANCE = {
  createReplaceDelete: ["ogcapi-features-4/1.0", "ogcapi-features-4/0.0", "ogcapi-common-5/1.0"]
      .map(part => "http://www.opengis.net/spec/" + part + "/conf/create-replace-delete"),
  update: ["ogcapi-features-4/1.0", "ogcapi-features-4/0.0", "ogcapi-common-5/1.0"]
      .map(part => "http://www.opengis.net/spec/" + part + "/conf/update"),
};

// The numbers OGC 2D TMS 2.0 requires of a tile matrix (tileMatrix.json), besides its id and pointOfOrigin
const TILE_MATRIX_NUMBERS = ["scaleDenominator", "cellSize", "tileWidth", "tileHeight", "matrixWidth", "matrixHeight"];

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

// OGC API link relations are given in full or, by older servers, short: tiling-scheme or http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme.
// In full, with http or https (isSameOgcUri)
const OGC_REL = "http://www.opengis.net/def/rel/ogc/1.0/";
const isRel = (link: LinkType, rel: string) => isSameOgcUri(link.rel, OGC_REL + rel) || link.rel === rel;
const isOneOfRels = (link: LinkType, rels: string[]) => rels.some(rel => isSameOgcUri(link.rel, rel) || link.rel === rel);

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
  proxify?: ProxifyFunction;
  // Other origins than the server's that may receive requestHeaders and credentials, such as "https://data.example.com".
  // The links of the server to any other origin are requested without them
  credentialsOrigins?: string[];
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
    const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: requestUrl, proxify: options.proxify, credentialsOrigins: options.credentialsOrigins});
    // The requests before the capabilities exist
    const server = {serverOptions} as OgcOpenApiCapabilitiesObject;
    const getJson = (href: string, accept?: string) =>
        OgcOpenApiGetCapabilities.fetchJson(server, href, options, accept).catch(e => {
          throw OgcOpenApiGetCapabilities.toError(e, href);
        });

    const landing = await getJson(requestUrl);
    if (!landing || !Array.isArray(landing.links)) throw new OgcOpenApiError("Invalid format: (property 'links' is missing) in " + requestUrl, {url: requestUrl});
    const links: OgcOpenApiCapabilitiesCollectionServiceLinkType[] = landing.links;
    // In full or short, like the other OGC relations: GeoServer's Tiles and Maps give only the full one
    const dataLinks = links.filter(link => isRel(link, 'data'));
    const linkToData = dataLinks.find(link => link.type === 'application/json') || dataLinks[0];
    if (!linkToData) throw new OgcOpenApiError("Invalid format: (property 'links' contains no links with rel=data) in " + requestUrl, {url: requestUrl});
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
      throw new OgcOpenApiError("Invalid format: (property 'collections' is missing) in " + collectionsLink.href, {url: collectionsLink.href});
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

  // An Error for a failed request of fromURL: an OgcOpenApiError of fetchJson with the URL added to its message, the
  // error of fetch as it is, such as an AbortError, otherwise its message and the URL. An error of fetch can come from
  // another realm (a DOMException of jsdom is not instanceof Error), so anything with a name and a message is kept
  private static toError(e: any, href: string): Error {
    if (e instanceof OgcOpenApiError) return new OgcOpenApiError(e.message + " for " + href, {status: e.status, url: e.url ? e.url : href, problem: e.problem});
    if (e instanceof Error || (e && typeof e.name === "string" && typeof e.message === "string")) return e;
    return new OgcOpenApiError((e && e.message ? e.message : String(e)) + " for " + href, {url: href});
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
        return links.filter((link: any) => isOneOfRels(link, CollectionLinkTypeAlternatives[linkType]));
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
    return type.indexOf(JSON_FG_MEDIA_TYPE) === 0 || profiles.some(profile => isSameOgcUri(profile, JSON_FG_PROFILE));
  }

  // JSON-FG is reported as JSON-FG also when the server types it application/geo+json with the JSON-FG profile
  private static detectTypeFormat(link: OgcOpenApiCapabilitiesCollectionServiceLinkType) {
    if (link.type && OgcOpenApiGetCapabilities.isJsonFgLink(link) && link.type.indexOf(JSON_FG_MEDIA_TYPE) !== 0) return JSON_FG_MEDIA_TYPE;
    if (link.type) return link.type;
    for (const key in CollectionLinkTypeAlternatives) {
      if (CollectionLinkTypeAlternatives.hasOwnProperty(key) && isOneOfRels(link, CollectionLinkTypeAlternatives[key])) {
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
    if (capabilities === null) throw new OgcOpenApiError("No capabilities");
    const url = capabilities.tileMatrixSetsUrl ? capabilities.tileMatrixSetsUrl : capabilities.baseUrl + "tileMatrixSets";
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, url, options);
    if (!data.tileMatrixSets) throw new OgcOpenApiError("tileMatrixSets not defined", {url});
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
      credentials: OgcOpenApiFetchTools.toFetchCredentials(options?.credentials),
      headers: {Accept: accept, ...(options?.requestHeaders ? options.requestHeaders : {})}
    }, capabilities.serverOptions, options?.requestHeaders);
    if (result.status !== 200) throw await OgcOpenApiError.fromResponse(result, "Invalid response: " + result.status, href);
    try {
      return await result.json();
    } catch (err) {
      throw new OgcOpenApiError("Not JSON data", {url: href});
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
    return [COLLECTIONS_SELECTION_CONFORMANCE, ...COLLECTIONS_SELECTION_CONFORMANCE_VARIANTS]
        .some(uri => conformsTo.some(declared => isSameOgcUri(declared, uri)));
  }

  /**
   * Whether a collection may offer its map only per style (OGC API Maps, Styled Map class, OGC 20-058 clause 21): it
   * has no map link of its own, it links its styles, and the server declares a conformance class of OGC API Maps Part 1,
   * in https or http. GeoServer 2.28 does so. Makes no request: OgcOpenApiStyleTools.fetchMapStyles reads the styles, and finds whether
   * they have maps. A collection with a map link gives false, its map is the one of that link
   */
  public static mayOfferStyledMap(capabilities: OgcOpenApiCapabilitiesObject | null, collection: OgcOpenApiCapabilitiesCollection) {
    const conformsTo = capabilities && capabilities.conformsTo ? capabilities.conformsTo : [];
    const links = collection.links ? collection.links : [];
    return OgcOpenApiGetCapabilities.filterCollectionLinks(links, CollectionLinkType.Map).length === 0 &&
        OgcOpenApiGetCapabilities.filterCollectionLinks(links, CollectionLinkType.Styles).length > 0 &&
        conformsTo.some(uri => afterOgcPrefix(uri, MAPS_CONFORMANCE_PREFIX) !== undefined);
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
        .map(uri => afterOgcPrefix(uri, CQL2_CONFORMANCE_PREFIX))
        .filter((name): name is string => name !== undefined);
    return {
      filter: conformsTo.some(uri => isSameOgcUri(uri, FEATURES_FILTER_CONFORMANCE)),
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
    if (capabilities === null) throw new OgcOpenApiError("No capabilities to fetch the queryables of " + collection.id);
    const href = OgcOpenApiGetCapabilities.getCollectionDocumentHref(capabilities, collection, "queryables");
    if (!href) return null;
    let response: Response;
    try {
      response = await OgcOpenApiFetchTools.fetch(href, {
        method: "GET",
        credentials: OgcOpenApiFetchTools.toFetchCredentials(options?.credentials),
        headers: {Accept: QUERYABLES_MEDIA_TYPES.join(", "), ...(options?.requestHeaders ? options.requestHeaders : {})}
      }, capabilities.serverOptions, options?.requestHeaders);
    } catch (e) {
      throw OgcOpenApiGetCapabilities.toError(e, href);
    }
    if (response.status === 404) return null;
    if (response.status !== 200) throw await OgcOpenApiError.fromResponse(response, "Invalid response: " + response.status + " for " + href, href);
    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      throw new OgcOpenApiError("Not JSON data for " + href, {url: href});
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new OgcOpenApiError("Invalid format: (not a JSON Schema) in " + href, {url: href});
    return data;
  }

  /**
   * Fetches the schema of the features of a collection (OGC API Features Part 5): a JSON Schema, as the server sends
   * it, with the type and format of each property, the geometry type (format geometry-point and others, with
   * x-ogc-role primary-geometry) and readOnly properties. It describes every property, the queryables only those a
   * filter can use. Resolves null for a collection without schema: a collection without features, a schema request
   * that answers 404, or an answer that is not a JSON Schema (QGIS Server 4.2 answers its landing page). Rejects with
   * an OgcOpenApiError with the status of any other answer, and with the error of the request when it fails.
   */
  public static async fetchSchema(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      collection: OgcOpenApiCapabilitiesCollection,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ): Promise<OgcOpenApiSchema | null> {
    if (capabilities === null) throw new OgcOpenApiError("No capabilities to fetch the schema of " + collection.id);
    const href = OgcOpenApiGetCapabilities.getCollectionDocumentHref(capabilities, collection, "schema");
    if (!href) return null;
    let response: Response;
    try {
      response = await OgcOpenApiFetchTools.fetch(href, {
        method: "GET",
        credentials: OgcOpenApiFetchTools.toFetchCredentials(options?.credentials),
        headers: {Accept: QUERYABLES_MEDIA_TYPES.join(", "), ...(options?.requestHeaders ? options.requestHeaders : {})}
      }, capabilities.serverOptions, options?.requestHeaders);
    } catch (e) {
      throw OgcOpenApiGetCapabilities.toError(e, href);
    }
    if (response.status === 404) return null;
    if (response.status !== 200) throw await OgcOpenApiError.fromResponse(response, "Invalid response: " + response.status + " for " + href, href);
    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      return null;
    }
    const isSchema = data && typeof data === "object" && !Array.isArray(data) &&
        ((data.properties && typeof data.properties === "object") || typeof data.$schema === "string" || data.type === "object");
    return isSchema ? data : null;
  }

  /**
   * What the server advertises about writing the features of a collection (OGC API Features Part 4): a hint, never a
   * permission. Only the answer to a write tells whether this user may make it.
   * - conformance: the server declares the create-replace-delete and update classes, in any of the URIs drafts and
   *   servers use. They are for the whole server, not the collection or the user.
   * - allow: the methods of the Allow header of OPTIONS on the items, and on the item of options.featureId when given
   *   (some servers list PUT and DELETE only there). Sent with the credentials of the app: a server can answer per
   *   user (QGIS Server). Left out when OPTIONS fails or its Allow cannot be read (not sent, or not exposed to the
   *   browser).
   * - suggested: the writeOperations to give the store, from the Allow header, only when the server declares
   *   create-replace-delete. patch: it declares update, and PATCH is allowed or the Allow header is unknown.
   * - issues: what does not agree, as found. They are reported, not corrected.
   */
  public static async fetchWriteSupport(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      collection: OgcOpenApiCapabilitiesCollection,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders, featureId?: string | number}
  ): Promise<OgcOpenApiWriteSupport> {
    if (capabilities === null) throw new OgcOpenApiError("No capabilities to tell the write support of " + collection.id);
    const conformsTo = capabilities.conformsTo ? capabilities.conformsTo : [];
    const declares = (classes: string[]) => conformsTo.some(uri => classes.some(c => isSameOgcUri(uri, c)));
    const conformance = {
      createReplaceDelete: declares(WRITE_CONFORMANCE.createReplaceDelete),
      update: declares(WRITE_CONFORMANCE.update),
    };
    const issues: string[] = [];
    const allow: { items?: string[], item?: string[] } = {};
    const itemsHref = OgcOpenApiGetCapabilities.getItemsHref(collection);
    if (itemsHref) {
      const items = await OgcOpenApiGetCapabilities.fetchAllow(capabilities, itemsHref, options, issues);
      if (items) allow.items = items;
      if (typeof options?.featureId !== "undefined") {
        const itemHref = OgcOpenApiFetchTools.appendPath(itemsHref, encodeURIComponent(String(options.featureId)));
        const item = await OgcOpenApiGetCapabilities.fetchAllow(capabilities, itemHref, options, issues);
        if (item) allow.item = item;
      }
    } else {
      issues.push("The collection " + collection.id + " has no items link");
    }
    const allowed = (method: string, ...lists: (string[] | undefined)[]) => lists.some(list => list && list.indexOf(method) > -1);
    const itemMethods = allow.item ? allow.item : allow.items;
    const known = !!(allow.items || allow.item);
    const writes = ["POST", "PUT", "DELETE"].filter(m => allowed(m, allow.items, allow.item));
    if (conformance.createReplaceDelete && known && writes.length === 0) {
      issues.push("The server declares create-replace-delete, but OPTIONS allows no write method");
    }
    if (!conformance.createReplaceDelete && writes.length > 0) {
      issues.push("OPTIONS allows " + writes.join(", ") + ", but the server does not declare create-replace-delete");
    }
    if (conformance.update && known && !allowed("PATCH", allow.items, allow.item)) {
      issues.push("The server declares update, but OPTIONS does not allow PATCH");
    }
    const suggested: OgcOpenApiFeatureWriteOperation[] = [];
    if (conformance.createReplaceDelete) {
      if (allowed("POST", allow.items)) suggested.push("add");
      if (allowed("PUT", itemMethods)) suggested.push("put");
      if (allowed("DELETE", itemMethods)) suggested.push("remove");
    }
    return {
      conformance, allow, suggested, issues,
      patch: conformance.update && (!known || allowed("PATCH", allow.items, allow.item)),
    };
  }

  // The methods of the Allow header of OPTIONS on href, upper case. undefined, with an issue, when OPTIONS fails or
  // has no Allow that can be read
  private static async fetchAllow(capabilities: OgcOpenApiCapabilitiesObject, href: string,
                                  options: {credentials?: boolean, requestHeaders?: RequestHeaders} | undefined, issues: string[]) {
    let response: Response;
    try {
      response = await OgcOpenApiFetchTools.fetch(href, {
        method: "OPTIONS",
        credentials: OgcOpenApiFetchTools.toFetchCredentials(options?.credentials),
        headers: {...(options?.requestHeaders ? options.requestHeaders : {})},
      }, capabilities.serverOptions, options?.requestHeaders);
    } catch (e) {
      issues.push("OPTIONS " + href + " failed: " + (e && e.message ? e.message : String(e)));
      return undefined;
    }
    if (response.status < 200 || response.status > 299) {
      issues.push("OPTIONS " + href + " answered " + response.status);
      return undefined;
    }
    const header = response.headers.get("Allow");
    if (header === null) {
      issues.push("OPTIONS " + href + " has no Allow header that can be read (not sent, or not exposed to the browser)");
      return undefined;
    }
    return header.split(",").map(m => m.trim().toUpperCase()).filter(m => m !== "");
  }

  // The items of the collection, as the store writes them: without the query of the link, which chooses a
  // representation to read (f, profile). '' for a collection without items
  private static getItemsHref(collection: OgcOpenApiCapabilitiesCollection) {
    const links = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links ? collection.links : [], CollectionLinkType.Items);
    return links.length === 0 ? '' : links[0].href.split("?")[0];
  }

  // A document of the collection, schema or queryables: its link in JSON, or, as some servers (ldproxy, PDOK) list it
  // only in the collection document, not in /collections, the path of the standard, /collections/{collectionId}/{name},
  // for a collection with features. Other collections have none, '' then
  private static getCollectionDocumentHref(capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection, name: string) {
    const links = collection.links ? collection.links : [];
    const documents = links.filter(l => isRel(l, name));
    const link = QUERYABLES_MEDIA_TYPES.map(type => documents.find(l => l.type === type)).find(l => l) ||
        documents.find(l => !l.type);
    if (link) return link.href;
    if (OgcOpenApiGetCapabilities.filterCollectionLinks(links, CollectionLinkType.Items).length === 0) return '';
    // The self link keeps its query, such as f=json (PDOK)
    const self = links.find(l => l.rel === "self" && (!l.type || l.type === "application/json"));
    const collectionHref = self ? self.href : capabilities.baseUrl + "collections/" + encodeURIComponent(collection.id);
    return OgcOpenApiFetchTools.appendPath(collectionHref, name);
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
    if (capabilities === null) throw new OgcOpenApiError("No capabilities");
    const href = OgcOpenApiGetCapabilities.getTileSetsHref(collection, linkType);
    if (href === '') throw new OgcOpenApiError("Collection " + collection.id + " has no " + linkType + " link");
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
    if (capabilities === null) throw new OgcOpenApiError("No capabilities");
    const href = OgcOpenApiGetCapabilities.getDatasetTileSetsHref(capabilities, linkType);
    if (href === '') throw new OgcOpenApiError("The dataset has no " + linkType + " link");
    return OgcOpenApiGetCapabilities.fetchTileSetList(capabilities, href, options);
  }

  private static async fetchTileSetList(capabilities: OgcOpenApiCapabilitiesObject, href: string, options?: {credentials?: boolean, requestHeaders?: RequestHeaders}) {
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, href, options);
    if (!Array.isArray(data.tilesets)) throw new OgcOpenApiError("Response has no tilesets", {url: href});
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
    // A path segment is percent-encoded (RFC 3986): GeoServer links EPSG:900913 as EPSG%3A900913
    const lastSegment = (url: string) => {
      const segment = url.split("?")[0].replace(/\/$/, "").split("/").pop();
      try {
        return decodeURIComponent(segment);
      } catch (e) {
        return segment;
      }
    };
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
    if (capabilities === null) throw new OgcOpenApiError("No capabilities");
    if (tileSet.tileMatrixSet) return tileSet.tileMatrixSet;
    let identified = tileSet;
    if (!tileSet.tileMatrixSetURI && !tileSet.tileMatrixSetId && !tileSet.tilingSchemeHref) {
      identified = {...tileSet, ...await OgcOpenApiGetCapabilities.fetchTileSetIdentity(capabilities, tileSet.href, options)};
      if (identified.tileMatrixSet) return identified.tileMatrixSet;
    }
    const match = OgcOpenApiGetCapabilities.matchTileMatrixSet(identified, tileMatrixSets);
    if (match) return match;
    if (!identified.tilingSchemeHref) {
      throw new OgcOpenApiError("No tile matrix set for " + (identified.tileMatrixSetURI || identified.href));
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
    if (!tileMatrixSet || OgcOpenApiGetCapabilities.getTileMatrixSetProblem(tileMatrixSet)) return undefined;
    if (typeof tileMatrixSet.id !== "undefined") return tileMatrixSet;
    // id is optional in OGC 2D TMS 2.0: the id the tileset gives, otherwise the uri of the definition as it is
    const id = tileSet.tileMatrixSetId || tileMatrixSet.uri || tileSet.tileMatrixSetURI;
    return id ? {...tileMatrixSet, id} : undefined;
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
    if (capabilities === null) throw new OgcOpenApiError("No capabilities");
    const tileSetsHref = currentCollection ?
        OgcOpenApiGetCapabilities.getTileSetsHref(currentCollection, linkType) :
        OgcOpenApiGetCapabilities.getDatasetTileSetsHref(capabilities, linkType);
    const tileInfoUrl = typeof tileMatrix === "string" ? OgcOpenApiFetchTools.appendPath(tileSetsHref, tileMatrix) : tileMatrix.href;
    // pygeoapi answers 500 without f=json or an Accept header
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, tileInfoUrl, options);
    const links = data.links ? data.links.filter(l => l.rel === "item" || l.rel === "items").map(a => ({...a, href: OgcOpenApiFetchTools.resolveUrl(a.href, tileInfoUrl, capabilities.serverOptions)})) : [];
    if (links.length === 0) throw new OgcOpenApiError("Invalid", {url: tileInfoUrl});
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
    if (capabilities === null) throw new OgcOpenApiError("No capabilities");
    const jsonLink = tileset.links.find(l => l.type === "application/json") || tileset.links.find(l => !l.type) || tileset.links[0];
    if (!jsonLink) throw new OgcOpenApiError("Tile matrix set " + tileset.id + " has no link");
    const data: TileSetData = await OgcOpenApiGetCapabilities.fetchJson(capabilities, jsonLink.href, options);
    const problem = OgcOpenApiGetCapabilities.getTileMatrixSetProblem(data);
    if (problem) {
      const name = data && typeof data.id !== "undefined" ? data.id : tileset.id;
      throw new OgcOpenApiError("Tile matrix set " + (typeof name !== "undefined" ? name + " " : "") + problem + " in " + jsonLink.href, {url: jsonLink.href});
    }
    if (typeof data.id !== "undefined") return data;
    // id is optional in OGC 2D TMS 2.0: the id of the server's list of tile matrix sets, otherwise its uri as it is
    const id = tileset.id || data.uri;
    return id ? {...data, id} : data;
  }

  /**
   * What a tile matrix set lacks of what OGC 2D TMS 2.0 (OGC 17-083r4, the version OGC API Tiles uses) requires and
   * the tools compute with: crs and tileMatrices, and of each tile matrix its id, scaleDenominator, cellSize,
   * pointOfOrigin, tileWidth, tileHeight, matrixWidth and matrixHeight. undefined when nothing is missing. The id of the
   * tile matrix set is optional. supportedCRS, of OGC 2D TMS 1.0, is named in the problem but not read
   */
  private static getTileMatrixSetProblem(data: any): string | undefined {
    if (!data || typeof data !== "object") return "is not a JSON object";
    if (!data.crs) return "has no crs" + (data.supportedCRS ? " (supportedCRS is OGC 2D TMS 1.0, not read)" : "");
    if (!Array.isArray(data.tileMatrices)) return "has no tileMatrices";
    for (let index = 0; index < data.tileMatrices.length; index++) {
      const matrix = data.tileMatrices[index];
      if (!matrix || typeof matrix !== "object") return "has tile matrix " + index + " that is not a JSON object";
      const missing = TILE_MATRIX_NUMBERS.filter(key => typeof matrix[key] !== "number" || !isFinite(matrix[key]));
      if (typeof matrix.id === "undefined") missing.unshift("id");
      if (!Array.isArray(matrix.pointOfOrigin) || matrix.pointOfOrigin.length < 2) missing.push("pointOfOrigin");
      if (missing.length > 0) return "has tile matrix " + (typeof matrix.id !== "undefined" ? matrix.id : index) + " without " + missing.join(", ");
    }
    return undefined;
  }
}

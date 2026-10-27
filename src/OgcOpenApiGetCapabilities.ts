import {FetchServerOptions, OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";
const SCALE_DENOMINATOR_TOLERANCE = 1e-8;

type RequestHeaders = {[headerName: string]: string;} | null
export interface LinkType {
  rel: string;
  type: string;
  title: string;
  href: string;
}

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
}

export interface CollectionTileSet {
  dataType?: string;
  links: LinkType[];
  layers: TileSetLayer[];
  tileMatrixSetLimits?: TileMatrixLimits[];
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

  public static fromURL(inputRequest: string, fromUrlOptions?: OgcOpenApiGetCapabilitiesFromURL) {
    const options: OgcOpenApiGetCapabilitiesFromURL = fromUrlOptions ? fromUrlOptions : {};
    return new Promise<OgcOpenApiCapabilitiesObject>((resolve, reject) => {
      const baseUrl = OgcOpenApiFetchTools.cleanUrl(inputRequest);
      const requestUrl = OgcOpenApiFetchTools.cleanUrl(inputRequest);
      const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: requestUrl, proxify: options?.proxify});

      OgcOpenApiFetchTools.fetch(requestUrl, {
        method: 'GET',
        credentials: options?.credentials ? "same-origin" : "omit",
        headers: options? options.requestHeaders: {},
      }, serverOptions).then(
        (response) => {
          if (response.status === 200) {
            response.json().then((jsonObject) => {
              if (!jsonObject.links) {
                reject("Invalid format: (property 'links' is missing)")
                return;
              }
              let linkToData = jsonObject.links.find(
                (link: OgcOpenApiCapabilitiesCollectionServiceLinkType) =>
                  link.rel === 'data' && link.type === 'application/json'
              );
              if (!linkToData)  {
                linkToData = jsonObject.links.find((link) => link.rel === 'data' );
              }
              const linkToApi = jsonObject.links.find(
                (link: OgcOpenApiCapabilitiesCollectionServiceLinkType) => {
                  return (
                    (link.rel === 'service-desc' || link.rel === 'service') &&
                    link.type.indexOf('openapi+json') > -1
                  );
                }
              );
              const tilingSchemes = jsonObject.links.filter((link) => isRel(link, 'tiling-schemes'));
              const linkToTileMatrixSets = tilingSchemes.find((link) => link.type === 'application/json') || tilingSchemes.find((link) => !link.type);
              // The links of the landing page are relative to it, the links of the collections to /collections
              const resolveLink = (link: OgcOpenApiCapabilitiesCollectionServiceLinkType, documentUrl: string) =>
                  ({...link, href: OgcOpenApiFetchTools.resolveUrl(link.href, documentUrl, serverOptions)});
              const promiseArray = [];
              if (linkToData) {
                const collectionsLink = resolveLink(linkToData, requestUrl);
                const collectionsPromise = OgcOpenApiGetCapabilities.fetchLinkContentAsJSON(
                    collectionsLink,
                    {credentials: options.credentials, requestHeaders: options.requestHeaders},
                    serverOptions
                );
                promiseArray.push(collectionsPromise);
                if (linkToApi) {
                  const apiPromise = OgcOpenApiGetCapabilities.fetchLinkContentAsJSON(
                      resolveLink(linkToApi, requestUrl),
                      {credentials: options.credentials, requestHeaders: options.requestHeaders},
                      serverOptions
                  );
                  promiseArray.push(apiPromise);
                }
                Promise.all(promiseArray).then((responses: any) => {
                  const responseDataLink = responses[0];
                  const responseOpenApi =
                    responses.length >= 1 ? responses[1] : undefined;
                  const crsArray = typeof responseDataLink.crs !== "undefined" ? { crs: responseDataLink.crs } : {};
                  const foundCollections = responseDataLink.collections.filter( c =>
                          options && options.filterCollectionsByLinkType ?
                              OgcOpenApiGetCapabilities.filterCollectionLinks(c.links,options.filterCollectionsByLinkType).length > 0 : true
                  )
                      .map(
                    (collection: any) => {
                      const name =
                        typeof collection.id !== 'undefined'
                          ? collection.id
                          : collection.name;
                      const collectionCrsObject = {} as any;
                      if (typeof collection.crs !== "undefined") collectionCrsObject.crs = collection.crs;
                      if (typeof collection.storageCrs !== "undefined") collectionCrsObject.storageCrs = collection.storageCrs;
                      const layer: OgcOpenApiCapabilitiesCollection = {
                        description: collection.description,
                        id: name,
                        name,
                        title: collection.title,
                        keywords: collection.keywords
                          ? collection.keywords
                          : [],
                        defaultReference: 'CRS:84',
                        links: collection.links,
                        outputFormats: options.filterCollectionsByLinkType ?
                            this.filterCollectionLinks(collection.links, options.filterCollectionsByLinkType).map(link => this.detectTypeFormat(link))
                            :
                            collection.links.map(link => this.detectTypeFormat(link))
                        ,
                        extent: collection.extent,
                        ...collectionCrsObject
                      };
                      return layer;
                    }
                  );
                  // console.log(featureTypes);
                  const o: OgcOpenApiCapabilitiesObject = {
                    name: '',
                    collections: foundCollections.map(col=>({...col, crs: col.crs ? col.crs : [], links: col.links.map(l => resolveLink(l, collectionsLink.href))})),
                    version: responseOpenApi ? responseOpenApi.openapi : '',
                    service: '',
                    info: responseOpenApi ? responseOpenApi.info : {},
                    ...crsArray,
                    serverOptions: serverOptions,
                    baseUrl,
                    tileMatrixSetsUrl: linkToTileMatrixSets ? resolveLink(linkToTileMatrixSets, requestUrl).href : undefined
                  };
                  resolve(o);
                });
              } else {
                reject("Invalid format: (property 'links' contains no links with rel=data");
              }
            }, ()=>{
              reject("Not JSON")
            });
          } else {
            reject(response.status);
          }
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  private static fetchLinkContentAsJSON(link: OgcOpenApiCapabilitiesCollectionServiceLinkType, options: {credentials: boolean, requestHeaders: RequestHeaders}, serverOptions?: FetchServerOptions) {
    return new Promise((resolve) => {
      OgcOpenApiFetchTools.fetch(link.href, {method: "GET", credentials: options.credentials ? "same-origin":"omit", headers: options.requestHeaders}, serverOptions).then(
        (result) => {
          if (result.status === 200) {
            result.json().then((json) => resolve(json));
          } else {
            resolve(undefined);
          }
        },
        () => {
          resolve(undefined);
        }
      );
    });
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

  private static detectTypeFormat(link: OgcOpenApiCapabilitiesCollectionServiceLinkType) {
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
  private static async fetchJson(capabilities: OgcOpenApiCapabilitiesObject, href: string, options?: {credentials?: boolean, requestHeaders?: RequestHeaders}) {
    let result: Response;
    try {
      result = await OgcOpenApiFetchTools.fetch(href, {
        method: "GET",
        credentials: options?.credentials ? "same-origin" : "omit",
        headers: {Accept: "application/json", ...(options?.requestHeaders ? options.requestHeaders : {})}
      }, capabilities.serverOptions);
    } catch (err) {
      throw {error: true, message: err.message};
    }
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
    let identified = tileSet;
    if (!tileSet.tileMatrixSetURI && !tileSet.tileMatrixSetId && !tileSet.tilingSchemeHref) {
      identified = {...tileSet, ...await OgcOpenApiGetCapabilities.fetchTileSetIdentity(capabilities, tileSet.href, options)};
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
    };
  }

  /**
   * Fetches the tileset of a collection for one tile matrix set: the tile URL templates (rel item) and, for vector
   * tiles, the layers contained in each tile.
   */
  public static async fetchCollectionTileSet (
      capabilities: OgcOpenApiCapabilitiesObject | null,
      currentCollection: OgcOpenApiCapabilitiesCollection,
      // The id of the tile matrix set, or a tileset from fetchCollectionTileSets
      tileMatrix: string | CollectionTileSetInfo,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders},
      linkType: CollectionLinkType = CollectionLinkType.Tiles
  ): Promise<CollectionTileSet> {
    if (capabilities === null) throw {error: true, message: "No capabilities"};
    const tileInfoUrl = typeof tileMatrix === "string" ?
        OgcOpenApiFetchTools.cleanUrl(OgcOpenApiGetCapabilities.getTileSetsHref(currentCollection, linkType)) + tileMatrix :
        tileMatrix.href;
    // pygeoapi answers 500 without f=json or an Accept header
    const data = await OgcOpenApiGetCapabilities.fetchJson(capabilities, tileInfoUrl, options);
    const links = data.links ? data.links.filter(l => l.rel === "item" || l.rel === "items").map(a => ({...a, href: OgcOpenApiFetchTools.resolveUrl(a.href, tileInfoUrl, capabilities.serverOptions)})) : [];
    if (links.length === 0) throw {error: true, message: "Invalid"};
    return {
      dataType: data.dataType,
      links,
      layers: data.layers ? data.layers : [],
      tileMatrixSetLimits: data.tileMatrixSetLimits
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

import {FetchServerOptions, OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";
const SCALE_DENOMINATOR_TOLERANCE = 1e-8;

type RequestHeaders = {[headerName: string]: string;} | null
export interface LinkType {
  rel: string;
  type: string;
  title: string;
  href: string;
}

interface TileMatrix {
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
}

const CollectionLinkTypeAlternatives = {
  [CollectionLinkType.Items]: ["items", "item"],
  [CollectionLinkType.Styles]: ["http://www.opengis.net/def/rel/ogc/1.0/styles", "styles"],
  [CollectionLinkType.Map]: ["http://www.opengis.net/def/rel/ogc/1.0/map", "map"],
  [CollectionLinkType.Tiles]: ["http://www.opengis.net/def/rel/ogc/1.0/tilesets-map", "tilesets-map"],
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

  public static fromURL(inputRequest: string, options?: OgcOpenApiGetCapabilitiesFromURL) {
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
              const promiseArray = [];
              if (linkToData) {
                const collectionsPromise = OgcOpenApiGetCapabilities.fetchLinkContentAsJSON(
                    linkToData,
                    {credentials: options.credentials, requestHeaders: options.requestHeaders},
                    serverOptions
                );
                promiseArray.push(collectionsPromise);
                if (linkToApi) {
                  const apiPromise = OgcOpenApiGetCapabilities.fetchLinkContentAsJSON(
                      linkToApi,
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
                    collections: foundCollections.map(col=>({...col, crs: col.crs ? col.crs : [], links: col.links.map(l=>({...l, href: serverOptions.complete(l.href)}))})),
                    version: responseOpenApi ? responseOpenApi.openapi : '',
                    service: '',
                    info: responseOpenApi ? responseOpenApi.info : {},
                    ...crsArray,
                    serverOptions: serverOptions,
                    baseUrl
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
    let rel = null;
    for (let key in CollectionLinkTypeAlternatives) {
      if (CollectionLinkTypeAlternatives.hasOwnProperty(key)) {
        CollectionLinkTypeAlternatives[key].some(e=>e===link.rel);
        rel = key;
        break;
      }
    }
    if (rel) {
      if (CollectionLinkType.Map) return "image/png";
    }
    return "application/json"
  }

  public static fetchTileSetsInFull(capabilities: OgcOpenApiCapabilitiesObject | null, options?:{credentials?:boolean, requestHeaders?: RequestHeaders}) {
    return new Promise<TileSetData[]>((resolve, reject)=> {
      this.fetchTileSets(capabilities, options).then((tileSetMetaArray)=>{
        const promises = tileSetMetaArray.map(tml=>this.fetchTileset(capabilities,tml,options));
        Promise.all(promises).then((arr)=>{
          resolve(arr);
        })
      })
    });
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

  private static fetchTileSets(capabilities: OgcOpenApiCapabilitiesObject | null, options?:{credentials?:boolean, requestHeaders?: RequestHeaders}) {
    return new Promise<TileSetMeta[]>((resolve, reject)=> {
      if (capabilities===null) reject();
      const url = capabilities.baseUrl + "tileMatrixSets";

      OgcOpenApiFetchTools.fetch(url, {
        method: "GET",
        credentials: options?.credentials ? "same-origin" : "omit",
        headers: options?.requestHeaders ? options.requestHeaders : {}
      }, capabilities.serverOptions).then(result => {
        if (result.status === 200) {
          result.json().then((data) => {
                if (data.tileMatrixSets) {
                  resolve(data.tileMatrixSets.map(tml=>({...tml, href: capabilities.serverOptions.complete(tml.href)})))
                } else {
                  reject({error: true, message: "tileMatrixSets not defined"  });
                }
              },
              ()=>{
                reject({error: true, message: "Not JSON data"});
              });
        } else {
          reject({error: true, message: "Invalid response: " + result.status});
        }
      }, (err)=>{
        reject({error: true, message: err.message});
      })
    })
  }

  public static getTilesLink (
      capabilities: OgcOpenApiCapabilitiesObject | null,
      currentCollection: OgcOpenApiCapabilitiesCollection,
      tileMatrixId: string,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ) {
    return new Promise<LinkType[]>((resolve, reject)=>{
      if (capabilities===null) reject();
        const dataLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(
          currentCollection.links,
          CollectionLinkType.Tiles
      )
      const link = dataLinks.find((link) => link.type === "application/json");
      const href = link ? link.href : dataLinks.length > 0 ? dataLinks[0].href : '';
      const tileInfoUrl = OgcOpenApiFetchTools.cleanUrl(href) + tileMatrixId;
      OgcOpenApiFetchTools.fetch(tileInfoUrl, {
        method:"GET",
        credentials: options?.credentials ? "same-origin" : "omit",
        headers: options?.requestHeaders ? options?.requestHeaders : {}
      }, capabilities.serverOptions).then(result => {
        if (result.status === 200) {
          result.json().then((data) => {
                if (data.links.length > 0) {
                  const links = data.links.filter(l=>l.rel === "item" || l.rel === "items").map(a=>({...a, href: capabilities.serverOptions.complete(a.href)}));
                  if (links) {
                    resolve(links);
                  } else {
                    reject({error: true, message: "Invalid"});
                  }
                } else {
                  reject({error: true, message: "Invalid"});
                }
              },
              ()=>{
                reject({error: true, message: "Not JSON data"});
              });
        } else {
          reject({error: true, message: "Invalid response: " + result.status});
        }
      }, (err)=>{
        reject({error: true, message: err.message});
      })
    })
  }

  public static fetchTileset(
      capabilities: OgcOpenApiCapabilitiesObject | null,
      tileset: TileSetMeta,
      options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
  ) {
    return new Promise<TileSetData>((resolve, reject) =>{
      if (capabilities===null) {
        reject();
        return;
      }
      let jsonLink = tileset.links.find(l=>l.type ? l.type==="application/json" : false) ;
      jsonLink = jsonLink ? jsonLink : tileset.links[0];
      const href = OgcOpenApiFetchTools.cleanUrl(jsonLink.href);
      OgcOpenApiFetchTools.fetch(href, {
        method: "GET",
        credentials: options?.credentials ? "same-origin" : "omit",
        headers: options? options.requestHeaders : {}
      }, capabilities.serverOptions).then(result => {
        if (result.status === 200) {
          result.json().then((data: TileSetData) => {
                if (typeof data.id !== "undefined" && data.tileMatrices && data.crs) {
                  resolve(data)
                } else {
                  reject({error: true, message: "TileSet has invalid data"  });
                }
              },
              ()=>{
                reject({error: true, message: "Not JSON data"});
              });
        } else {
          reject({error: true, message: "Invalid response: " + result.status});
        }
      }, (err)=>{
        reject({error: true, message: err.message});
      })
    })
  }
}

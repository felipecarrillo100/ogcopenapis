export interface OgcOpenApiCapabilitiesObject {
  name: string;
  collections: OgcOpenApiCapabilitiesCollection[];
  version: string;
  service: string;
  info: any;
  crs?: any[];
  hostUrl: string;
  baseUrl: string;
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

export interface OgcOpenApiGetCapabilitiesFromURL {
  filterCollectionsByLinkType?: CollectionLinkType
  credentials?: boolean;
  requestHeaders?: {
    [headerName: string]: string;
  } | null;
}

// type ProxifierFunction = (s: string) => string;
type ProxifierFunction = (options: {
  indexes: { [key: string]: string };
  useProxy: boolean;
  requestHeaders?: { [key: string]: string };
}) => { urls: { [key: string]: string }; headers: { [key: string]: string } };

export class OgcOpenApiGetCapabilities {
  private static proxify: ProxifierFunction | undefined;
  public static setProxifier(f: ProxifierFunction) {
    this.proxify = f;
  }

  public static resetProxifier() {
    this.proxify = undefined;
  }

  public static Proxify(options: {
    indexes: { [key: string]: string };
    useProxy: boolean;
    requestHeaders?: { [key: string]: string };
  }) {
    if (typeof this.proxify === 'function') {
      return this.proxify(options);
    } else {
      return { urls: options.indexes, headers: options.requestHeaders ? options.requestHeaders : {} };
    }
  }

  public static hasProxy() {
    return typeof OgcOpenApiGetCapabilities.proxify === 'function';
  }

  public static fromURL(inputRequest: string, options?: OgcOpenApiGetCapabilitiesFromURL) {
    return new Promise<OgcOpenApiCapabilitiesObject>((resolve, reject) => {
      const hostUrl = OgcOpenApiGetCapabilities.getHostURL(inputRequest);
      const baseUrl = OgcOpenApiGetCapabilities.cleanUrl(inputRequest);
      const MyProxy = OgcOpenApiGetCapabilities.Proxify({
        indexes: { getcapabilities: baseUrl },
        useProxy: OgcOpenApiGetCapabilities.hasProxy(),
        requestHeaders: options.requestHeaders
      });
      fetch(MyProxy.urls.getcapabilities, {
        method: 'GET',
        credentials: options.credentials ? "same-origin" : "omit",
        headers: MyProxy.headers,
      }).then(
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
                    {hostUrl}
                );
                promiseArray.push(collectionsPromise);
                if (linkToApi) {
                  const apiPromise = OgcOpenApiGetCapabilities.fetchLinkContentAsJSON(
                    linkToApi,
                      {hostUrl}
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
                            this.filterCollectionLinks(collection.links, options.filterCollectionsByLinkType).map(link => this.detectTypeFormat(link)) :
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
                    collections: foundCollections,
                    version: responseOpenApi ? responseOpenApi.openapi : '',
                    service: '',
                    info: responseOpenApi ? responseOpenApi.info : {},
                    ...crsArray,
                    hostUrl,
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

  public static cleanUrl(inputUrl:string) {
    const url = inputUrl.split("?")[0].replace(/\/?$/, '/');
    return url;
  }

  public static getHostURL(fullUrl: string) {
    if (!fullUrl.startsWith("http")) return "";
      const pathArray = fullUrl.split( '/' );
      const protocol = pathArray[0];
      const host = pathArray[2];
      return protocol + '//' + host;
  }

  public static addHostURL(url: string, HostUrl?: string) {
    const hostUrl = HostUrl ? HostUrl : "";
    if (url.startsWith("http://") ||  url.startsWith("https://")) {
      return url;
    } else {
      if (url.startsWith("/")) return hostUrl + url;
    }
    return hostUrl + "/" + url;
  }

  private static fetchLinkContentAsJSON(link: OgcOpenApiCapabilitiesCollectionServiceLinkType, options?: FetchLinkContentOptions) {
    return new Promise((resolve) => {
      const MyProxy = OgcOpenApiGetCapabilities.Proxify({
        requestHeaders: options.requestHeaders,
        useProxy: OgcOpenApiGetCapabilities.hasProxy(),
        indexes: { link: OgcOpenApiGetCapabilities.cleanUrl(OgcOpenApiGetCapabilities.addHostURL(link.href, options?.hostUrl)) },
      });
      fetch(MyProxy.urls.link, {
        method: 'GET',
        credentials: options.credentials ? "same-origin" : "omit",
        headers: MyProxy.headers,
      }).then(
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
}

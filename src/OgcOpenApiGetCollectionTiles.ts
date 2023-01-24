import {
    CollectionLinkType,
    OgcOpenApiCapabilitiesCollection, OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities
} from "./OgcOpenApiGetCapabilities";

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
}

export interface TileSetMeta {
    id: string;
    title: string;
    links: LinkType[];
}

class OgcOpenApiGetCollectionTiles {
    private collection: OgcOpenApiCapabilitiesCollection;
    private capabilities: OgcOpenApiCapabilitiesObject;

    constructor(collection: OgcOpenApiCapabilitiesCollection, capabilities: OgcOpenApiCapabilitiesObject) {
        this.collection = collection;
        this.capabilities = capabilities;
    }

    public fetchTileset(tileset: TileSetMeta) {
        return new Promise<TileSetData>((resolve, reject) =>{
            let jsonLink = tileset.links.find(l=>l.type ? l.type==="application/json" : false) ;
            jsonLink = jsonLink ? jsonLink : tileset.links[0];
            const href = OgcOpenApiGetCapabilities.cleanUrl(jsonLink.href);
            const url = OgcOpenApiGetCapabilities.addHostURL(href, this.capabilities.hostUrl);
            fetch(url, {
                method:"GET",
                credentials: "omit",
                headers: {}
            }).then( result => {
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

    public fetchTileSets() {
        return new Promise<TileSetMeta[]>((resolve, reject)=> {
            // const links = OgcOpenApiGetCapabilities.filterCollectionLinks(this.collection.links, CollectionLinkType.Tiles);
            // const linksFiltered = links.filter(l=>l.type==="application/json");
            // const linkFinal = linksFiltered.length>0 ? linksFiltered : links;
            // const url = OgcOpenApiGetCapabilities.addHostURL(linkFinal[0].href, this.capabilities.hostUrl);

            const url = this.capabilities.baseUrl + "tileMatrixSets";

            fetch(url, {
                method:"GET",
                credentials: "omit",
                headers: {}
            }).then( result => {
                if (result.status === 200) {
                    result.json().then((data) => {
                          if (data.tileMatrixSets) {
                              resolve(data.tileMatrixSets)
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

    public getTilesLink(
        currentCollection: OgcOpenApiCapabilitiesCollection,
    ) {
        const dataLink = OgcOpenApiGetCapabilities.filterCollectionLinks(
            currentCollection.links,
            CollectionLinkType.Tiles
        ).find((link) => link.type === "application/json");
        const href = dataLink ? dataLink.href : '';
        const url = OgcOpenApiGetCapabilities.addHostURL(href, this.capabilities.hostUrl);
        return OgcOpenApiGetCapabilities.cleanUrl(url);
    }
}

export {
    OgcOpenApiGetCollectionTiles
}
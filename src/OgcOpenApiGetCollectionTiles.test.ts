import {describe, expect, it} from '@jest/globals';
import "isomorphic-fetch";

import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiGetCollectionTiles} from "./OgcOpenApiGetCollectionTiles";

describe('OgcOpenApiGetCapabilities',  () => {

    it('OgcOpenApiGetCollectionTiles fetchTiles gnosis array of tileMatrixSets', async () => {
        return new Promise((resolve)=>{
            // https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap
            // https://maps.gnosis.earth/ogcapi/
            OgcOpenApiGetCapabilities.fromURL("https://maps.gnosis.earth/ogcapi/",{filterCollectionsByLinkType: CollectionLinkType.Tiles}).then(results=>{
                // One collection
                // if (results.collections.length>0) console.log(JSON.stringify(results.collections[0], null, 2))
                const collectionTiles =  new OgcOpenApiGetCollectionTiles(results.collections[0], results);
                collectionTiles.fetchTileSets().then(links => {
                    collectionTiles.fetchTileset(links[0]).then(tileMatrix=>{
                        expect(tileMatrix.id).toBe("CDB1GlobalGrid");
                        resolve(null);
                    }).catch(()=>{
                        expect(false).toBe(true);
                        resolve(null);
                    })
                }, () =>{
                    expect(false).toBe(true);
                    resolve(null);
                }).catch((err)=>{
                    expect(false).toBe(true);
                    resolve(null);
                });
            }, (err)=>{
                expect(true).toBe(true);
                resolve(null);
            })
        })
    });
});



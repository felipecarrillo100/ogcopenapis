import {describe, expect, it} from '@jest/globals';
import "isomorphic-fetch";

import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";

        describe('OgcOpenApiGetCapabilities',  () => {

            it('OgcOpenApiGetCapabilities.fromURL gnosis links filtered by Map', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://maps.gnosis.earth/ogcapi/",{filterCollectionsByLinkType: CollectionLinkType.Map}).then(data=>{
                  //  if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBe(742);
                }, (err)=>{
                    expect(false).toBe(true);
                })
            });


            it('OgcOpenApiGetCapabilities.fromURL gnosis links filtered by TileSets', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://maps.gnosis.earth/ogcapi/",{filterCollectionsByLinkType: CollectionLinkType.Tiles}).then(data=>{
                    expect(data.collections.length).toBe(742);
                }, (err)=>{
                    expect(false).toBe(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL cubewerx links filtered by Styles', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/",{filterCollectionsByLinkType: CollectionLinkType.Styles}).then(data=>{
                  //  if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBe(1);
                }, (err)=>{
                    expect(false).toBe(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL gnosis links filtered by Styles', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://maps.gnosis.earth/ogcapi/",{filterCollectionsByLinkType: CollectionLinkType.Styles}).then(data=>{
                    // if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBe(633);
                }, (err)=>{
                    expect(false).toBe(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL success', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{}).then(data=>{
                    expect(data.version).toBe("3.0.2");
                }, (err)=>{
                    expect(false).toBe(true);
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL pygeoapi all links', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{}).then(data=>{
                    // if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBe(16);
                }, (err)=>{
                    expect(false).toBe(true);
                })
            });


            it('OgcOpenApiGetCapabilities.fromURL success links filtered', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{filterCollectionsByLinkType: CollectionLinkType.Items}).then(data=>{
                    expect(data.collections.length).toBe(14);
                }, (err)=>{
                    expect(false).toEqual(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL 404', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master2/",{}).then(data=>{
                    expect(data.version).toBe("3.0.1");
                }, (err)=>{
                    expect(404).toBe(404);
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL Not JSON', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/",{}).then(data=>{
                    expect(data.version).toBe("3.0.1");
                }, (err)=>{
                    expect(err).toEqual("Not JSON");
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL Not valid API', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://jsonplaceholder.typicode.com/todos/",{}).then(data=>{
                    expect(data.version).toBe("3.0.1");
                }, (err)=>{
                    expect(err).toEqual("Invalid format: (property 'links' is missing)");
                })
            });

            it('OgcOpenApiGetCapabilities.getHostURL relative url', async () => {
                expect(OgcOpenApiGetCapabilities.getHostURL("../api/user/proxy/auto_1674068062840")).toEqual("")
            });

            it('OgcOpenApiGetCapabilities.getHostURL full url', async () => {
                expect(OgcOpenApiGetCapabilities.getHostURL("https://demo.pygeoapi.io/master2/")).toEqual("https://demo.pygeoapi.io")
            });

            it('OgcOpenApiGetCapabilities.getHostURL localhost', async () => {
                expect(OgcOpenApiGetCapabilities.getHostURL("http://localhost:8080/api/user/proxy/auto_1674072985294_1")).toEqual("http://localhost:8080")
            });

            it('OgcOpenApiGetCapabilities.cleanUrl with api/?f=json', async () => {
                expect(OgcOpenApiGetCapabilities.cleanUrl("http://localhost:8080/api/?f=json")).toEqual("http://localhost:8080/api/")
            });
            it('OgcOpenApiGetCapabilities.cleanUrl with api?f=json', async () => {
                expect(OgcOpenApiGetCapabilities.cleanUrl("http://localhost:8080/api?f=json")).toEqual("http://localhost:8080/api/")
            });
            it('OgcOpenApiGetCapabilities.cleanUrl with api/', async () => {
                expect(OgcOpenApiGetCapabilities.cleanUrl("http://localhost:8080/api/")).toEqual("http://localhost:8080/api/")
            });
            it('OgcOpenApiGetCapabilities.cleanUrl with /api', async () => {
                expect(OgcOpenApiGetCapabilities.cleanUrl("http://localhost:8080/api")).toEqual("http://localhost:8080/api/")
            });
            it('OgcOpenApiGetCapabilities.cleanUrl with some/api/?f=json', async () => {
                expect(OgcOpenApiGetCapabilities.cleanUrl("http://localhost:8080/some/api/?f=json")).toEqual("http://localhost:8080/some/api/")
            });

        });



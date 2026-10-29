import {describe, expect, it} from 'vitest';

import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";

        describe('OgcOpenApiGetCapabilities',  () => {

            it('OgcOpenApiGetCapabilities.fromURL gnosis links filtered by Map', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://maps.gnosis.earth/ogcapi/",{filterCollectionsByLinkType: CollectionLinkType.Map}).then(data=>{
                  //  if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBeGreaterThanOrEqual(700);
                }, ()=>{
                    expect(false).toBe(true);
                })
            });


            it('OgcOpenApiGetCapabilities.fromURL gnosis links filtered by TileSets', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://maps.gnosis.earth/ogcapi/",{filterCollectionsByLinkType: CollectionLinkType.Tiles}).then(data=>{
                    expect(data.collections.length).toBeGreaterThanOrEqual(700);
                }, ()=>{
                    expect(false).toBe(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL gnosis links filtered by Features', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://api.pdok.nl/lv/bgt/ogc/v1/",{filterCollectionsByLinkType: CollectionLinkType.Items}).then(data=>{
                    expect(data.collections.length).toBeGreaterThanOrEqual(40);
                }, ()=>{
                    expect(false).toBe(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL cubewerx links filtered by Styles', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/",{filterCollectionsByLinkType: CollectionLinkType.Styles}).then(data=>{
                  //  if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBe(1);
                }, ()=>{
                    expect(false).toBe(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL gnosis links filtered by Styles', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://maps.gnosis.earth/ogcapi/",{filterCollectionsByLinkType: CollectionLinkType.Styles}).then(data=>{
                    // if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBeGreaterThanOrEqual(632);
                }, ()=>{
                    expect(false).toBe(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL success', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{}).then(data=>{
                    expect(data.version).toBe("3.0.2");
                }, ()=>{
                    expect(false).toBe(true);
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL pygeoapi all links', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{}).then(data=>{
                    // if (data.collections.length>0) console.log(JSON.stringify(data.collections[0], null, 2))
                    expect(data.collections.length).toBeGreaterThanOrEqual(16);
                }, ()=>{
                    expect(false).toBe(true);
                })
            });


            it('OgcOpenApiGetCapabilities.fromURL success links filtered', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{filterCollectionsByLinkType: CollectionLinkType.Items}).then(data=>{
                    expect(data.collections.length).toBe(14);
                }, ()=>{
                    expect(false).toEqual(true);
                })
            });

            it('OgcOpenApiGetCapabilities.fromURL 404', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master2/",{}).then(data=>{
                    expect(data.version).toBe("3.0.1");
                }, ()=>{
                    expect(404).toBe(404);
                })
            });
            // An HTML page, not an OGC API landing page
            it('OgcOpenApiGetCapabilities.fromURL Not JSON', async () => {
                await expect(OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/", {})).rejects.toThrow("Not JSON data");
            });
            // JSON, but not an OGC API landing page
            it('OgcOpenApiGetCapabilities.fromURL Not valid API', async () => {
                await expect(OgcOpenApiGetCapabilities.fromURL("https://jsonplaceholder.typicode.com/todos/", {})).rejects.toThrow("Invalid format: (property 'links' is missing)");
            });

            it('OgcOpenApiGetCapabilities.getFilterSupport ldproxy filters in both CQL2 encodings', async () => {
                const support = OgcOpenApiGetCapabilities.getFilterSupport(await OgcOpenApiGetCapabilities.fromURL("https://demo.ldproxy.net/daraa/"));
                expect(support.filter).toBe(true);
                expect(support.encodings).toEqual(expect.arrayContaining(["cql2-text", "cql2-json"]));
                expect(support.levels).toContain("basic-cql2");
            });

        });



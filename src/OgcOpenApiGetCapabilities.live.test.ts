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

            // ldproxy and PDOK list no queryables link in /collections: the path of the standard
            it.each([
                ["ldproxy", "https://demo.ldproxy.net/daraa/", "TransportationGroundCrv", "F_CODE"],
                ["PDOK", "https://api.pdok.nl/lv/bgt/ogc/v1/", "bord", "plus_type"],
                ["pygeoapi", "https://demo.pygeoapi.io/master/", "lakes", "scalerank"],
                ["CubeWerx", "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa/", "TransportationGroundCrv", "AOO"],
            ])('OgcOpenApiGetCapabilities.fetchQueryables %s', async (_name, url, id, property) => {
                const capabilities = await OgcOpenApiGetCapabilities.fromURL(url);
                const queryables = await OgcOpenApiGetCapabilities.fetchQueryables(capabilities, capabilities.collections.find(c => c.id === id));
                expect(queryables.properties[property].type).toMatch(/string|integer|number/);
                expect(queryables.properties.geometry["x-ogc-role"]).toBe("primary-geometry");
            });

            // PDOK sends keyword objects of OWS Common, pygeoapi strings as OGC API Common Part 2 defines them
            it.each([
                ["PDOK", "https://api.pdok.nl/lv/bgt/ogc/v1/", "wegdeel", "wegdeel"],
                ["pygeoapi", "https://demo.pygeoapi.io/master/", "obs", "observations"],
            ])('OgcOpenApiGetCapabilities.fromURL keywords are strings, %s', async (_name, url, id, keyword) => {
                const capabilities = await OgcOpenApiGetCapabilities.fromURL(url);
                const keywords = capabilities.collections.find(c => c.id === id).keywords;
                expect(keywords).toContain(keyword);
                expect(keywords.every(k => typeof k === "string")).toBe(true);
            });

            it('OgcOpenApiGetCapabilities.fetchQueryables pygeoapi, a collection without features', async () => {
                const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/");
                expect(await OgcOpenApiGetCapabilities.fetchQueryables(capabilities, capabilities.collections.find(c => c.id === "icoads-sst"))).toBeNull();
            });

        });



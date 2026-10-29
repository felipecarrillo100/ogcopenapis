import {describe, expect, it} from 'vitest';

import {type OgcOpenApiFeatureQueryResult, OgcOpenApiFeatureStore} from "./OgcOpenApiFeatureStore";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createBounds} from "@luciad/ria/shape/ShapeFactory";
import {Cursor} from "@luciad/ria/model/Cursor";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel";


        describe('OgcOpenApiFeatureStore ',  () => {
            const model = {
                "generateIDs":false,"outputFormat":"application/geo+json",
                "dataUrl":"https://demo.pygeoapi.io/master/collections/lakes/items",
                "extent":{"spatial":{"bbox":[[-180,-90,180,90]],
                        "crs":"http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                    "temporal":{"interval":[["2011-11-11T00:00:00+00:00",null]]}},
                "tmp_reference":"CRS:84",
                "typeName":"lakes",
                "versions":["3.0.2"],
                "methods":["POST"],
                "useProxy":false,
                "beforeProxy":"https://demo.pygeoapi.io/master/collections/lakes/items",
                "credentials":false,
                "requestHeaders":{}
            }

            const store = new OgcOpenApiFeatureStore({
                dataUrl: model.dataUrl,
                outputFormat: model.outputFormat,
                codec: new GeoJsonCodec({generateIDs: false}),
                reference: getReference(model.tmp_reference),
                requestHeaders:{},
                featureUrl: model.dataUrl,
                useCrs84Bounds: true,
                customCrs: model.tmp_reference,
            })

            const storeWindmills = new OgcOpenApiFeatureStore({
                dataUrl: "https://demo.pygeoapi.io/master/collections/dutch_windmills/items",
                outputFormat: model.outputFormat,
                codec: new GeoJsonCodec({generateIDs: false}),
                reference: getReference(model.tmp_reference),
                requestHeaders:{},
                featureUrl: model.dataUrl,
                useCrs84Bounds: true,
                customCrs: model.tmp_reference,
            })

            it('OgcOpenApiFeatureStore.get feature', async () => {
                return store.get(1).then(feature => {
                    // One feature
                    // console.log(JSON.stringify(feature.properties, null, 2))
                    expect(feature.id).toBe(1);
                }, () => {
                    expect(2).toBe(3);
                })
            });

            it('OgcOpenApiFeatureStore.spatialQuery', async () => {
                const query = {"filter":null,"limit":1000};
                const bounds = createBounds(getReference(model.tmp_reference), [ 3.40, 0.6, 51.15, 0.15])

                const promiseToCursor = storeWindmills.spatialQuery(bounds, query) as Promise<Cursor>;
                return promiseToCursor.then(cursor => {
                    let counter = 0
                    while (cursor.hasNext()) {
                        cursor.next();
                        counter++;
                    }
                    expect(counter).toBeGreaterThanOrEqual(5);
                }, () => {
                    expect(true).toBe(false);
                })
            });

            it('OgcOpenApiFeatureStore.spatialQuery with limit 2', async () => {
                const query = {"filter":null,"limit":2};
                const bounds = createBounds(getReference(model.tmp_reference), [ 3.40, 0.6, 51.15, 0.15])

                const promiseToCursor = storeWindmills.spatialQuery(bounds, query) as Promise<Cursor>;
                return promiseToCursor.then(cursor => {
                    let counter = 0
                    while (cursor.hasNext()) {
                        cursor.next();
                        counter++;
                    }
                    expect(counter).toBeGreaterThanOrEqual(2);
                }, () => {
                    expect(true).toBe(false);
                })
            });

            it('OgcOpenApiFeatureStore reports its operations to a FeatureModel', async () => {
                const featureModel = new FeatureModel(storeWindmills, {reference: getReference(model.tmp_reference)});
                expect(featureModel.isOperationSupported("get")).toBe(true);
                expect(featureModel.isOperationSupported("spatialQuery")).toBe(true);
                expect(featureModel.isOperationSupported("add")).toBe(false);

                const bounds = createBounds(getReference(model.tmp_reference), [ 3.40, 0.6, 51.15, 0.15])
                const cursor = await featureModel.spatialQuery(bounds, {"filter":null,"limit":2});
                expect(cursor.hasNext()).toBe(true);
            });
        })



// The filtered requests of the client report on numberMatched, 29 October 2026
describe('OgcOpenApiFeatureStore onQueryResult', () => {
    it.each([
        ["ldproxy", "https://demo.ldproxy.net/daraa/collections/TransportationGroundCrv/items?f=json", "F_CODE='AP030'", {numberReturned: 1000, hasNext: true}, true],
        ["PDOK, no numberMatched", "https://api.pdok.nl/lv/bgt/ogc/v1/collections/bord/items?f=json", "plus_type='informatiebord'", {numberReturned: 1000, hasNext: true}, false],
        ["pygeoapi, caps limit at 10", "https://demo.pygeoapi.io/master/collections/lakes/items?f=json", "scalerank=0", {numberReturned: 10, hasNext: true}, true],
    ])('%s', async (_name, dataUrl, filter, size, matched) => {
        const results: OgcOpenApiFeatureQueryResult[] = [];
        const store = new OgcOpenApiFeatureStore({
            dataUrl, outputFormat: "application/geo+json", codec: new GeoJsonCodec({generateIDs: false}),
            crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84", onQueryResult: result => results.push(result),
        });
        await store.query({filter, "filter-lang": "cql2-text", limit: 1000});
        expect(results.length).toBe(1);
        expect(results[0]).toMatchObject(size);
        if (matched) expect(results[0].numberMatched).toBeGreaterThan(results[0].numberReturned);
        else expect(results[0]).not.toHaveProperty("numberMatched");
    });
});

import {describe, expect, it} from '@jest/globals';
import {jest} from '@jest/globals';
import "isomorphic-fetch";

import {OgcOpenApiFeatureStore} from "./OgcOpenApiFeatureStore";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createBounds} from "@luciad/ria/shape/ShapeFactory";
import {Cursor} from "@luciad/ria/model/Cursor";

jest.useFakeTimers();

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
        })



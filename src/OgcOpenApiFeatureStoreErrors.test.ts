import {afterEach, describe, expect, it, jest} from '@jest/globals';
// Provides fetch and Response in jsdom, fetch is mocked below
import "isomorphic-fetch";
import {OgcOpenApiFeatureStore} from "./OgcOpenApiFeatureStore";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createBounds} from "@luciad/ria/shape/ShapeFactory";
import {Cursor} from "@luciad/ria/model/Cursor";

// Offline tests: fetch is mocked, so every failure can be reproduced
const DATA_URL = "https://example.com/collections/c/items?f=json";
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";

const FEATURE = {type: "Feature", id: 1, geometry: {type: "Point", coordinates: [5, 52]}, properties: {name: "a"}};
const COLLECTION = {type: "FeatureCollection", features: [FEATURE]};

function createStore() {
    return new OgcOpenApiFeatureStore({
        dataUrl: DATA_URL,
        outputFormat: "application/geo+json",
        codec: new GeoJsonCodec({generateIDs: false}),
        crs: CRS84,
        useCrs84Bounds: true,
    });
}

function respond(status: number, body: string, headers: { [key: string]: string } = {}) {
    return jest.spyOn(globalThis, "fetch").mockImplementation(() =>
        Promise.resolve(new Response(body, {status, headers: {"Content-Type": "application/geo+json", ...headers}})));
}

function countFeatures(cursor: Cursor) {
    let count = 0;
    while (cursor.hasNext()) {
        cursor.next();
        count++;
    }
    return count;
}

const bounds = () => createBounds(getReference("CRS:84"), [4, 2, 51, 2]);

describe('OgcOpenApiFeatureStore errors', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('get rejects when the server answers 404', async () => {
        respond(404, '{"code":"NotFound"}');
        await expect(createStore().get(7)).rejects.toThrow("Invalid response: 404");
    });

    it('query rejects when the server answers 500', async () => {
        respond(500, "Internal Server Error");
        await expect(createStore().spatialQuery(bounds()) as Promise<Cursor>).rejects.toThrow("Invalid response: 500");
    });

    it('query rejects when the request fails', async () => {
        jest.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));
        await expect(createStore().spatialQuery(bounds()) as Promise<Cursor>).rejects.toThrow("Failed to fetch");
    });

    it('get rejects when the response cannot be decoded', async () => {
        respond(200, "this is not GeoJSON");
        await expect(createStore().get(1)).rejects.toBeDefined();
    });

    it('query rejects when the Content-Crs is not a known reference', async () => {
        respond(200, JSON.stringify(COLLECTION), {"Content-Crs": "<http://www.opengis.net/def/crs/EPSG/0/999999>"});
        await expect(createStore().spatialQuery(bounds()) as Promise<Cursor>).rejects.toBeDefined();
    });

    it('query passes the abortSignal of LuciadRIA to fetch, and rejects when it is aborted', async () => {
        const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation((input, init) => new Promise((resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
        }));
        const controller = new AbortController();
        const result = createStore().spatialQuery(bounds(), undefined, {abortSignal: controller.signal}) as Promise<Cursor>;
        controller.abort();
        await expect(result).rejects.toThrow("aborted");
        expect(fetchSpy.mock.calls[0][1].signal).toBe(controller.signal);
    });
});

describe('OgcOpenApiFeatureStore decoding', () => {

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('get decodes a feature', async () => {
        respond(200, JSON.stringify(FEATURE));
        const feature = await createStore().get(1);
        expect(feature.id).toBe(1);
        expect(feature.properties.name).toBe("a");
    });

    it('get decodes GeoJSON that names the CRS84 URI, without rewriting it', async () => {
        respond(200, JSON.stringify({...FEATURE, crs: {type: "name", properties: {name: CRS84}}}));
        const feature = await createStore().get(1);
        expect(feature.shape.reference.identifier).toBe("CRS:84");
        expect([(feature.shape as any).x, (feature.shape as any).y]).toEqual([5, 52]);
    });

    it('get resolves null when the response has no feature', async () => {
        respond(200, JSON.stringify({type: "FeatureCollection", features: []}));
        expect(await createStore().get(1)).toBeNull();
    });

    it('query decodes a feature collection', async () => {
        respond(200, JSON.stringify(COLLECTION));
        expect(countFeatures(await (createStore().spatialQuery(bounds()) as Promise<Cursor>))).toBe(1);
    });
});

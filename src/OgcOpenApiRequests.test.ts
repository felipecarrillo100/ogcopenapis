import {afterEach, describe, expect, it, vi} from 'vitest';
import {
    type OgcOpenApiCapabilitiesCollection,
    type OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities
} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";
import {OgcOpenApiStyleTools} from "./OgcOpenApiStyleTools";
import {OgcOpenApiFeatureStore} from "./OgcOpenApiFeatureStore";
import {OgcOpenApiVectorTilesModel} from "./OgcOpenApiVectorTilesModel";
import {OgcOpenApiError} from "./OgcOpenApiError";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import type {TileSetData} from "./OgcOpenApiGetCapabilities";
import WebMercatorQuadJson from "./fixtures/tms-WebMercatorQuad.json";

// The requests the library makes itself, each through a public entry point, with the credentials option
const BASE = "https://x.test/";

function server(): OgcOpenApiCapabilitiesObject {
    return {
        name: "", collections: [], version: "", service: "", info: {}, baseUrl: BASE,
        serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: BASE}),
    };
}

const ROADS: OgcOpenApiCapabilitiesCollection = {
    id: "roads", name: "roads", title: "roads", defaultReference: "CRS:84", outputFormats: [], description: "", keywords: [], extent: {},
    links: [{rel: "items", type: "application/geo+json", title: "", href: BASE + "collections/roads/items?f=json"}],
};

type Request = (credentials?: boolean) => Promise<unknown>;
const REQUESTS: { [name: string]: Request } = {
    "fromURL": credentials => OgcOpenApiGetCapabilities.fromURL(BASE, {credentials}),
    "fetchQueryables": credentials => OgcOpenApiGetCapabilities.fetchQueryables(server(), ROADS, {credentials}),
    "fetchTileSetsInFull": credentials => OgcOpenApiGetCapabilities.fetchTileSetsInFull(server(), {credentials}),
    "fetchStyles": credentials => OgcOpenApiStyleTools.fetchStyles(server(), null, {credentials}),
    "fetchMapStyles": credentials => OgcOpenApiStyleTools.fetchMapStyles(server(), null, {credentials}),
    "fetchMapboxStyle": credentials => OgcOpenApiStyleTools.fetchMapboxStyle(server(), {rel: "stylesheet", type: "", title: "", href: BASE + "styles/night"}, {credentials}),
    "OgcOpenApiFeatureStore": credentials => new OgcOpenApiFeatureStore({
        dataUrl: BASE + "collections/roads/items?f=json", outputFormat: "application/geo+json", codec: new GeoJsonCodec({generateIDs: false}),
        crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84", useCrs84Bounds: true, credentials,
    }).get(7),
    "OgcOpenApiVectorTilesModel": credentials => new OgcOpenApiVectorTilesModel({
        tileMatrix: WebMercatorQuadJson as unknown as TileSetData, collection: "roads", credentials,
        baseURL: BASE + "collections/roads/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}",
    }).getVectorTile({level: 2, x: 1, y: 3}),
};

// Every request answers the same, and the fetch options of each are kept
function answer(response: () => Response) {
    const credentials: RequestCredentials[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        credentials.push(init?.credentials);
        return response();
    });
    return credentials;
}

const unauthorized = () => new Response("", {status: 401, headers: {"WWW-Authenticate": 'Basic realm="x"'}});

describe('The credentials option, as in LuciadRIA', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const [name, request] of Object.entries(REQUESTS)) {
        it(name + ": true includes the credentials, false and unset only for the same origin", async () => {
            const modes = answer(unauthorized);
            for (const credentials of [true, false, undefined]) {
                await request(credentials).catch(() => undefined);
            }
            expect(modes).toEqual(["include", "same-origin", "same-origin"]);
        });
    }
});

describe('A failed request rejects with an OgcOpenApiError that has the HTTP status', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const [name, request] of Object.entries(REQUESTS)) {
        it(name + ": 401", async () => {
            answer(unauthorized);
            const error = await request().then(() => undefined, e => e);
            expect(error).toBeInstanceOf(OgcOpenApiError);
            expect(error).toBeInstanceOf(Error);
            expect(error).toMatchObject({name: "OgcOpenApiError", error: true, status: 401, url: expect.stringMatching(/^https:\/\/x\.test\//)});
            expect(error.message).toMatch(/^Invalid response: 401/);
            expect(error.problem).toBeUndefined();
        });
    }

    it('Keeps the messages of earlier versions', async () => {
        answer(unauthorized);
        await expect(REQUESTS.fromURL()).rejects.toThrow("Invalid response: 401 for " + BASE);
        await expect(REQUESTS.fetchQueryables()).rejects.toThrow("Invalid response: 401 for " + BASE + "collections/roads/queryables");
        await expect(REQUESTS.fetchStyles()).rejects.toThrow(/^Invalid response: 401$/);
    });

    it('Has the problem details of an application/problem+json answer (RFC 9457)', async () => {
        const problem = {type: "about:blank", title: "Forbidden", status: 403, detail: "No access to roads", "x-reason": "role"};
        answer(() => new Response(JSON.stringify(problem), {status: 403, headers: {"Content-Type": "application/problem+json; charset=utf-8"}}));
        for (const request of Object.values(REQUESTS)) {
            const error = await request().then(() => undefined, e => e);
            expect(error).toMatchObject({status: 403, problem});
        }
    });

    it('Leaves problem out when the body is not a problem, and keeps the status', async () => {
        const bodies = [
            () => new Response("<html>Forbidden</html>", {status: 403, headers: {"Content-Type": "text/html"}}),
            () => new Response("not json", {status: 403, headers: {"Content-Type": "application/problem+json"}}),
            () => new Response("[1]", {status: 403, headers: {"Content-Type": "application/problem+json"}}),
        ];
        for (const body of bodies) {
            answer(body);
            const error = await REQUESTS.fromURL().then(() => undefined, e => e);
            expect(error).toBeInstanceOf(OgcOpenApiError);
            expect(error.status).toBe(403);
            expect(error.problem).toBeUndefined();
            vi.restoreAllMocks();
        }
    });

    it('A request that fails without an answer rejects with the error of fetch', async () => {
        for (const request of Object.values(REQUESTS)) {
            vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
            const error = await request().then(() => undefined, e => e);
            expect(error).toBeInstanceOf(TypeError);
            expect(error).not.toBeInstanceOf(OgcOpenApiError);
            vi.restoreAllMocks();
        }
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("aborted", "AbortError"));
        await expect(REQUESTS.fetchStyles()).rejects.toMatchObject({name: "AbortError"});
    });

    it('A failure without an answer of the server has no status', async () => {
        const noCapabilities = await OgcOpenApiStyleTools.fetchStyles(null, null).then(() => undefined, e => e);
        expect(noCapabilities).toBeInstanceOf(OgcOpenApiError);
        expect(noCapabilities).toMatchObject({name: "OgcOpenApiError", error: true, message: "No capabilities"});
        expect(noCapabilities.status).toBeUndefined();
        await expect(OgcOpenApiGetCapabilities.fetchCollectionTileSets(null, ROADS)).rejects.toBeInstanceOf(OgcOpenApiError);
        answer(() => new Response("not json", {status: 200}));
        const notJson = await REQUESTS.fetchTileSetsInFull().then(() => undefined, e => e);
        expect(notJson).toMatchObject({message: "Not JSON data", url: BASE + "tileMatrixSets"});
        expect(notJson.status).toBeUndefined();
    });
});

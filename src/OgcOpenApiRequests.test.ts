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

describe('The requestHeaders and credentials of the app go only to the server\'s origin', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // The server links its collections, queryables, styles and a stylesheet on another origin (report 15)
    const SERVER = "https://server.test/ogcapi/";
    const OTHER = "https://other.test";
    const DOCUMENTS = {
        [SERVER]: {links: [{rel: "data", href: OTHER + "/collections", type: "application/json"}]},
        [OTHER + "/collections"]: {collections: [{id: "roads", links: [
            {rel: "items", href: SERVER + "collections/roads/items", type: "application/geo+json"},
            {rel: "http://www.opengis.net/def/rel/ogc/1.0/queryables", href: OTHER + "/roads/queryables", type: "application/schema+json"},
            {rel: "http://www.opengis.net/def/rel/ogc/1.0/styles", href: OTHER + "/roads/styles", type: "application/json"},
        ]}]},
        [OTHER + "/roads/queryables"]: {type: "object", properties: {}},
        [OTHER + "/roads/styles?f=json"]: {styles: []},
        [OTHER + "/roads/styles/night"]: {version: 8, sources: {}, layers: []},
    };
    const APP = {requestHeaders: {Authorization: "Basic dXNlcjpwYXNz", "x-api-key": "k"}, credentials: true};

    type Sent = { url: string, authorization: string | null, apiKey: string | null, accept: string | null, credentials: RequestCredentials };
    function serveDocuments(documents: { [url: string]: object } = DOCUMENTS) {
        const sent: Sent[] = [];
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
            const url = String(input);
            const headers = new Headers(init?.headers);
            sent.push({url, authorization: headers.get("Authorization"), apiKey: headers.get("X-Api-Key"), accept: headers.get("Accept"), credentials: init?.credentials});
            return url in documents ? new Response(JSON.stringify(documents[url]), {status: 200}) : new Response("", {status: 404});
        });
        return sent;
    }

    async function readAll(options: object) {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(SERVER, options);
        const roads = capabilities.collections.find(c => c.id === "roads");
        await OgcOpenApiGetCapabilities.fetchQueryables(capabilities, roads, options);
        await OgcOpenApiStyleTools.fetchStyles(capabilities, roads, options);
        await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, {rel: "stylesheet", type: "", title: "", href: OTHER + "/roads/styles/night"}, options);
    }

    it('Sends them to the server, not to the other origin its links name, and keeps Accept', async () => {
        const sent = serveDocuments();
        await readAll(APP);
        const server = sent.filter(s => s.url.startsWith(SERVER));
        const other = sent.filter(s => s.url.startsWith(OTHER));
        expect(server.length).toBeGreaterThan(0);
        expect(other.length).toBe(4);
        for (const s of server) expect(s).toMatchObject({authorization: APP.requestHeaders.Authorization, apiKey: "k", credentials: "include"});
        for (const s of other) {
            expect(s).toMatchObject({authorization: null, apiKey: null, credentials: "same-origin"});
            expect(s.accept).toBeTruthy();
        }
    });

    it('Removes the headers of the app in any letter case, and keeps an Accept of the app', async () => {
        const sent = serveDocuments();
        await readAll({requestHeaders: {AUTHORIZATION: "Bearer t", "X-API-KEY": "k", Accept: "application/json"}});
        for (const s of sent.filter(s => s.url.startsWith(OTHER))) {
            expect(s).toMatchObject({authorization: null, apiKey: null});
        }
        expect(sent.find(s => s.url === OTHER + "/collections").accept).toBe("application/json");
    });

    it('Sends them to the origins in credentialsOrigins', async () => {
        const sent = serveDocuments();
        await readAll({...APP, credentialsOrigins: [OTHER]});
        for (const s of sent) expect(s).toMatchObject({authorization: APP.requestHeaders.Authorization, credentials: "include"});
    });

    it('http is another origin than https: a link of the server to http gets no credentials', async () => {
        const sent = serveDocuments({
            [SERVER]: {links: [{rel: "data", href: "http://server.test/ogcapi/collections", type: "application/json"}]},
            "http://server.test/ogcapi/collections": {collections: []},
        });
        await OgcOpenApiGetCapabilities.fromURL(SERVER, APP);
        expect(sent.map(s => [s.url, s.authorization])).toEqual([
            [SERVER, APP.requestHeaders.Authorization],
            ["http://server.test/ogcapi/collections", null],
        ]);
    });

    it('Decides on the origin of the link, not on the one proxify sends it to', async () => {
        const sent = serveDocuments(Object.fromEntries(Object.entries(DOCUMENTS).map(([url, body]) => ["https://proxy.test/?url=" + encodeURIComponent(url), body])));
        const proxify = (url: string, fetchOptions: RequestInit) => ({url: "https://proxy.test/?url=" + encodeURIComponent(url), fetchOptions});
        await readAll({...APP, proxify});
        const origin = (s: Sent) => new URL(decodeURIComponent(s.url.split("url=")[1])).origin;
        expect(sent.filter(s => origin(s) === "https://server.test").every(s => s.authorization !== null)).toBe(true);
        expect(sent.filter(s => origin(s) === OTHER).every(s => s.authorization === null)).toBe(true);
    });

    it('A relative proxy path is the server\'s', async () => {
        const sent = serveDocuments({
            "/proxy/ogcapi/": {links: [{rel: "data", href: "/proxy/ogcapi/collections", type: "application/json"}]},
            "/proxy/ogcapi/collections": {collections: []},
        });
        await OgcOpenApiGetCapabilities.fromURL("/proxy/ogcapi/", APP);
        expect(sent.length).toBe(2);
        for (const s of sent) expect(s.authorization).toBe(APP.requestHeaders.Authorization);
    });

    it('The models send them to the URLs the app gives', async () => {
        const sent = serveDocuments({});
        await REQUESTS.OgcOpenApiFeatureStore(true).catch(() => undefined);
        const store = new OgcOpenApiFeatureStore({
            dataUrl: OTHER + "/collections/roads/items?f=json", outputFormat: "application/geo+json", codec: new GeoJsonCodec({generateIDs: false}),
            crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84", useCrs84Bounds: true, credentials: true, requestHeaders: APP.requestHeaders,
        });
        await store.get(7).catch(() => undefined);
        const tiles = new OgcOpenApiVectorTilesModel({
            tileMatrix: WebMercatorQuadJson as unknown as TileSetData, collection: "roads", credentials: true, requestHeaders: APP.requestHeaders,
            baseURL: OTHER + "/collections/roads/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}",
        });
        await tiles.getVectorTile({level: 2, x: 1, y: 3}).catch(() => undefined);
        const fromApp = sent.filter(s => s.url.startsWith(OTHER));
        expect(fromApp.length).toBe(2);
        for (const s of fromApp) expect(s).toMatchObject({authorization: APP.requestHeaders.Authorization, credentials: "include"});
    });
});

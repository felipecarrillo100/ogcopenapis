import {afterEach, describe, expect, it, vi} from 'vitest';
import {
    type OgcOpenApiCapabilitiesCollection,
    type OgcOpenApiCapabilitiesCollectionServiceLinkType,
    type OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities
} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";

// Offline tests of the schema (Part 5) and of what a server advertises about writing (Part 4): fetch is mocked
const CRD_DRAFT2 = "http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/create-replace-delete";
const UPDATE_DRAFT2 = "http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/update";
const CRD_LDPROXY = "http://www.opengis.net/spec/ogcapi-features-4/0.0/conf/create-replace-delete";
const UPDATE_LDPROXY = "http://www.opengis.net/spec/ogcapi-features-4/0.0/conf/update";
const CRD_COMMON5 = "https://www.opengis.net/spec/ogcapi-common-5/1.0/conf/create-replace-delete";

const SCHEMA = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
        id: {type: "integer", "x-ogc-role": "id", readOnly: true},
        name: {type: "string"},
        geom: {format: "geometry-point", "x-ogc-role": "primary-geometry"},
    },
};

function server(url: string, conformsTo: string[] = []): OgcOpenApiCapabilitiesObject {
    return {
        name: "", collections: [], version: "", service: "", info: {}, baseUrl: url, conformsTo,
        serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: url}),
    };
}

const link = (rel: string, href: string, type?: string) => ({rel, type, title: "", href}) as OgcOpenApiCapabilitiesCollectionServiceLinkType;
const ITEMS_URL = "https://x.test/collections/poi/items";
const ITEMS = link("items", ITEMS_URL + "?f=json&apikey=k", "application/geo+json");

function collection(links: OgcOpenApiCapabilitiesCollectionServiceLinkType[], id = "poi"): OgcOpenApiCapabilitiesCollection {
    return {id, name: id, title: id, defaultReference: "CRS:84", outputFormats: [], description: "", keywords: [], extent: {}, links};
}

type Answer = () => Response;
const json = (body: object, status = 200) => () => new Response(JSON.stringify(body), {status});
const allow = (methods: string) => () => new Response(null, {status: 200, headers: {Allow: methods}});

// Answers each method and URL, and keeps the requests
function serve(answers: { [methodAndUrl: string]: Answer }) {
    const requests: { method: string, url: string, headers: Headers }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input), method = init?.method ? init.method : "GET";
        requests.push({method, url, headers: new Headers(init?.headers)});
        const answer = answers[method + " " + url];
        return answer ? answer() : new Response("", {status: 404});
    });
    return requests;
}

describe('OgcOpenApiGetCapabilities.fetchSchema', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Resolves the JSON Schema of the schema link, asking for JSON Schema', async () => {
        const requests = serve({"GET https://x.test/collections/poi/schema": json(SCHEMA)});
        const poi = collection([ITEMS, link("http://www.opengis.net/def/rel/ogc/1.0/schema", "https://x.test/collections/poi/schema", "application/schema+json")]);
        expect(await OgcOpenApiGetCapabilities.fetchSchema(server("https://x.test/"), poi)).toEqual(SCHEMA);
        expect(requests[0].headers.get("Accept")).toBe("application/schema+json, application/json");
    });

    it('Uses the path of the standard when the collection lists no schema link (ldproxy)', async () => {
        const requests = serve({"GET https://x.test/collections/poi/schema": json(SCHEMA)});
        expect(await OgcOpenApiGetCapabilities.fetchSchema(server("https://x.test/"), collection([ITEMS]))).toEqual(SCHEMA);
        expect(requests.map(r => r.url)).toEqual(["https://x.test/collections/poi/schema"]);
    });

    it('Resolves null for 404 (GeoServer), an answer that is no JSON Schema (QGIS Server), and a collection without features', async () => {
        serve({"GET https://y.test/collections/poi/schema": json({links: [], timeStamp: "2026-11-09T10:00:00Z"})});
        expect(await OgcOpenApiGetCapabilities.fetchSchema(server("https://x.test/"), collection([ITEMS]))).toBeNull();
        expect(await OgcOpenApiGetCapabilities.fetchSchema(server("https://y.test/"),
            collection([link("items", "https://y.test/collections/poi/items")]))).toBeNull();
        expect(await OgcOpenApiGetCapabilities.fetchSchema(server("https://x.test/"), collection([]))).toBeNull();
    });

    it('Rejects with the status of another answer', async () => {
        serve({"GET https://x.test/collections/poi/schema": () => new Response("no", {status: 401})});
        await expect(OgcOpenApiGetCapabilities.fetchSchema(server("https://x.test/"), collection([ITEMS]))).rejects.toMatchObject({status: 401});
    });
});

describe('OgcOpenApiGetCapabilities.fetchWriteSupport', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Reads the conformance classes in every URI family, and OPTIONS of the items without the query of the link (ldproxy 4.8)', async () => {
        const requests = serve({
            ["OPTIONS " + ITEMS_URL]: allow("HEAD,POST,GET,OPTIONS"),
            ["OPTIONS " + ITEMS_URL + "/7"]: allow("HEAD,DELETE,GET,OPTIONS,PUT,PATCH"),
        });
        const support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_LDPROXY, UPDATE_LDPROXY]),
            collection([ITEMS]), {featureId: 7, requestHeaders: {Authorization: "Bearer t"}});
        expect(support).toEqual({
            conformance: {createReplaceDelete: true, update: true},
            allow: {items: ["HEAD", "POST", "GET", "OPTIONS"], item: ["HEAD", "DELETE", "GET", "OPTIONS", "PUT", "PATCH"]},
            suggested: ["add", "put", "remove"],
            patch: true,
            issues: [],
        });
        expect(requests.map(r => r.headers.get("Authorization"))).toEqual(["Bearer t", "Bearer t"]);
    });

    it('Suggests only what Allow lists, per collection (pygeoapi, a read-only collection)', async () => {
        serve({["OPTIONS " + ITEMS_URL]: allow("HEAD, GET"), ["OPTIONS " + ITEMS_URL + "/1"]: allow("HEAD, GET")});
        const support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_DRAFT2]), collection([ITEMS]), {featureId: 1});
        expect(support.suggested).toEqual([]);
        expect(support.patch).toBe(false);
        expect(support.issues).toEqual(["The server declares create-replace-delete, but OPTIONS allows no write method"]);
    });

    it('Without a feature id, takes put and remove from the Allow of the items (QGIS Server lists them there)', async () => {
        serve({["OPTIONS " + ITEMS_URL]: allow("GET, OPTIONS, POST, DELETE, PUT, PATCH")});
        const support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_COMMON5]), collection([ITEMS]));
        expect(support.suggested).toEqual(["add", "put", "remove"]);
        expect(support.issues).toEqual([]);
    });

    it('Suggests nothing without create-replace-delete, and reports the write methods OPTIONS allows (QGIS Server 4.2)', async () => {
        serve({["OPTIONS " + ITEMS_URL]: allow("GET, OPTIONS, POST, DELETE, PUT, PATCH")});
        const support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/"), collection([ITEMS]));
        expect(support.conformance).toEqual({createReplaceDelete: false, update: false});
        expect(support.suggested).toEqual([]);
        expect(support.issues).toEqual(["OPTIONS allows POST, PUT, DELETE, but the server does not declare create-replace-delete"]);
    });

    it('Reports update without PATCH', async () => {
        serve({["OPTIONS " + ITEMS_URL]: allow("GET, POST, PUT, DELETE")});
        const support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_DRAFT2, UPDATE_DRAFT2]), collection([ITEMS]));
        expect(support.patch).toBe(false);
        expect(support.issues).toEqual(["The server declares update, but OPTIONS does not allow PATCH"]);
    });

    it('Leaves allow out, with an issue, when Allow cannot be read or OPTIONS fails, and keeps the conformance', async () => {
        serve({["OPTIONS " + ITEMS_URL]: () => new Response(null, {status: 200})});
        let support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_DRAFT2, UPDATE_DRAFT2]), collection([ITEMS]));
        expect(support.allow).toEqual({});
        expect(support.suggested).toEqual([]);
        expect(support.patch).toBe(true);
        expect(support.issues[0]).toContain("has no Allow header that can be read");
        vi.restoreAllMocks();

        vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));
        support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_DRAFT2]), collection([ITEMS]));
        expect(support.issues).toEqual(["OPTIONS " + ITEMS_URL + " failed: Failed to fetch"]);
        vi.restoreAllMocks();

        serve({});
        support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_DRAFT2]), collection([ITEMS]));
        expect(support.issues).toEqual(["OPTIONS " + ITEMS_URL + " answered 404"]);
    });

    it('Reports a collection without items, without requests', async () => {
        const requests = serve({});
        const support = await OgcOpenApiGetCapabilities.fetchWriteSupport(server("https://x.test/", [CRD_DRAFT2]), collection([]));
        expect(support.issues).toEqual(["The collection poi has no items link"]);
        expect(requests).toEqual([]);
    });
});

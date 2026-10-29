import {afterEach, describe, expect, it, vi} from 'vitest';
import {
    type OgcOpenApiCapabilitiesCollection,
    type OgcOpenApiCapabilitiesCollectionServiceLinkType,
    type OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities
} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";

const QUERYABLES = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
        F_CODE: {type: "string", title: "Feature Type Code", enum: ["AP030", "AP050"], "x-ogc-role": "type"},
        geometry: {format: "geometry-multilinestring", "x-ogc-role": "primary-geometry"},
    },
};

function server(url: string): OgcOpenApiCapabilitiesObject {
    return {
        name: "", collections: [], version: "", service: "", info: {}, baseUrl: url,
        serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: url}),
    };
}

const link = (rel: string, href: string, type?: string) => ({rel, type, title: "", href}) as OgcOpenApiCapabilitiesCollectionServiceLinkType;
const ITEMS = link("items", "https://x.test/collections/roads/items?f=json", "application/geo+json");
const REL = "http://www.opengis.net/def/rel/ogc/1.0/queryables";

function collection(links: OgcOpenApiCapabilitiesCollectionServiceLinkType[], id = "roads"): OgcOpenApiCapabilitiesCollection {
    return {id, name: id, title: id, defaultReference: "CRS:84", outputFormats: [], description: "", keywords: [], extent: {}, links};
}

type Answer = () => Response;
const json = (body: object, status = 200) => () => new Response(JSON.stringify(body), {status});

// Answers each URL, and keeps the requests with their Accept header
function serve(answers: { [url: string]: Answer }) {
    const requests: { [url: string]: string } = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        requests[url] = new Headers(init?.headers).get("Accept");
        const answer = answers[url];
        return answer ? answer() : new Response("", {status: 404});
    });
    return requests;
}

describe('OgcOpenApiGetCapabilities.fetchQueryables', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Resolves the JSON Schema as the server sends it, asking for JSON Schema', async () => {
        const requests = serve({"https://x.test/collections/roads/queryables": json(QUERYABLES)});
        const roads = collection([ITEMS, link(REL, "https://x.test/collections/roads/queryables")]);
        expect(await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), roads)).toEqual(QUERYABLES);
        expect(requests).toEqual({"https://x.test/collections/roads/queryables": "application/schema+json, application/json"});
    });

    it('Prefers the JSON Schema link, then JSON, then a link without type, never HTML (pygeoapi, PDOK)', async () => {
        const requests = serve({"https://x.test/collections/roads/queryables?f=json": json(QUERYABLES)});
        const roads = collection([ITEMS,
            link(REL, "https://x.test/collections/roads/queryables?f=html", "text/html"),
            link(REL, "https://x.test/collections/roads/queryables", undefined),
            link(REL, "https://x.test/collections/roads/queryables?f=json", "application/schema+json")]);
        expect(await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), roads)).toEqual(QUERYABLES);
        expect(Object.keys(requests)).toEqual(["https://x.test/collections/roads/queryables?f=json"]);
    });

    it('Accepts the short rel, queryables', async () => {
        serve({"https://x.test/q": json(QUERYABLES)});
        const roads = collection([ITEMS, link("queryables", "https://x.test/q", "application/json")]);
        expect(await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), roads)).toEqual(QUERYABLES);
    });

    it('Without a link, the path of the standard next to the self link, with its query (PDOK)', async () => {
        const requests = serve({"https://x.test/kadaster/collections/bak/queryables?f=json": json(QUERYABLES)});
        const bak = collection([ITEMS,
            link("self", "https://x.test/kadaster/collections/bak?f=html", "text/html"),
            link("self", "https://x.test/kadaster/collections/bak?f=json", "application/json")], "bak");
        expect(await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/lv/"), bak)).toEqual(QUERYABLES);
        expect(Object.keys(requests)).toEqual(["https://x.test/kadaster/collections/bak/queryables?f=json"]);
    });

    it('Without a link or a self link, the path of the standard under the landing page (ldproxy)', async () => {
        serve({"https://x.test/collections/roads/queryables": json(QUERYABLES)});
        expect(await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), collection([ITEMS]))).toEqual(QUERYABLES);
    });

    it('Resolves null without a request for a collection without features (pygeoapi answers 400 there)', async () => {
        const requests = serve({});
        const coverage = collection([link("http://www.opengis.net/def/rel/ogc/1.0/coverage", "https://x.test/collections/sst/coverage")], "sst");
        expect(await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), coverage)).toBeNull();
        expect(requests).toEqual({});
    });

    it('Resolves null when the queryables answer 404', async () => {
        serve({});
        expect(await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), collection([ITEMS]))).toBeNull();
    });

    it('Rejects with an Error for another status, a response that is not JSON, or JSON that is not a schema', async () => {
        const roads = collection([ITEMS]);
        const href = "https://x.test/collections/roads/queryables";
        serve({[href]: () => new Response("oops", {status: 500})});
        await expect(OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), roads)).rejects.toThrow("Invalid response: 500 for " + href);
        vi.restoreAllMocks();
        serve({[href]: () => new Response("<html></html>", {status: 200})});
        await expect(OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), roads)).rejects.toThrow("Not JSON data for " + href);
        vi.restoreAllMocks();
        serve({[href]: () => new Response("[]", {status: 200})});
        await expect(OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), roads)).rejects.toThrow("not a JSON Schema");
    });

    it('Rejects with the error of fetch as it is', async () => {
        serve({"https://x.test/collections/roads/queryables": () => { throw new DOMException("The operation was aborted.", "AbortError"); }});
        await expect(OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), collection([ITEMS]))).rejects.toMatchObject({name: "AbortError"});
    });

    it('requestHeaders can replace the Accept header', async () => {
        const requests = serve({"https://x.test/collections/roads/queryables": json(QUERYABLES)});
        await OgcOpenApiGetCapabilities.fetchQueryables(server("https://x.test/"), collection([ITEMS]), {requestHeaders: {Accept: "application/json"}});
        expect(requests["https://x.test/collections/roads/queryables"]).toBe("application/json");
    });

    it('Rejects without capabilities', async () => {
        await expect(OgcOpenApiGetCapabilities.fetchQueryables(null, collection([ITEMS]))).rejects.toThrow("No capabilities");
    });
});

import {afterEach, describe, expect, it, vi} from 'vitest';
import {OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";

// fromURL settles in every case, reported by a user of 1.1.0: it stayed pending when the collections could not be read
const LANDING = {links: [
    {rel: "data", type: "application/json", href: "https://x.test/collections"},
    {rel: "service-desc", type: "application/vnd.oai.openapi+json;version=3.0", href: "https://x.test/api"},
    {rel: "conformance", type: "application/json", href: "https://x.test/conformance"},
]};
const COLLECTIONS = {collections: [{id: "c", title: "C", links: []}]};

type Answer = (init: RequestInit) => Response | Promise<Response>;
const json = (body: object, status = 200) => () => new Response(JSON.stringify(body), {status});

// Answers each URL, and keeps the Accept header of each request
function serve(answers: { [url: string]: Answer }) {
    const accepts: { [url: string]: string } = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        accepts[url] = new Headers(init?.headers).get("Accept");
        const answer = answers[url];
        return answer ? answer(init) : new Response("", {status: 404});
    });
    return accepts;
}

const standard = (overrides: { [url: string]: Answer } = {}) => serve({
    "https://x.test/": json(LANDING),
    "https://x.test/collections": json(COLLECTIONS),
    "https://x.test/api": json({openapi: "3.0.0", info: {title: "API"}}),
    "https://x.test/conformance": json({conformsTo: ["http://www.opengis.net/spec/ogcapi-common-1/1.0/conf/core"]}),
    ...overrides,
});

describe('OgcOpenApiGetCapabilities.fromURL settles', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Resolves with the collections, the version of the API and the conformance classes', async () => {
        standard();
        const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://x.test/");
        expect(capabilities.collections.map(c => c.id)).toEqual(["c"]);
        expect(capabilities.version).toBe("3.0.0");
        expect(capabilities.conformsTo).toEqual(["http://www.opengis.net/spec/ogcapi-common-1/1.0/conf/core"]);
    });

    it('Rejects with an Error when the collections answer 500', async () => {
        standard({"https://x.test/collections": () => new Response("oops", {status: 500})});
        await expect(OgcOpenApiGetCapabilities.fromURL("https://x.test/")).rejects.toThrow("Invalid response: 500 for https://x.test/collections");
    });

    it('Rejects with an Error when the collections are not JSON', async () => {
        standard({"https://x.test/collections": () => new Response("<html></html>", {status: 200})});
        await expect(OgcOpenApiGetCapabilities.fromURL("https://x.test/")).rejects.toThrow("Not JSON data for https://x.test/collections");
    });

    it('Rejects when the collections document has no collections', async () => {
        standard({"https://x.test/collections": json({links: []})});
        await expect(OgcOpenApiGetCapabilities.fromURL("https://x.test/")).rejects.toThrow("property 'collections' is missing");
    });

    it('Rejects with the error of fetch as it is when the collections request fails', async () => {
        standard({"https://x.test/collections": () => { throw new TypeError("Failed to fetch"); }});
        await expect(OgcOpenApiGetCapabilities.fromURL("https://x.test/")).rejects.toThrow(TypeError);
    });

    it('Rejects with an AbortError when the collections request is aborted', async () => {
        standard({"https://x.test/collections": () => { throw new DOMException("The operation was aborted.", "AbortError"); }});
        await expect(OgcOpenApiGetCapabilities.fromURL("https://x.test/")).rejects.toMatchObject({name: "AbortError"});
    });

    it('Rejects with an Error when the landing page answers 404, or has no data link', async () => {
        standard({"https://x.test/": () => new Response("", {status: 404})});
        await expect(OgcOpenApiGetCapabilities.fromURL("https://x.test/")).rejects.toThrow("Invalid response: 404 for https://x.test/");
        vi.restoreAllMocks();
        standard({"https://x.test/": json({links: []})});
        await expect(OgcOpenApiGetCapabilities.fromURL("https://x.test/")).rejects.toThrow("no links with rel=data");
    });

    it('Resolves without a version when the API document cannot be read, it is optional', async () => {
        standard({"https://x.test/api": () => new Response("", {status: 500})});
        const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://x.test/");
        expect(capabilities.version).toBe("");
        expect(capabilities.collections.length).toBe(1);
    });

    it('Resolves without conformance classes when they cannot be read', async () => {
        standard({"https://x.test/conformance": () => new Response("<html></html>", {status: 200})});
        expect((await OgcOpenApiGetCapabilities.fromURL("https://x.test/")).conformsTo).toEqual([]);
    });

    it('Resolves when a service-desc link has no type', async () => {
        standard({"https://x.test/": json({links: [LANDING.links[0], {rel: "service-desc", href: "https://x.test/api"}]})});
        expect((await OgcOpenApiGetCapabilities.fromURL("https://x.test/")).collections.length).toBe(1);
    });
});

describe('OgcOpenApiGetCapabilities.fromURL asks for JSON', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Sends Accept application/json, and the media type of the API document for it', async () => {
        const accepts = standard();
        await OgcOpenApiGetCapabilities.fromURL("https://x.test/");
        expect(accepts).toEqual({
            "https://x.test/": "application/json",
            "https://x.test/collections": "application/json",
            "https://x.test/api": "application/vnd.oai.openapi+json;version=3.0",
            "https://x.test/conformance": "application/json",
        });
    });

    it('requestHeaders can replace the Accept header', async () => {
        const accepts = standard();
        await OgcOpenApiGetCapabilities.fromURL("https://x.test/", {requestHeaders: {Accept: "application/geo+json"}});
        expect(accepts["https://x.test/"]).toBe("application/geo+json");
    });
});

describe('OgcOpenApiGetCapabilities.fromURL keywords', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const keywordsOf = async (keywords: any) => {
        standard({"https://x.test/collections": json({collections: [{id: "c", title: "C", links: [], ...(typeof keywords === "undefined" ? {} : {keywords})}]})});
        return (await OgcOpenApiGetCapabilities.fromURL("https://x.test/")).collections[0].keywords;
    };

    it('Keeps keywords that are strings, as OGC API Common Part 2 defines them (pygeoapi)', async () => {
        expect(await keywordsOf(["observations", "monitoring"])).toEqual(["observations", "monitoring"]);
    });

    it('Reads a keyword object of OWS Common as its keyword, the shape PDOK sends', async () => {
        expect(await keywordsOf([{keyword: "bak"}, {keyword: "afvalbak", codeSpace: "x"}])).toEqual(["bak", "afvalbak"]);
    });

    it('Reads each keyword on its own: both shapes in one array', async () => {
        expect(await keywordsOf(["roads", {keyword: "wegdeel"}])).toEqual(["roads", "wegdeel"]);
    });

    it('Leaves out what is not a non-empty string or a keyword object, without changing the others', async () => {
        expect(await keywordsOf([" roads ", "", null, 7, {}, {keyword: 3}, {code: "x"}, ["nested"], {keyword: "bak"}])).toEqual([" roads ", "bak"]);
    });

    it('No keywords when the value is not an array, or there is none', async () => {
        expect(await keywordsOf("roads, rivers")).toEqual([]);
        expect(await keywordsOf({keyword: "bak"})).toEqual([]);
        expect(await keywordsOf(null)).toEqual([]);
        expect(await keywordsOf(undefined)).toEqual([]);
    });
});

import {afterEach, describe, expect, it, vi} from 'vitest';
import {OgcOpenApiFeatureStore, type OgcOpenApiFeatureWriteOperation} from "./OgcOpenApiFeatureStore";
import {OgcOpenApiError} from "./OgcOpenApiError";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import {Feature} from "@luciad/ria/model/feature/Feature";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createPoint, createPolyline} from "@luciad/ria/shape/ShapeFactory";

// Offline tests of the writes (OGC API Features Part 4): fetch is mocked
const ITEMS = "https://example.com/collections/c/items";
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";
const ALL: OgcOpenApiFeatureWriteOperation[] = ["add", "put", "remove"];

function createStore(writeOperations: OgcOpenApiFeatureWriteOperation[] = ALL, options: { dataUrl?: string, requestHeaders?: any } = {}) {
    return new OgcOpenApiFeatureStore({
        dataUrl: options.dataUrl ? options.dataUrl : ITEMS + "?f=json",
        outputFormat: "application/geo+json",
        codec: new GeoJsonCodec({generateIDs: false}),
        crs: CRS84,
        requestHeaders: options.requestHeaders,
        writeOperations,
    });
}

type Answer = { status: number, body?: string, headers?: { [key: string]: string } };

// Answers each request in turn, and keeps what was sent
function answer(...answers: Answer[]) {
    const calls: { url: string, init: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
        calls.push({url: String(input), init});
        const a = answers[Math.min(calls.length - 1, answers.length - 1)];
        return Promise.resolve(new Response(a.status === 204 ? null : (a.body ? a.body : ""), {status: a.status, headers: a.headers}));
    });
    return calls;
}

const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name);
const sent = (init: RequestInit) => JSON.parse(String(init.body));
const point = () => new Feature(createPoint(getReference("CRS:84"), [5, 52]), {name: "a", pop: 3});

function events(store: OgcOpenApiFeatureStore) {
    const list: { type: string, feature: Feature | undefined, id: any }[] = [];
    store.on("StoreChanged", (type, feature, id) => list.push({type, feature, id}));
    return list;
}

describe('OgcOpenApiFeatureStore write operations', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Is read-only by default: reports get and spatialQuery only', () => {
        const store = createStore([]);
        expect(["get", "spatialQuery", "add", "put", "remove"].map(op => store.isOperationSupported(op as any)))
            .toEqual([true, true, false, false, false]);
    });

    it('Reports the write operations it was given, and ignores unknown ones', () => {
        const store = createStore(["add", "remove", "patch" as any]);
        expect(["add", "put", "remove"].map(op => store.isOperationSupported(op as any))).toEqual([true, false, true]);
    });

    it('Rejects an operation it was not given, without a request', async () => {
        const calls = answer({status: 201});
        await expect(createStore(["put"]).add(point())).rejects.toThrow("add is not in its writeOperations");
        await expect(createStore(["add"]).remove(1)).rejects.toBeInstanceOf(OgcOpenApiError);
        expect(calls).toEqual([]);
    });
});

describe('OgcOpenApiFeatureStore add', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs the feature in GeoJSON, without id, to the items without the parameters of the link', async () => {
        const calls = answer({status: 201, headers: {Location: ITEMS + "/17"}});
        await createStore(ALL, {dataUrl: ITEMS + "?f=json&apikey=k1"}).add(point());
        expect(calls[0].url).toBe(ITEMS);
        expect(calls[0].init.method).toBe("POST");
        expect(header(calls[0].init, "Content-Type")).toBe("application/geo+json");
        expect(header(calls[0].init, "Accept")).toContain("application/problem+json");
        expect(sent(calls[0].init)).toEqual({type: "Feature", geometry: {type: "Point", coordinates: [5, 52]}, properties: {name: "a", pop: 3}});
    });

    it('Gives the feature the id of the Location, emits add and resolves it', async () => {
        answer({status: 201, headers: {Location: ITEMS + "/17"}});
        const store = createStore();
        const changes = events(store);
        const feature = point();
        expect(await store.add(feature)).toBe(17);
        expect(feature.id).toBe(17);
        expect(changes).toEqual([{type: "add", feature, id: 17}]);
    });

    it('Reads a string id from the Location, decoded, with a query or a trailing slash', async () => {
        const cases: [string, any][] = [
            [ITEMS + "/a%2Fb?f=json", "a/b"], [ITEMS + "/x7/", "x7"], ["/collections/c/items/007", "007"], [ITEMS + "/-3", -3],
        ];
        for (const [location, id] of cases) {
            answer({status: 201, headers: {Location: location}});
            expect(await createStore().add(point())).toBe(id);
            vi.restoreAllMocks();
        }
    });

    it('Rejects a 201 without Location: LuciadRIA needs the id', async () => {
        answer({status: 201});
        const store = createStore();
        const changes = events(store);
        await expect(store.add(point())).rejects.toMatchObject({status: 201, message: expect.stringContaining("No Location")});
        expect(changes).toEqual([]);
    });

    it('Rejects with the status and the body of a refusal, without event', async () => {
        const refusals: Answer[] = [
            {status: 401, body: "<html>Unauthorized</html>", headers: {"Content-Type": "text/html", "WWW-Authenticate": "Basic realm=\"x\""}},
            {status: 403, body: '{"type":"about:blank","title":"Forbidden","status":403}', headers: {"Content-Type": "application/problem+json"}},
            {status: 400, body: '{"code":"InvalidParameterValue","description":"Collection is not editable"}', headers: {"Content-Type": "application/json"}},
            {status: 500, body: "Request method 'POST' is not supported"},
        ];
        for (const refusal of refusals) {
            answer(refusal);
            const store = createStore();
            const changes = events(store);
            const error = await store.add(point()).catch(e => e);
            expect(error).toBeInstanceOf(OgcOpenApiError);
            expect(error.status).toBe(refusal.status);
            expect(error.url).toBe(ITEMS);
            expect(error.message).toBe("Invalid response: " + refusal.status + " for POST " + ITEMS);
            if (refusal.status === 403) expect(error.problem).toMatchObject({title: "Forbidden"});
            else expect(error.body).toBe(refusal.body);
            expect(changes).toEqual([]);
            vi.restoreAllMocks();
        }
    });

    it('Writes CRS84: transforms a shape of another reference, without Content-Crs', async () => {
        const calls = answer({status: 201, headers: {Location: ITEMS + "/1"}});
        const web = getReference("EPSG:3857");
        const feature = new Feature(createPolyline(web, [createPoint(web, [556597.45, 6446275.84]), createPoint(web, [0, 0])]), {});
        await createStore().add(feature);
        const geometry = sent(calls[0].init).geometry;
        expect(geometry.type).toBe("LineString");
        expect(geometry.coordinates[0][0]).toBeCloseTo(5, 5);
        expect(geometry.coordinates[0][1]).toBeCloseTo(50, 3);
        expect(geometry.coordinates[1][0]).toBeCloseTo(0, 6);
        expect(header(calls[0].init, "Content-Crs")).toBeNull();
    });

    it('Writes a feature without shape with a null geometry', async () => {
        const calls = answer({status: 201, headers: {Location: ITEMS + "/1"}});
        await createStore().add(new Feature(null, {name: "b"}));
        expect(sent(calls[0].init)).toEqual({type: "Feature", geometry: null, properties: {name: "b"}});
    });

    it('Sends the headers of the app to the server, and its credentials mode', async () => {
        const calls = answer({status: 201, headers: {Location: ITEMS + "/1"}});
        await createStore(ALL, {requestHeaders: {Authorization: "Bearer t"}}).add(point());
        expect(header(calls[0].init, "Authorization")).toBe("Bearer t");
        expect(calls[0].init.credentials).toBe("same-origin");
    });
});

describe('OgcOpenApiFeatureStore put', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('PUTs the feature to its item, with the id in the body too, and emits update', async () => {
        const calls = answer({status: 204});
        const store = createStore();
        const changes = events(store);
        const feature = new Feature(createPoint(getReference("CRS:84"), [6, 51]), {name: "c"}, "a b");
        expect(await store.put(feature)).toBe("a b");
        expect(calls[0].url).toBe(ITEMS + "/a%20b");
        expect(calls[0].init.method).toBe("PUT");
        expect(header(calls[0].init, "Content-Type")).toBe("application/geo+json");
        expect(sent(calls[0].init)).toEqual({type: "Feature", id: "a b", geometry: {type: "Point", coordinates: [6, 51]}, properties: {name: "c"}});
        expect(changes).toEqual([{type: "update", feature, id: "a b"}]);
    });

    it('Accepts 200, and emits add for 201 (the server created it)', async () => {
        answer({status: 200, body: "{}"}, {status: 201});
        const store = createStore();
        const changes = events(store);
        const feature = new Feature(null, {}, 4);
        await store.put(feature);
        await store.put(feature);
        expect(changes.map(c => c.type)).toEqual(["update", "add"]);
    });

    it('Rejects a feature without id, without a request', async () => {
        const calls = answer({status: 204});
        await expect(createStore().put(new Feature(null, {}))).rejects.toThrow("without an id");
        expect(calls).toEqual([]);
    });

    it('Rejects with the status of a refusal (405 of a server that does not replace)', async () => {
        answer({status: 405, body: "Method Not Allowed", headers: {Allow: "GET, HEAD"}});
        await expect(createStore().put(new Feature(null, {}, 4))).rejects.toMatchObject({status: 405, body: "Method Not Allowed"});
    });
});

describe('OgcOpenApiFeatureStore remove', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('DELETEs the item, resolves true and emits remove for 204 and 200', async () => {
        const calls = answer({status: 204}, {status: 200, body: "{}"});
        const store = createStore();
        const changes = events(store);
        expect(await store.remove(9)).toBe(true);
        expect(await store.remove("x")).toBe(true);
        expect(calls.map(c => [c.init.method, c.url])).toEqual([["DELETE", ITEMS + "/9"], ["DELETE", ITEMS + "/x"]]);
        expect(calls[0].init.body).toBeUndefined();
        expect(changes).toEqual([{type: "remove", feature: undefined, id: 9}, {type: "remove", feature: undefined, id: "x"}]);
    });

    it('Resolves false for 404, without event', async () => {
        answer({status: 404});
        const store = createStore();
        const changes = events(store);
        expect(await store.remove(9)).toBe(false);
        expect(changes).toEqual([]);
    });

    it('Rejects with the status of a refusal', async () => {
        answer({status: 403, body: "No ACL permissions to delete features"});
        await expect(createStore().remove(9)).rejects.toMatchObject({status: 403, body: "No ACL permissions to delete features"});
    });
});

describe('OgcOpenApiFeatureStore patch', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const FEATURE = {type: "Feature", id: 5, geometry: {type: "Point", coordinates: [7, 50]}, properties: {name: "d", pop: null}};

    it('PATCHes a JSON Merge Patch, reads the feature again and emits update with it', async () => {
        const calls = answer({status: 204}, {status: 200, body: JSON.stringify(FEATURE), headers: {"Content-Type": "application/geo+json"}});
        const store = createStore();
        const changes = events(store);
        expect(await store.patch(5, {properties: {pop: null, name: "d"}, geometry: createPoint(getReference("CRS:84"), [7, 50])})).toBe(5);
        expect(calls[0].init.method).toBe("PATCH");
        expect(header(calls[0].init, "Content-Type")).toBe("application/merge-patch+json");
        expect(sent(calls[0].init)).toEqual({properties: {pop: null, name: "d"}, geometry: {type: "Point", coordinates: [7, 50]}});
        expect(calls[1].init.method).toBe("GET");
        expect(calls[1].init.cache).toBe("no-cache");
        expect(changes.map(c => [c.type, c.id, c.feature.properties.name])).toEqual([["update", 5, "d"]]);
    });

    it('Sends only what it is given: geometry null removes it', async () => {
        const calls = answer({status: 204}, {status: 200, body: JSON.stringify(FEATURE), headers: {"Content-Type": "application/geo+json"}});
        await createStore().patch(5, {geometry: null});
        expect(sent(calls[0].init)).toEqual({geometry: null});
    });

    it('Needs put among the write operations', async () => {
        await expect(createStore(["add"]).patch(5, {properties: {}})).rejects.toThrow("put is not in its writeOperations");
    });

    it('Rejects with the status of a server that does not update (405)', async () => {
        answer({status: 405});
        await expect(createStore().patch(5, {properties: {a: 1}})).rejects.toMatchObject({status: 405});
    });
});

describe('OgcOpenApiFeatureStore get of a writing store', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Asks the server again (no-cache): a cached feature can be older than a write', async () => {
        const calls = answer({status: 404});
        await createStore().get(1);
        await createStore([]).get(1);
        expect(calls.map(c => c.init.cache)).toEqual(["no-cache", undefined]);
    });
});

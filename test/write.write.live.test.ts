import {describe, expect, it} from "vitest";
import {writeFileSync} from "node:fs";
import {join} from "node:path";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import {Feature} from "@luciad/ria/model/feature/Feature";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createPoint} from "@luciad/ria/shape/ShapeFactory";
import {
    CollectionLinkType,
    type OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities
} from "../src/OgcOpenApiGetCapabilities";
import {OgcOpenApiFeatureStore, type OgcOpenApiFeatureWriteOperation} from "../src/OgcOpenApiFeatureStore";
import {ldproxyToken, RECORDED_WRITE_SERVERS, USERS, WRITE_SERVERS} from "./servers/write/servers";
import {startRecording} from "./recorder";
import {runWriteScenario} from "./writeScenario";

// npm run test:live-write, after test/servers/write/up.sh: writes to the local write test servers. Each test removes
// the features it creates
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";

async function connect(url: string, collectionId: string) {
    const capabilities = await OgcOpenApiGetCapabilities.fromURL(url, {filterCollectionsByLinkType: CollectionLinkType.Items});
    const collection = capabilities.collections.find(c => c.id === collectionId);
    if (!collection) throw new Error("Collection " + collectionId + " not found on " + url);
    return {capabilities, collection};
}

async function storeFor(url: string, collectionId: string, writeOperations: OgcOpenApiFeatureWriteOperation[], authorization?: string) {
    const {collection} = await connect(url, collectionId);
    const items = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Items)
        .filter(l => !OgcOpenApiGetCapabilities.isJsonFgLink(l));
    const link = items.find(l => l.type === "application/geo+json") || items.find(l => l.type === "application/json") || items[0];
    return new OgcOpenApiFeatureStore({
        dataUrl: link.href, outputFormat: "application/geo+json", codec: new GeoJsonCodec({generateIDs: false}), crs: CRS84,
        requestHeaders: authorization ? {Authorization: authorization} : undefined, writeOperations,
    });
}

const at = (x: number, y: number) => createPoint(getReference("CRS:84"), [x, y]);
const coordinates = (feature: Feature) => [(feature.shape as any).x, (feature.shape as any).y];

async function writeSupport(capabilities: OgcOpenApiCapabilitiesObject, collectionId: string, options: any = {}) {
    const collection = capabilities.collections.find(c => c.id === collectionId);
    return OgcOpenApiGetCapabilities.fetchWriteSupport(capabilities, collection, options);
}

describe("ldproxy 4.8.2 (bearer tokens)", () => {
    const {url, collection, otherCollection} = WRITE_SERVERS.ldproxy;
    const writer = "Bearer " + ldproxyToken("alice", ["write"]);

    it("Advertises create-replace-delete and update, and every write method", async () => {
        const {capabilities} = await connect(url, collection);
        const support = await writeSupport(capabilities, collection, {featureId: 1, requestHeaders: {Authorization: writer}});
        expect(support.conformance).toEqual({createReplaceDelete: true, update: true});
        expect(support.suggested).toEqual(["add", "put", "remove"]);
        expect(support.patch).toBe(true);
        expect(support.issues).toEqual([]);
    });

    it("Creates, reads, replaces, patches and deletes a feature", async () => {
        const store = await storeFor(url, collection, ["add", "put", "remove"], writer);
        const feature = new Feature(at(4.70, 50.88), {name: "live-write", category: "cafe", rating: 3});
        const id = await store.add(feature);
        try {
            expect(feature.id).toBe(id);
            let read = await store.get(id);
            expect(read.id).toBe(id);
            expect(read.properties).toMatchObject({name: "live-write", category: "cafe", rating: 3});
            expect(coordinates(read)).toEqual([4.70, 50.88]);

            // A replace: the properties left out are removed
            await store.put(new Feature(at(4.71, 50.89), {name: "live-write-2", rating: 4}, id));
            read = await store.get(id);
            expect(read.properties).toMatchObject({name: "live-write-2", rating: 4});
            expect(read.properties.category === null || read.properties.category === undefined).toBe(true);
            expect(coordinates(read)).toEqual([4.71, 50.89]);

            await store.patch(id, {properties: {rating: 5, category: "bar"}});
            read = await store.get(id);
            expect(read.properties).toMatchObject({name: "live-write-2", rating: 5, category: "bar"});
        } finally {
            expect(await store.remove(id)).toBe(true);
        }
        expect(await store.get(id)).toBeUndefined();
        expect(await store.remove(id)).toBe(false);
    });

    it("Rejects with 401 without a token, with a read token, and for another collection than the token's", async () => {
        const feature = () => new Feature(at(4.7, 50.8), {name: "live-write-denied"});
        for (const authorization of [undefined, "Bearer " + ldproxyToken("carol", ["read"])]) {
            const store = await storeFor(url, collection, ["add"], authorization);
            await expect(store.add(feature())).rejects.toMatchObject({status: 401});
        }
        const poiOnly = await storeFor(url, otherCollection, ["add"], "Bearer " + ldproxyToken("bob", ["data:write::spike:poi"]));
        await expect(poiOnly.add(feature())).rejects.toMatchObject({status: 401});
    });

    it("Works through FeatureModel, and makes FeatureLayer editable", async () => {
        const store = await storeFor(url, collection, ["add", "put", "remove"], writer);
        expect(new FeatureLayer(new FeatureModel(store)).editable).toBe(true);
        const model = new FeatureModel(store);
        const changes: string[] = [];
        model.on("ModelChanged", (type, feature, id) => changes.push(type + " " + id));
        const id = await model.add(new Feature(at(4.72, 50.87), {name: "live-write-model"}));
        await model.put(new Feature(at(4.73, 50.87), {name: "live-write-model-2"}, id));
        await model.remove(id);
        expect(changes).toEqual(["add " + id, "update " + id, "remove " + id]);
    });
});

describe("pygeoapi 0.24.0 (Basic through the proxy)", () => {
    const {url, collection, readOnlyCollection} = WRITE_SERVERS.pygeoapi;

    it("Advertises create-replace-delete per collection through Allow, and no update", async () => {
        const {capabilities} = await connect(url, collection);
        const editable = await writeSupport(capabilities, collection, {featureId: 1});
        expect(editable.conformance).toEqual({createReplaceDelete: true, update: false});
        expect(editable.suggested).toEqual(["add", "put", "remove"]);
        expect(editable.patch).toBe(false);
        expect(editable.issues).toEqual([]);
        const readOnly = await writeSupport(capabilities, readOnlyCollection, {featureId: 1});
        expect(readOnly.suggested).toEqual([]);
        expect(readOnly.issues).toEqual(["The server declares create-replace-delete, but OPTIONS allows no write method"]);
    });

    it("Creates, reads, replaces and deletes a feature", async () => {
        const store = await storeFor(url, collection, ["add", "put", "remove"], USERS.editor);
        const id = await store.add(new Feature(at(4.70, 50.88), {name: "live-write", kind: "cafe", pop: 3}));
        try {
            let read = await store.get(id);
            expect(read.id).toBe(id);
            expect(read.properties).toMatchObject({name: "live-write", kind: "cafe", pop: 3});
            await store.put(new Feature(at(4.71, 50.89), {name: "live-write-2", kind: "bar", pop: 4}, id));
            read = await store.get(id);
            expect(read.properties).toMatchObject({name: "live-write-2", kind: "bar", pop: 4});
            expect(coordinates(read)).toEqual([4.71, 50.89]);
        } finally {
            expect(await store.remove(id)).toBe(true);
        }
        expect(await store.get(id)).toBeUndefined();
    });

    it("Rejects PATCH with 405: pygeoapi does not update", async () => {
        const store = await storeFor(url, collection, ["put"], USERS.editor);
        await expect(store.patch(1, {properties: {pop: 7}})).rejects.toMatchObject({status: 405});
    });

    it("Rejects with the status of each refusal: 401 anonymous, 403 viewer, 400 a read-only collection", async () => {
        const feature = () => new Feature(at(4.7, 50.8), {name: "live-write-denied"});
        await expect((await storeFor(url, collection, ["add"])).add(feature())).rejects.toMatchObject({status: 401});
        await expect((await storeFor(url, collection, ["add"], USERS.viewer)).add(feature())).rejects.toMatchObject({status: 403});
        await expect((await storeFor(url, readOnlyCollection, ["add"], USERS.editor)).add(feature())).rejects.toMatchObject({status: 400});
    });
});

describe("QGIS Server 4.2.3 (discovery only)", () => {
    const {url, collection, readOnlyCollection} = WRITE_SERVERS.qgis;

    it("Allows the write methods per user, without declaring create-replace-delete", async () => {
        const {capabilities} = await connect(url, collection);
        const editor = await writeSupport(capabilities, collection, {requestHeaders: {Authorization: USERS.editor}});
        expect(editor.conformance).toEqual({createReplaceDelete: false, update: false});
        expect(editor.allow.items).toEqual(["GET", "OPTIONS", "POST", "DELETE", "PUT", "PATCH"]);
        expect(editor.suggested).toEqual([]);
        expect(editor.issues).toEqual(["OPTIONS allows POST, PUT, DELETE, but the server does not declare create-replace-delete"]);
        for (const authorization of [USERS.viewer, undefined]) {
            const other = await writeSupport(capabilities, collection, {requestHeaders: authorization ? {Authorization: authorization} : undefined});
            expect(other.allow.items).toEqual(["GET", "OPTIONS"]);
            expect(other.issues).toEqual([]);
        }
        const readOnly = await writeSupport(capabilities, readOnlyCollection, {requestHeaders: {Authorization: USERS.editor}});
        expect(readOnly.allow.items).toEqual(["GET", "OPTIONS"]);
    });

    it("Has no schema: QGIS answers its landing page", async () => {
        const {capabilities, collection: cities} = await connect(url, collection);
        expect(await OgcOpenApiGetCapabilities.fetchSchema(capabilities, cities)).toBeNull();
    });
});

describe("GeoServer 3.0.2 (read-only OGC API)", () => {
    const {url, collection} = WRITE_SERVERS.geoserver;

    it("Declares no create-replace-delete, while OPTIONS allows every method", async () => {
        const {capabilities} = await connect(url, collection);
        const support = await writeSupport(capabilities, collection);
        expect(support.conformance).toEqual({createReplaceDelete: false, update: false});
        expect(support.suggested).toEqual([]);
        expect(support.issues).toEqual(["OPTIONS allows POST, PUT, DELETE, but the server does not declare create-replace-delete"]);
    });

    it("Rejects a write with the status GeoServer answers, 500", async () => {
        const store = await storeFor(url, collection, ["add"], USERS.editor);
        await expect(store.add(new Feature(at(4.7, 50.8), {name: "live-write-denied"}))).rejects.toMatchObject({status: 500});
    });
});

describe("Schemas", () => {
    it("ldproxy and pygeoapi describe their properties and geometry", async () => {
        const ldproxy = await connect(WRITE_SERVERS.ldproxy.url, WRITE_SERVERS.ldproxy.collection);
        const poi = await OgcOpenApiGetCapabilities.fetchSchema(ldproxy.capabilities, ldproxy.collection);
        expect(poi.properties.geom).toMatchObject({format: "geometry-point", "x-ogc-role": "primary-geometry"});
        expect(poi.properties.id).toMatchObject({readOnly: true});
        const pygeoapi = await connect(WRITE_SERVERS.pygeoapi.url, WRITE_SERVERS.pygeoapi.collection);
        const places = await OgcOpenApiGetCapabilities.fetchSchema(pygeoapi.capabilities, pygeoapi.collection);
        expect(places.properties.name).toMatchObject({type: "string"});
    });
});

// With RECORD=1 (npm run test:record-write): records the write scenario of the servers that write, for
// test/write.test.ts. Not compared live: the ids and timestamps of the server change on every run, the tests above
// check its behaviour
describe("Write scenario, recorded", () => {
    const FIXTURES = join(__dirname, "fixtures", "write");
    for (const server of RECORDED_WRITE_SERVERS) {
        it.skipIf(process.env.RECORD !== "1")(server.id, async () => {
            const dir = join(FIXTURES, server.id);
            const recording = startRecording(dir);
            try {
                writeFileSync(join(dir, "expected.json"), JSON.stringify(await runWriteScenario(server), null, 2) + "\n");
            } finally {
                recording.stop();
            }
        });
    }
});

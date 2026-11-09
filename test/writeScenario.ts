import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import {Feature} from "@luciad/ria/model/feature/Feature";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createPoint} from "@luciad/ria/shape/ShapeFactory";
import {CollectionLinkType, OgcOpenApiGetCapabilities} from "../src/OgcOpenApiGetCapabilities";
import {OgcOpenApiFeatureStore} from "../src/OgcOpenApiFeatureStore";

/**
 * One write scenario on a write test server (test/servers/write): what it advertises, then a feature created, read,
 * replaced, patched when the server updates, deleted, and a refused write. test/write.write.live.test.ts runs it on
 * the servers and records it, test/write.test.ts replays the recording offline.
 */
export interface WriteScenarioServer {
    id: string;
    url: string;
    collection: string;
    // The Authorization of a user who writes, and of one who may not
    writer: string;
    refused?: string;
    // A property the scenario sets, and the properties of the feature it creates and replaces
    properties: { [name: string]: unknown };
    replaced: { [name: string]: unknown };
    patch?: { [name: string]: unknown };
}

const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";

const at = (x: number, y: number) => createPoint(getReference("CRS:84"), [x, y]);

const read = (feature: Feature | undefined) =>
    feature ? {id: feature.id, coordinates: [(feature.shape as any).x, (feature.shape as any).y], properties: feature.properties} : null;

async function outcome<T>(promise: Promise<T>) {
    try {
        return {resolved: await promise};
    } catch (e) {
        return {rejected: {status: e.status, message: e.message}};
    }
}

export async function runWriteScenario(server: WriteScenarioServer) {
    const capabilities = await OgcOpenApiGetCapabilities.fromURL(server.url, {filterCollectionsByLinkType: CollectionLinkType.Items});
    const collection = capabilities.collections.find(c => c.id === server.collection);
    const support = await OgcOpenApiGetCapabilities.fetchWriteSupport(capabilities, collection, {requestHeaders: {Authorization: server.writer}});
    const items = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Items)
        .filter(l => !OgcOpenApiGetCapabilities.isJsonFgLink(l));
    const link = items.find(l => l.type === "application/geo+json") || items.find(l => l.type === "application/json") || items[0];
    const store = (authorization: string) => new OgcOpenApiFeatureStore({
        dataUrl: link.href, outputFormat: "application/geo+json", codec: new GeoJsonCodec({generateIDs: false}), crs: CRS84,
        requestHeaders: {Authorization: authorization}, writeOperations: ["add", "put", "remove"],
    });
    const writer = store(server.writer);
    const events: string[] = [];
    writer.on("StoreChanged", (type, feature, id) => events.push(type + " " + id));

    const id = await writer.add(new Feature(at(4.70, 50.88), server.properties));
    const created = read(await writer.get(id));
    await writer.put(new Feature(at(4.71, 50.89), server.replaced, id));
    const replaced = read(await writer.get(id));
    const patched = server.patch ? await outcome(writer.patch(id, {properties: server.patch}).then(() => writer.get(id)).then(read)) : undefined;
    const removed = await writer.remove(id);
    const afterRemove = read(await writer.get(id));
    const removedAgain = await writer.remove(id);
    const refused = server.refused ? await outcome(store(server.refused).add(new Feature(at(4.7, 50.8), server.properties))) : undefined;
    return {support, created, replaced, patched, removed, afterRemove, removedAgain, refused, events};
}

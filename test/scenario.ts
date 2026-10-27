import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createBounds, createPoint} from "@luciad/ria/shape/ShapeFactory";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec";
import {Cursor} from "@luciad/ria/model/Cursor";
import {
    CollectionLinkType,
    OgcOpenApiCapabilitiesCollection,
    OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities,
    TileMatrixLimits,
    TileSetData
} from "../src/OgcOpenApiGetCapabilities";
import {OgcOpenApiFeatureStore} from "../src/OgcOpenApiFeatureStore";
import {OgcOpenApiMapsModel} from "../src/OgcOpenApiMapsModel";
import {OgcOpenApiTilesModel} from "../src/OgcOpenApiTilesModel";
import {OgcOpenApiVectorTilesModel} from "../src/OgcOpenApiVectorTilesModel";
import {OgcOpenApiStyleTools} from "../src/OgcOpenApiStyleTools";
import {OgcOpenApiTileMatrixTools} from "../src/OgcOpenApiTileMatrixTools";
import {OgcOpenApiMvtTools} from "../src/OgcOpenApiMvtTools";
import {TestServer} from "./servers";
import {registerReferences} from "../demo/src/references";

// The references of the tile matrix sets of the test servers that LuciadRIA does not know by default
registerReferences();

/**
 * Runs the library against a server the way an application does, for each kind of data in the registry, and
 * summarizes the outcome with values that do not change between runs. The summary is compared with the recorded one.
 */
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";
const PREFERRED_LEVEL = 12;

async function connect(server: TestServer, linkType: CollectionLinkType, collectionId: string) {
    const capabilities = await OgcOpenApiGetCapabilities.fromURL(server.url, {filterCollectionsByLinkType: linkType});
    const collection = capabilities.collections.find(c => c.id === collectionId);
    if (!collection) throw new Error("Collection " + collectionId + " not found on " + server.url);
    return {capabilities, collection};
}

function getExtent(collection: OgcOpenApiCapabilitiesCollection): number[] {
    const bbox = collection.extent?.spatial?.bbox?.[0];
    return bbox && bbox.length >= 4 ? bbox : [-180, -90, 180, 90];
}

function countFeatures(cursor: Cursor) {
    let count = 0;
    while (cursor.hasNext()) {
        cursor.next();
        count++;
    }
    return count;
}

async function features(server: TestServer) {
    const {capabilities, collection} = await connect(server, CollectionLinkType.Items, server.features.collection);
    const items = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Items);
    const link = items.find(l => l.type === "application/geo+json") || items.find(l => l.type === "application/json") || items[0];
    const store = new OgcOpenApiFeatureStore({
        dataUrl: link.href, outputFormat: "application/geo+json", codec: new GeoJsonCodec({generateIDs: true}),
        crs: CRS84, extent: collection.extent, useCrs84Bounds: true,
    });
    const [minX, minY, maxX, maxY] = getExtent(collection);
    const bounds = createBounds(getReference("CRS:84"), [minX, maxX - minX, minY, maxY - minY]);
    const cursor = await store.spatialQuery(bounds, {limit: 5});
    return {collections: capabilities.collections.length, dataUrl: link.href, features: countFeatures(cursor)};
}

async function maps(server: TestServer) {
    const {capabilities, collection} = await connect(server, CollectionLinkType.Map, server.maps.collection);
    const links = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Map);
    const link = links.find(l => l.type === "image/png") || links[0];
    const model = new OgcOpenApiMapsModel({crs: "http://www.opengis.net/def/crs/EPSG/0/3857", baseURL: link.href, collection: collection.id});
    return {collections: capabilities.collections.length, mapUrl: model.getTileURL(model.getMapRoot, {level: 1, x: 1, y: 1})};
}

// The tile at the center of the extent, at the level nearest to PREFERRED_LEVEL that the limits allow
function getCenterTile(tileMatrix: TileSetData, extent: number[], limits?: TileMatrixLimits[]): TileCoordinate {
    const grid = OgcOpenApiTileMatrixTools.createTileGrid(tileMatrix);
    const levels = limits ? limits.map(l => grid.tileMatrices.findIndex(m => m.id === l.tileMatrix)).filter(level => level > -1) : [];
    const candidates = levels.length > 0 ? levels : [Math.min(PREFERRED_LEVEL, grid.levelCount - 1)];
    const level = candidates.reduce((best, l) => Math.abs(l - PREFERRED_LEVEL) < Math.abs(best - PREFERRED_LEVEL) ? l : best);
    const [minX, minY, maxX, maxY] = extent;
    const toGrid = createTransformation(getReference("CRS:84"), grid.reference);
    const center = toGrid.transform(createPoint(getReference("CRS:84"), [(minX + maxX) / 2, (minY + maxY) / 2]));
    const columns = grid.level0Columns * Math.pow(2, level);
    const rows = grid.level0Rows * Math.pow(2, level);
    const x = Math.floor((center.x - grid.bounds.x) / (grid.bounds.width / columns));
    const y = Math.floor((center.y - grid.bounds.y) / (grid.bounds.height / rows));
    return {level, x: Math.min(Math.max(x, 0), columns - 1), y: Math.min(Math.max(y, 0), rows - 1)};
}

async function getTileMatrixSet(capabilities: OgcOpenApiCapabilitiesObject, id: string) {
    const tileMatrix = (await OgcOpenApiGetCapabilities.fetchTileSetsInFull(capabilities)).find(t => t.id === id);
    if (!tileMatrix) throw new Error("Tile matrix set " + id + " not found");
    return tileMatrix;
}

async function mapTiles(server: TestServer) {
    const {capabilities, collection} = await connect(server, CollectionLinkType.Tiles, server.mapTiles.collection);
    const tileMatrix = await getTileMatrixSet(capabilities, server.mapTiles.tileMatrixSet);
    const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileMatrix.id, {}, CollectionLinkType.Tiles);
    const link = tileSet.links.find(l => l.type === "image/png") || tileSet.links[0];
    const model = await OgcOpenApiTilesModel.createFromTileSet({
        tileMatrix, baseURL: link.href, collection: collection.id,
        tileMatrixSetLimits: tileSet.tileMatrixSetLimits, extent: getExtent(collection),
    });
    const tile = getCenterTile(tileMatrix, getExtent(collection), tileSet.tileMatrixSetLimits);
    return {collections: capabilities.collections.length, template: link.href, tile, tileUrl: model.getTileURL(model.baseURL, tile)};
}

async function vectorTiles(server: TestServer) {
    const {capabilities, collection} = await connect(server, CollectionLinkType.VectorTiles, server.vectorTiles.collection);
    const tileMatrix = await getTileMatrixSet(capabilities, server.vectorTiles.tileMatrixSet);
    const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileMatrix.id, {}, CollectionLinkType.VectorTiles);
    const link = tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile") || tileSet.links[0];
    const model = new OgcOpenApiVectorTilesModel({
        tileMatrix, baseURL: link.href, collection: collection.id, tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
    });
    const tile = getCenterTile(tileMatrix, getExtent(collection), tileSet.tileMatrixSetLimits);
    const content = await model.getVectorTile(tile);
    return {
        collections: capabilities.collections.length,
        template: link.href,
        layers: tileSet.layers.map(l => ({id: l.id, geometryDimension: l.geometryDimension})),
        limits: tileSet.tileMatrixSetLimits ? tileSet.tileMatrixSetLimits.length : 0,
        maxLevel: model.maxLevel,
        tile,
        tileBytes: content ? content.byteLength : 0,
        styles: server.vectorTiles.style ? await styles(capabilities, collection, tileMatrix.id, server.vectorTiles.style) : undefined,
    };
}

// The tilesets of the dataset, all collections in each tile, as the demo finds them
async function datasetVectorTiles(server: TestServer) {
    const capabilities = await OgcOpenApiGetCapabilities.fromURL(server.url, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
    const tileMatrixSets = await OgcOpenApiGetCapabilities.fetchTileSetsInFull(capabilities);
    const tileSets = await OgcOpenApiGetCapabilities.fetchDatasetTileSets(capabilities, CollectionLinkType.VectorTiles);
    const resolved = await Promise.all(tileSets.map(async tileSet =>
        ({tileSet, tileMatrix: await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(capabilities, tileSet, tileMatrixSets)})));
    const selected = resolved.find(t => t.tileMatrix.id === server.datasetVectorTiles.tileMatrixSet);
    if (!selected) throw new Error("No dataset tileset in " + server.datasetVectorTiles.tileMatrixSet);
    const {tileSet: tileSetInfo, tileMatrix} = selected;
    const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, null, tileSetInfo, {}, CollectionLinkType.VectorTiles);
    const link = tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile") || tileSet.links[0];
    const model = new OgcOpenApiVectorTilesModel({
        tileMatrix, baseURL: link.href, collection: "dataset", tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
    });
    const [lon, lat] = server.datasetVectorTiles.center;
    const tile = getCenterTile(tileMatrix, [lon, lat, lon, lat], tileSet.tileMatrixSetLimits);
    const content = await model.getVectorTile(tile);
    const tileMatrixSetIds = resolved.map(t => t.tileMatrix.id);
    return {
        tileMatrixSets: tileMatrixSetIds.sort(),
        template: link.href,
        layers: tileSet.layers.length,
        limits: tileSet.tileMatrixSetLimits ? tileSet.tileMatrixSetLimits.length : 0,
        maxLevel: model.maxLevel,
        tile,
        tileLayers: content ? (await OgcOpenApiMvtTools.getLayers(content)).length : 0,
        styles: server.datasetVectorTiles.style ?
            await styles(capabilities, null, tileMatrix.id, server.datasetVectorTiles.style, tileMatrixSetIds) : undefined,
    };
}

async function styles(capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection | null, tileMatrixSetId: string,
                      styleId: string, tileMatrixSetIds?: string[]) {
    const all = await OgcOpenApiStyleTools.fetchStyles(capabilities, collection);
    const available = tileMatrixSetIds ? OgcOpenApiStyleTools.getStylesForTileMatrixSet(all, tileMatrixSetId, tileMatrixSetIds) : all;
    const style = available.find(s => s.id === styleId);
    if (!style) throw new Error("Style " + styleId + " not found");
    const stylesheet = OgcOpenApiStyleTools.pickStylesheet(style, tileMatrixSetId);
    const json = await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, stylesheet);
    return {ids: available.map(s => s.id).sort(), stylesheet: stylesheet.href, layers: json.layers.length};
}

export async function runScenario(server: TestServer) {
    return {
        features: server.features ? await features(server) : undefined,
        maps: server.maps ? await maps(server) : undefined,
        mapTiles: server.mapTiles ? await mapTiles(server) : undefined,
        vectorTiles: server.vectorTiles ? await vectorTiles(server) : undefined,
        datasetVectorTiles: server.datasetVectorTiles ? await datasetVectorTiles(server) : undefined,
    };
}

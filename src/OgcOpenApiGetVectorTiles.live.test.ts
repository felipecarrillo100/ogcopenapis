import {describe, expect, it, vi} from 'vitest';

import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiVectorTilesModel} from "./OgcOpenApiVectorTilesModel";

// Reference datasets: the OGC Daraa dataset on ldproxy and OpenStreetMap on GNOSIS
const DARAA = "https://demo.ldproxy.net/daraa/";
const GNOSIS = "https://maps.gnosis.earth/ogcapi/";

describe('OgcOpenApiGetCapabilities vector tiles', () => {

    it('fromURL daraa links filtered by VectorTiles', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(DARAA, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        expect(capabilities.collections.length).toBe(33);
        // ldproxy does not type its tilesets links
        expect(capabilities.collections[0].outputFormats).toEqual(["application/vnd.mapbox-vector-tile"]);
    });

    it('fetchCollectionTileSet daraa AgricultureSrf', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(DARAA, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        const collection = capabilities.collections.find(c => c.id === "AgricultureSrf");
        const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, "WebMercatorQuad", {}, CollectionLinkType.VectorTiles);
        expect(tileSet.dataType).toBe("vector");
        expect(tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile").href)
            .toBe("https://demo.ldproxy.net/daraa/collections/AgricultureSrf/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt");
        expect(tileSet.layers.map(l => [l.id, l.geometryDimension])).toEqual([["AgricultureSrf", 2]]);
    });

    it('fetchCollectionTileSet gnosis osm:dc', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(GNOSIS, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        const collection = capabilities.collections.find(c => c.id === "osm:dc");
        const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, "WebMercatorQuad", {}, CollectionLinkType.VectorTiles);
        expect(tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile").href)
            .toBe("https://maps.gnosis.earth/ogcapi/collections/osm:dc/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}.mvt");
        expect(tileSet.layers.map(l => l.id)).toContain("roads");
    });

    it('getTilesLink still defaults to map tiles', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(GNOSIS, {filterCollectionsByLinkType: CollectionLinkType.Tiles});
        const collection = capabilities.collections.find(c => c.id === "osm:dc");
        const links = await OgcOpenApiGetCapabilities.getTilesLink(capabilities, collection, "WebMercatorQuad");
        expect(links.some(l => l.href.indexOf("/map/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}") > -1)).toBe(true);
    });
});

describe('OgcOpenApiVectorTilesModel', () => {

    const createDaraaModel = async (collectionId: string, tileMatrixSetId: string) => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(DARAA, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        const collection = capabilities.collections.find(c => c.id === collectionId);
        const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileMatrixSetId, {}, CollectionLinkType.VectorTiles);
        const tileMatrixSets = await OgcOpenApiGetCapabilities.fetchTileSetsInFull(capabilities);
        return new OgcOpenApiVectorTilesModel({
            tileMatrix: tileMatrixSets.find(t => t.id === tileMatrixSetId),
            baseURL: tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile").href,
            collection: collectionId,
            tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
        });
    };

    it('daraa TransportationGroundCrv levels follow the tileMatrixSetLimits', async () => {
        const model = await createDaraaModel("TransportationGroundCrv", "WebMercatorQuad");
        // LuciadRIA paints nothing when minLevel > 0, the model skips levels without data itself
        expect(model.minLevel).toBe(0);
        expect(model.maxLevel).toBe(18);
        expect(model.reference.identifier).toBe("EPSG:3857");
        expect(model.modelDescriptor.name).toBe("TransportationGroundCrv");
    });

    it('daraa TransportationGroundCrv getVectorTile', async () => {
        const model = await createDaraaModel("TransportationGroundCrv", "WebMercatorQuad");
        // tileMatrix 12, tileRow 1655, tileCol 2458
        const content = await model.getVectorTile({level: 12, x: 2458, y: 4095 - 1655});
        expect(content.byteLength).toBeGreaterThan(10000);
    });

    it('daraa TransportationGroundCrv getVectorTile without data is null', async () => {
        const model = await createDaraaModel("TransportationGroundCrv", "WebMercatorQuad");
        expect(await model.getVectorTile({level: 12, x: 0, y: 4095})).toBeNull();
    });

    it('daraa TransportationGroundCrv getVectorTile below the limits is null without a request', async () => {
        const model = await createDaraaModel("TransportationGroundCrv", "WebMercatorQuad");
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        expect(await model.getVectorTile({level: 3, x: 4, y: 4})).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});

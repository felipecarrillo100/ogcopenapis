import {describe, expect, it} from '@jest/globals';
import "isomorphic-fetch";

import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";

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

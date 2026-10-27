import {afterEach, describe, expect, it, vi} from 'vitest';
import {OgcOpenApiVectorTilesModel} from "./OgcOpenApiVectorTilesModel";
import {OgcOpenApiTilesModel} from "./OgcOpenApiTilesModel";
import {OgcOpenApiWmtsTools} from "./OgcOpenApiWmtsTools";
import {TileSetData} from "./OgcOpenApiGetCapabilities";

// Tile matrix sets as served by test.cubewerx.com, maps.gnosis.earth and demo.ldproxy.net
import EuroJson from "./fixtures/tms-cubewerx-euro_3857.json";
import GlobalCRS84ScaleJson from "./fixtures/tms-GlobalCRS84Scale.json";
import WebMercatorQuadJson from "./fixtures/tms-WebMercatorQuad.json";

const EURO_3857 = EuroJson as unknown as TileSetData;
// Not a quad-tree: 2x1, 3x2, 6x3, 12x6, 23x12, 56x28 tiles
const GLOBAL_CRS84_SCALE = GlobalCRS84ScaleJson as unknown as TileSetData;
const WEB_MERCATOR_QUAD = WebMercatorQuadJson as unknown as TileSetData;

const EURO_TEMPLATE = "https://example.com/collections/erm/map/tiles/euro_3857/{tileMatrix}/{tileRow}/{tileCol}";

function path(url: string, tileMatrixSetId: string) {
    return url.split(tileMatrixSetId + "/")[1];
}

describe('OgcOpenApiTilesModel.createFromTileSet', () => {

    it('A quad-tree tile matrix set, with tile matrix ids that are not numbers', async () => {
        const model = await OgcOpenApiTilesModel.createFromTileSet({tileMatrix: EURO_3857, baseURL: EURO_TEMPLATE, collection: "erm"});
        expect(model.levelCount).toBe(23);
        expect([model.getTileColumnCount(0), model.getTileRowCount(0), model.getTileColumnCount(2), model.getTileRowCount(2)]).toEqual([1, 1, 4, 4]);
        // LuciadRIA counts rows bottom-up, OGC API top-down
        expect(path(model.getTileURL(model.baseURL, {level: 1, x: 1, y: 1}), "euro_3857")).toBe("01/0/1?transparent=true");
        expect(path(model.getTileURL(model.baseURL, {level: 2, x: 3, y: 1}), "euro_3857")).toBe("02/2/3?transparent=true");
    });

    it('A tile matrix set that is not a quad-tree keeps all its levels', async () => {
        const model = await OgcOpenApiTilesModel.createFromTileSet({
            tileMatrix: GLOBAL_CRS84_SCALE, collection: "c",
            baseURL: "https://example.com/tiles/GlobalCRS84Scale/{tileMatrix}/{tileRow}/{tileCol}",
        });
        expect(model.levelCount).toBe(GLOBAL_CRS84_SCALE.tileMatrices.length);
        GLOBAL_CRS84_SCALE.tileMatrices.forEach((m, level) => {
            expect([model.getTileColumnCount(level), model.getTileRowCount(level)]).toEqual([m.matrixWidth, m.matrixHeight]);
        });
        expect(path(model.getTileURL(model.baseURL, {level: 1, x: 2, y: 1}), "GlobalCRS84Scale")).toBe("1/0/2?transparent=true");
        expect(path(model.getTileURL(model.baseURL, {level: 4, x: 22, y: 11}), "GlobalCRS84Scale")).toBe("4/0/22?transparent=true");
    });

    it('Does not request tiles outside the tileMatrixSetLimits', async () => {
        const model = await OgcOpenApiTilesModel.createFromTileSet({
            tileMatrix: EURO_3857, baseURL: EURO_TEMPLATE, collection: "erm",
            tileMatrixSetLimits: [{tileMatrix: "02", minTileRow: 1, maxTileRow: 2, minTileCol: 2, maxTileCol: 3}],
        });
        // Row 2, column 3
        expect(model.getTileURL(model.baseURL, {level: 2, x: 3, y: 1})).not.toBeNull();
        // Column 0
        expect(model.getTileURL(model.baseURL, {level: 2, x: 0, y: 1})).toBeNull();
        // A level without limits has no data
        expect(model.getTileURL(model.baseURL, {level: 1, x: 1, y: 1})).toBeNull();
        expect(model.isSparseTileSet).toBe(true);
    });

    it('Requests an encoded bgcolor and proxifies the URL', async () => {
        const model = await OgcOpenApiTilesModel.createFromTileSet({
            tileMatrix: EURO_3857, baseURL: EURO_TEMPLATE, collection: "erm", transparent: false, bgcolor: "#FFFFFF",
            proxify: (url, fetchOptions) => ({url: "https://proxy.example.com/?url=" + encodeURIComponent(url), fetchOptions}),
        });
        const url = model.getTileURL(model.baseURL, {level: 1, x: 1, y: 1});
        expect(url).toBe("https://proxy.example.com/?url=" + encodeURIComponent(
            "https://example.com/collections/erm/map/tiles/euro_3857/01/0/1?transparent=false&bgcolor=%23FFFFFF"));
    });

    it('Keeps the query of the template', async () => {
        const model = await OgcOpenApiTilesModel.createFromTileSet({tileMatrix: EURO_3857, baseURL: EURO_TEMPLATE + "?f=png&styles=a", collection: "erm"});
        expect(path(model.getTileURL(model.baseURL, {level: 1, x: 1, y: 1}), "euro_3857")).toBe("01/0/1?f=png&styles=a&transparent=true");
    });

    it('A bottomLeft tile matrix set falls back to the quad-tree model, WMTS only has a top left origin', async () => {
        const bottomLeft = {...WEB_MERCATOR_QUAD, tileMatrices: WEB_MERCATOR_QUAD.tileMatrices.map(m => ({...m, cornerOfOrigin: "bottomLeft"}))};
        const model = await OgcOpenApiTilesModel.createFromTileSet({
            tileMatrix: bottomLeft, collection: "c", baseURL: "https://example.com/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}",
        });
        expect(path(model.getTileURL(model.baseURL, {level: 2, x: 1, y: 3}), "WebMercatorQuad")).toBe("2/3/1?transparent=true");
    });

    it('Requests the same tiles as the deprecated constructor for a quad-tree', async () => {
        const options = {tileMatrix: EURO_3857, baseURL: EURO_TEMPLATE, collection: "erm"};
        const created = await OgcOpenApiTilesModel.createFromTileSet(options);
        const constructed = new OgcOpenApiTilesModel(options);
        expect(constructed.levelCount).toBe(created.levelCount);
        for (const tile of [{level: 0, x: 0, y: 0}, {level: 3, x: 5, y: 2}, {level: 12, x: 2460, y: 2440}]) {
            expect(constructed.getTileURL(constructed.baseURL, tile)).toBe(created.getTileURL(created.baseURL, tile));
        }
    });
});

describe('OgcOpenApiWmtsTools', () => {

    it('Converts OGC CRS URIs to the URNs of WMTS', () => {
        expect(OgcOpenApiWmtsTools.toCrsUrn("http://www.opengis.net/def/crs/EPSG/0/3857")).toBe("urn:ogc:def:crs:EPSG::3857");
        expect(OgcOpenApiWmtsTools.toCrsUrn("http://www.opengis.net/def/crs/OGC/1.3/CRS84")).toBe("urn:ogc:def:crs:OGC:1.3:CRS84");
        expect(OgcOpenApiWmtsTools.toCrsUrn("EPSG:4326")).toBe("EPSG:4326");
    });

    it('Escapes the template in the capabilities', () => {
        const xml = OgcOpenApiWmtsTools.toCapabilitiesXml({layer: "a&b", tileMatrix: EURO_3857, template: EURO_TEMPLATE + "?f=png&x=<1>", format: "image/png"});
        expect(xml).toContain('template="https://example.com/collections/erm/map/tiles/euro_3857/{TileMatrix}/{TileRow}/{TileCol}?f=png&amp;x=&lt;1&gt;"');
        expect(xml).toContain("<ows:Identifier>a&amp;b</ows:Identifier>");
    });
});

describe('The tiles of the dataset, limited to some collections', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('OgcOpenApiTilesModel requests the collections', async () => {
        const model = await OgcOpenApiTilesModel.createFromTileSet({
            tileMatrix: EURO_3857, collection: "dataset", collections: ["erm_roads", "erm_rivers"],
            baseURL: "https://example.com/map/tiles/euro_3857/{tileMatrix}/{tileRow}/{tileCol}?f=png",
        });
        expect(path(model.getTileURL(model.baseURL, {level: 1, x: 1, y: 1}), "euro_3857")).toBe("01/0/1?f=png&transparent=true&collections=erm_roads,erm_rivers");
    });

    it('OgcOpenApiVectorTilesModel requests the collections', async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(null, {status: 204})));
        const model = new OgcOpenApiVectorTilesModel({
            tileMatrix: WEB_MERCATOR_QUAD, collection: "dataset", collections: ["roads"],
            baseURL: "https://example.com/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt",
        });
        await model.getVectorTile({level: 2, x: 1, y: 3});
        expect(String(fetchSpy.mock.calls[0][0])).toBe("https://example.com/tiles/WebMercatorQuad/2/0/1?f=mvt&collections=roads");
    });
});

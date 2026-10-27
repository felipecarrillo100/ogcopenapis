import {describe, expect, it} from 'vitest';
import {OgcOpenApiTileMatrixTools} from "./OgcOpenApiTileMatrixTools";
import {TileSetData} from "./OgcOpenApiGetCapabilities";

// TileMatrixSet definitions as served by demo.ldproxy.net and maps.gnosis.earth
import WebMercatorQuadJson from "./fixtures/tms-WebMercatorQuad.json";
import WorldMercatorWGS84QuadJson from "./fixtures/tms-WorldMercatorWGS84Quad.json";
import WorldCRS84QuadJson from "./fixtures/tms-WorldCRS84Quad.json";
import CDB1GlobalGridJson from "./fixtures/tms-CDB1GlobalGrid.json";
import EuropeanETRS89LAEAQuadJson from "./fixtures/tms-pdok-EuropeanETRS89_LAEAQuad.json";
import {registerReferences} from "../demo/src/references";

const WebMercatorQuad = WebMercatorQuadJson as unknown as TileSetData;
const WorldMercatorWGS84Quad = WorldMercatorWGS84QuadJson as unknown as TileSetData;
const WorldCRS84Quad = WorldCRS84QuadJson as unknown as TileSetData;
const CDB1GlobalGrid = CDB1GlobalGridJson as unknown as TileSetData;
const EuropeanETRS89_LAEAQuad = EuropeanETRS89LAEAQuadJson as unknown as TileSetData;

const TEMPLATE = "https://example.com/collections/c/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}";

describe('OgcOpenApiTileMatrixTools.createTileGrid', () => {

    it('WebMercatorQuad', () => {
        const grid = OgcOpenApiTileMatrixTools.createTileGrid(WebMercatorQuad);
        expect(grid.reference.identifier).toBe("EPSG:3857");
        expect(grid.levelOffset).toBe(0);
        expect(grid.levelCount).toBe(25);
        expect(grid.level0Columns).toBe(1);
        expect(grid.level0Rows).toBe(1);
        expect(grid.tileWidth).toBe(256);
        expect(grid.bounds.x).toBeCloseTo(-20037508.3427892, 3);
        expect(grid.bounds.y).toBeCloseTo(-20037508.3427892, 3);
        expect(grid.bounds.width).toBeCloseTo(40075016.6855784, 3);
        expect(grid.bounds.height).toBeCloseTo(40075016.6855784, 3);
    });

    it('WorldMercatorWGS84Quad', () => {
        const grid = OgcOpenApiTileMatrixTools.createTileGrid(WorldMercatorWGS84Quad);
        expect(grid.reference.identifier).toBe("EPSG:3395");
        expect(grid.levelCount).toBe(25);
        expect(grid.bounds.width).toBeCloseTo(40075016.6855784, 3);
    });

    it('WorldCRS84Quad has two columns at level 0', () => {
        const grid = OgcOpenApiTileMatrixTools.createTileGrid(WorldCRS84Quad);
        expect(grid.reference.identifier).toBe("CRS:84");
        expect(grid.level0Columns).toBe(2);
        expect(grid.level0Rows).toBe(1);
        expect([grid.bounds.x, grid.bounds.width, grid.bounds.y, grid.bounds.height]).toEqual([-180, 360, -90, 180]);
    });

    it('CDB1GlobalGrid swaps Lat,Lon and only its last level is quad-tree compatible', () => {
        const grid = OgcOpenApiTileMatrixTools.createTileGrid(CDB1GlobalGrid);
        expect(grid.reference.identifier).toBe("EPSG:4326");
        expect(grid.levelCount).toBe(1);
        expect(grid.tileMatrices[0].id).toBe(CDB1GlobalGrid.tileMatrices[CDB1GlobalGrid.tileMatrices.length - 1].id);
        expect([grid.bounds.x, grid.bounds.width, grid.bounds.y, grid.bounds.height]).toEqual([-180, 360, -90, 180]);
    });

    it('Uses the matrix id, also when it is not a number', () => {
        const tileSet = {
            ...WorldCRS84Quad,
            tileMatrices: WorldCRS84Quad.tileMatrices.map(m => ({...m, id: "EPSG:4326:" + m.id}))
        };
        const grid = OgcOpenApiTileMatrixTools.createTileGrid(tileSet);
        expect(grid.levelCount).toBe(30);
        expect(OgcOpenApiTileMatrixTools.resolveTileTemplate(TEMPLATE, grid, {level: 3, x: 1, y: 0}))
            .toBe("https://example.com/collections/c/tiles/WebMercatorQuad/EPSG:4326:3/7/1");
    });
});

describe('OgcOpenApiTileMatrixTools.resolveTileTemplate', () => {
    const grid = OgcOpenApiTileMatrixTools.createTileGrid(WebMercatorQuad);

    it('Level 0', () => {
        expect(OgcOpenApiTileMatrixTools.resolveTileTemplate(TEMPLATE, grid, {level: 0, x: 0, y: 0}))
            .toBe("https://example.com/collections/c/tiles/WebMercatorQuad/0/0/0");
    });

    it('Flips the bottom-up LuciadRIA row to a topLeft row, row before column', () => {
        // Daraa: tileMatrix 12, tileRow 1655, tileCol 2458
        expect(OgcOpenApiTileMatrixTools.resolveTileTemplate(TEMPLATE, grid, {level: 12, x: 2458, y: 4095 - 1655}))
            .toBe("https://example.com/collections/c/tiles/WebMercatorQuad/12/1655/2458");
    });

    it('Does not flip for bottomLeft', () => {
        const bottomLeft = OgcOpenApiTileMatrixTools.createTileGrid({
            ...WebMercatorQuad,
            tileMatrices: WebMercatorQuad.tileMatrices.map(m => ({...m, cornerOfOrigin: "bottomLeft"}))
        });
        expect(OgcOpenApiTileMatrixTools.resolveTileTemplate(TEMPLATE, bottomLeft, {level: 2, x: 1, y: 3}))
            .toBe("https://example.com/collections/c/tiles/WebMercatorQuad/2/3/1");
    });

    it('Returns null beyond the deepest level', () => {
        expect(OgcOpenApiTileMatrixTools.resolveTileTemplate(TEMPLATE, grid, {level: 25, x: 0, y: 0})).toBeNull();
    });
});

describe('OgcOpenApiTileMatrixTools.appendQueryParameters', () => {

    it('Starts a query string', () => {
        expect(OgcOpenApiTileMatrixTools.appendQueryParameters("https://a/0/0/0", {transparent: true}))
            .toBe("https://a/0/0/0?transparent=true");
    });

    it('Extends an existing query string', () => {
        expect(OgcOpenApiTileMatrixTools.appendQueryParameters("https://a/0/0/0?f=png", {transparent: false, bgcolor: "#FFFFFF"}))
            .toBe("https://a/0/0/0?f=png&transparent=false&bgcolor=%23FFFFFF");
    });

    it('Skips undefined values', () => {
        expect(OgcOpenApiTileMatrixTools.appendQueryParameters("https://a/0/0/0", {bgcolor: undefined}))
            .toBe("https://a/0/0/0");
    });
});

describe('OgcOpenApiTileMatrixTools.createTileGrid, a tile matrix set with northing first', () => {

    it('EuropeanETRS89_LAEAQuad (PDOK): orderedAxes Y, X, so pointOfOrigin is northing, easting', () => {
        registerReferences();
        const grid = OgcOpenApiTileMatrixTools.createTileGrid(EuropeanETRS89_LAEAQuad);
        expect(grid.reference.identifier).toBe("EPSG:3035");
        // pointOfOrigin [5500000, 2000000] is the top left corner: easting 2000000, northing 5500000
        expect(grid.bounds.x).toBeCloseTo(2000000, 3);
        expect(grid.bounds.y + grid.bounds.height).toBeCloseTo(5500000, 3);
    });
});

describe('OgcOpenApiTileMatrixTools.setCollections', () => {
    const TEMPLATE_URL = "https://example.com/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt";

    it('Appends the collections, keeping the query and the braces of the template', () => {
        expect(OgcOpenApiTileMatrixTools.setCollections(TEMPLATE_URL, ["roads", "rivers"]))
            .toBe("https://example.com/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt&collections=roads,rivers");
        expect(OgcOpenApiTileMatrixTools.setCollections("https://example.com/tiles/{tileMatrix}", ["roads"]))
            .toBe("https://example.com/tiles/{tileMatrix}?collections=roads");
    });

    it('Replaces a collections parameter of the URL', () => {
        expect(OgcOpenApiTileMatrixTools.setCollections(TEMPLATE_URL + "&collections=all&x=1", ["roads"]))
            .toBe("https://example.com/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt&x=1&collections=roads");
    });

    it('Encodes a comma inside a collection id, not the commas between ids', () => {
        expect(OgcOpenApiTileMatrixTools.setCollections(TEMPLATE_URL, ["a,b", "c d"])).toContain("collections=a%2Cb,c%20d");
    });

    it('Keeps the URL as is without collections', () => {
        expect(OgcOpenApiTileMatrixTools.setCollections(TEMPLATE_URL, [])).toBe(TEMPLATE_URL);
        expect(OgcOpenApiTileMatrixTools.setCollections(TEMPLATE_URL, undefined)).toBe(TEMPLATE_URL);
    });
});

import {describe, expect, it} from '@jest/globals';
import {OgcOpenApiTileMatrixTools} from "./OgcOpenApiTileMatrixTools";
import {TileSetData} from "./OgcOpenApiGetCapabilities";

// TileMatrixSet definitions as served by demo.ldproxy.net and maps.gnosis.earth
const WebMercatorQuad: TileSetData = require("./fixtures/tms-WebMercatorQuad.json");
const WorldMercatorWGS84Quad: TileSetData = require("./fixtures/tms-WorldMercatorWGS84Quad.json");
const WorldCRS84Quad: TileSetData = require("./fixtures/tms-WorldCRS84Quad.json");
const CDB1GlobalGrid: TileSetData = require("./fixtures/tms-CDB1GlobalGrid.json");

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

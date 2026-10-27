import {afterEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {OgcOpenApiMvtTools} from "./OgcOpenApiMvtTools";
import {OgcOpenApiVectorTilesModel} from "./OgcOpenApiVectorTilesModel";
import WebMercatorQuadJson from "./fixtures/tms-WebMercatorQuad.json";
import {TileSetData} from "./OgcOpenApiGetCapabilities";

// Tiles recorded from the test servers, see test/servers.ts
const CUBEWERX_TILE = "test/fixtures/servers/cubewerx-daraa/797f4400f9e12a64.bin";
const LDPROXY_TILE = "test/fixtures/servers/ldproxy-daraa/e4c490ccb4dfcd1a.bin";
const WebMercatorQuad = WebMercatorQuadJson as unknown as TileSetData;

function readTile(path: string) {
    const bytes = readFileSync(path);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// A minimal MVT encoder for tiles that the servers do not provide
function varint(value: number) {
    const bytes = [];
    while (value >= 0x80) {
        bytes.push((value & 0x7f) | 0x80);
        value = Math.floor(value / 128);
    }
    bytes.push(value);
    return bytes;
}
function message(field: number, content: number[]) {
    return [...varint(field * 8 + 2), ...varint(content.length), ...content];
}
function layer(name: string, geometryTypes: number[]) {
    const nameBytes = [...new TextEncoder().encode(name)];
    // version 2, name, features with only a type
    return message(3, [...varint(15 * 8), 2, ...message(1, nameBytes), ...geometryTypes.flatMap(type => message(2, [...varint(3 * 8), type]))]);
}
function tile(...layers: number[][]) {
    return new Uint8Array(layers.flat()).buffer;
}

describe('OgcOpenApiMvtTools.getLayers', () => {

    it('Reads the layers of a CubeWerx tile', async () => {
        expect(await OgcOpenApiMvtTools.getLayers(readTile(CUBEWERX_TILE))).toEqual([{id: "TransportationGroundCrv", geometryDimension: 1}]);
    });

    it('Reads the layers of an ldproxy tile', async () => {
        expect(await OgcOpenApiMvtTools.getLayers(readTile(LDPROXY_TILE))).toEqual([{id: "TransportationGroundCrv", geometryDimension: 1}]);
    });

    it('Reads a gzip compressed tile', async () => {
        const gzipped = gzipSync(Buffer.from(readTile(CUBEWERX_TILE)));
        const content = gzipped.buffer.slice(gzipped.byteOffset, gzipped.byteOffset + gzipped.byteLength);
        expect(await OgcOpenApiMvtTools.getLayers(content)).toEqual([{id: "TransportationGroundCrv", geometryDimension: 1}]);
    });

    it('Gives the geometryDimension of each layer, none when the geometry types are mixed', async () => {
        const content = tile(layer("points", [1, 1]), layer("surfaces", [3]), layer("mixed", [1, 3]));
        expect(await OgcOpenApiMvtTools.getLayers(content)).toEqual([
            {id: "points", geometryDimension: 0},
            {id: "surfaces", geometryDimension: 2},
            {id: "mixed"},
        ]);
    });

    it('Skips layers without features', async () => {
        expect(await OgcOpenApiMvtTools.getLayers(tile(layer("empty", []), layer("lines", [2])))).toEqual([{id: "lines", geometryDimension: 1}]);
    });

    it('Resolves no layers for an empty tile', async () => {
        expect(await OgcOpenApiMvtTools.getLayers(new ArrayBuffer(0))).toEqual([]);
    });

    it('Rejects bytes that are not a vector tile', async () => {
        await expect(OgcOpenApiMvtTools.getLayers(new Uint8Array([0x1a, 0xff, 0xff, 0x01]).buffer)).rejects.toThrow("Invalid vector tile");
    });
});

describe('OgcOpenApiVectorTilesModel.discoverLayers', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createModel = () => new OgcOpenApiVectorTilesModel({
        tileMatrix: WebMercatorQuad, collection: "TransportationGroundCrv",
        baseURL: "https://example.com/collections/TransportationGroundCrv/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}",
    });

    it('Reads the layers of the first sample tile that has data', async () => {
        let requests = 0;
        vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            // The first sample tiles have no data
            return Promise.resolve(++requests < 3 ? new Response(null, {status: 404}) : new Response(readTile(CUBEWERX_TILE)));
        });
        // Daraa
        const layers = await createModel().discoverLayers({extent: [35.9, 32.4, 36.6, 33.1]});
        expect(layers).toEqual([{id: "TransportationGroundCrv", geometryDimension: 1}]);
        expect(requests).toBe(3);
    });

    it('Requests the tiles at the center of the extent', async () => {
        const urls: string[] = [];
        vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
            urls.push(String(input));
            return Promise.resolve(new Response(null, {status: 404}));
        });
        await createModel().discoverLayers({extent: [35.9, 32.4, 36.6, 33.1], maxRequests: 3});
        // Levels 0, 2 and 4 around 36.25E 32.75N
        expect(urls.map(u => u.split("/WebMercatorQuad/")[1])).toEqual(["0/0/0", "2/1/2", "4/6/9"]);
    });

    it('Resolves no layers when no sample tile has data', async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(null, {status: 404})));
        expect(await createModel().discoverLayers()).toEqual([]);
    });
});

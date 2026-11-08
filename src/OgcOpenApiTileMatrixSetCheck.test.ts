import {afterEach, describe, expect, it, vi} from 'vitest';
import {OgcOpenApiCapabilitiesObject, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";

// Tile matrix set definitions as GeoServer 2.28.6 (OGC 2D TMS 1.0 shape) and pygeoapi (TMS 2.0) serve them, matrices cut
import GeoServerEPSG900913 from "./fixtures/tms-geoserver-EPSG900913.json";
import PygeoapiWebMercatorQuad from "./fixtures/tms-pygeoapi-WebMercatorQuad.json";

// The definition of a tile matrix set is checked against OGC 2D TMS 2.0 (OGC 17-083r4), the version OGC API Tiles uses,
// and a definition that fails says what it lacks. Reported by a user of 1.3.0 (pre-release)

const base = "https://example.com/";

function server(): OgcOpenApiCapabilitiesObject {
    return {
        name: "", collections: [], version: "", service: "", info: {}, baseUrl: base,
        serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: base}),
    };
}

const meta = (id: string) => ({id, title: id, links: [{rel: "self", type: "application/json", title: "", href: base + "tileMatrixSets/" + id + "?f=json"}]});

const serveDefinition = (definition: object) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(definition), {status: 200}));

describe('OgcOpenApiGetCapabilities.fetchTileset checks OGC 2D TMS 2.0', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Accepts the definition of pygeoapi', async () => {
        serveDefinition(PygeoapiWebMercatorQuad);
        const tileMatrixSet = await OgcOpenApiGetCapabilities.fetchTileset(server(), meta("WebMercatorQuad"));
        expect(tileMatrixSet.id).toBe("WebMercatorQuad");
        expect(tileMatrixSet.tileMatrices.length).toBe(2);
    });

    it('Rejects the definition of GeoServer 2.28.6, naming supportedCRS of OGC 2D TMS 1.0', async () => {
        serveDefinition(GeoServerEPSG900913);
        await expect(OgcOpenApiGetCapabilities.fetchTileset(server(), meta("EPSG:900913"))).rejects.toMatchObject({
            error: true,
            message: "Tile matrix set EPSG:900913 has no crs (supportedCRS is OGC 2D TMS 1.0, not read) in " + base + "tileMatrixSets/EPSG:900913?f=json",
        });
    });

    it('Names the tile matrix and the numbers it lacks: GeoServer with a crs still has no cellSize', async () => {
        serveDefinition({...GeoServerEPSG900913, crs: "http://www.opengis.net/def/crs/EPSG/0/3857"});
        await expect(OgcOpenApiGetCapabilities.fetchTileset(server(), meta("EPSG:900913"))).rejects.toMatchObject({
            error: true,
            message: "Tile matrix set EPSG:900913 has tile matrix EPSG:900913:0 without cellSize in " + base + "tileMatrixSets/EPSG:900913?f=json",
        });
    });

    it('Names each missing property of a tile matrix, by its index when it has no id', async () => {
        const matrix = {...PygeoapiWebMercatorQuad.tileMatrices[0]};
        delete matrix.id;
        delete matrix.pointOfOrigin;
        serveDefinition({...PygeoapiWebMercatorQuad, tileMatrices: [PygeoapiWebMercatorQuad.tileMatrices[1], {...matrix, tileWidth: "256"}]});
        await expect(OgcOpenApiGetCapabilities.fetchTileset(server(), meta("WebMercatorQuad"))).rejects.toMatchObject({
            error: true,
            message: "Tile matrix set WebMercatorQuad has tile matrix 1 without id, tileWidth, pointOfOrigin in " + base + "tileMatrixSets/WebMercatorQuad?f=json",
        });
    });

    it('Rejects a definition without tileMatrices', async () => {
        const {tileMatrices, ...withoutMatrices} = PygeoapiWebMercatorQuad;
        serveDefinition(withoutMatrices);
        await expect(OgcOpenApiGetCapabilities.fetchTileset(server(), meta("WebMercatorQuad"))).rejects
            .toMatchObject({error: true, message: "Tile matrix set WebMercatorQuad has no tileMatrices in " + base + "tileMatrixSets/WebMercatorQuad?f=json"});
    });

    it('Accepts a definition without id, optional in TMS 2.0: the id of the list of tile matrix sets', async () => {
        const {id, ...withoutId} = PygeoapiWebMercatorQuad;
        serveDefinition(withoutId);
        expect((await OgcOpenApiGetCapabilities.fetchTileset(server(), meta("WebMercatorQuad"))).id).toBe("WebMercatorQuad");
    });

    it('Without id in the definition nor in the list, the uri of the definition as it is', async () => {
        const {id, ...withoutId} = PygeoapiWebMercatorQuad;
        serveDefinition(withoutId);
        expect((await OgcOpenApiGetCapabilities.fetchTileset(server(), {...meta("x"), id: undefined})).id).toBe(PygeoapiWebMercatorQuad.uri);
    });

    it('fetchTileSetsInFull rejects with the problem when no definition passes, as on GeoServer 2.28.6', async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            const url = String(input);
            if (url === base + "tileMatrixSets") return new Response(JSON.stringify({tileMatrixSets: [meta("EPSG:900913")]}), {status: 200});
            return new Response(JSON.stringify(GeoServerEPSG900913), {status: 200});
        });
        await expect(OgcOpenApiGetCapabilities.fetchTileSetsInFull(server())).rejects
            .toMatchObject({error: true, message: expect.stringContaining("EPSG:900913 has no crs (supportedCRS is OGC 2D TMS 1.0, not read)")});
    });
});

describe('OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet with the definition in the tileset', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const tileSetWith = (tileMatrixSet: object) => vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response(JSON.stringify({tileMatrixSet, links: []}), {status: 200}));
    const summary = {href: base + "collections/c/tiles/WebMercatorQuad?f=json"};

    it('Uses a definition without id, with its uri as id', async () => {
        const {id, ...withoutId} = PygeoapiWebMercatorQuad;
        tileSetWith(withoutId);
        const tileMatrixSet = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(server(), summary, []);
        expect(tileMatrixSet.id).toBe(PygeoapiWebMercatorQuad.uri);
    });

    it('Does not use a definition that is not TMS 2.0', async () => {
        tileSetWith(GeoServerEPSG900913);
        await expect(OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(server(), summary, [])).rejects
            .toMatchObject({error: true, message: "No tile matrix set for " + summary.href});
    });
});

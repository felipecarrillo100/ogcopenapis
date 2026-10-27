import {afterEach, describe, expect, it, vi} from 'vitest';
import {
    CollectionLinkType,
    CollectionTileSetInfo,
    OgcOpenApiCapabilitiesCollection,
    OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities,
    TileSetData
} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";

// Tileset lists of collections, as served by demo.pygeoapi.io, test.cubewerx.com and maps.gnosis.earth
import PygeoapiLakes from "./fixtures/tilesets-pygeoapi-lakes.json";
import CubewerxDaraaMap from "./fixtures/tilesets-cubewerx-daraa-map.json";
import CubewerxDaraaVector from "./fixtures/tilesets-cubewerx-daraa-vector.json";
import GnosisOsmDc from "./fixtures/tilesets-gnosis-osm-dc.json";

const VECTOR = "http://www.opengis.net/def/rel/ogc/1.0/tilesets-vector";
const MAP = "http://www.opengis.net/def/rel/ogc/1.0/tilesets-map";
const URI = "http://www.opengis.net/def/tilematrixset/OGC/1.0/";

function server(url: string): OgcOpenApiCapabilitiesObject {
    return {
        name: "", collections: [], version: "", service: "", info: {}, baseUrl: url,
        serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: url}),
    };
}

function collection(id: string, rel: string, href: string): OgcOpenApiCapabilitiesCollection {
    return {
        id, name: id, title: id, defaultReference: "CRS:84", outputFormats: [], description: "", keywords: [], extent: {},
        links: [{rel, type: "application/json", title: "", href}],
    };
}

function respondWith(json: object) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify(json), {status: 200})));
}

// The tile matrix sets of a server, as fetchTileSetsInFull resolves them, with only what matching uses
function tileMatrixSets(...sets: { id: string, uri?: string }[]) {
    return sets.map(s => ({...s, title: s.id, crs: "", orderedAxes: [], tileMatrices: [], boundingBox: undefined}) as TileSetData);
}

describe('OgcOpenApiGetCapabilities.fetchCollectionTileSets', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('pygeoapi lakes is tiled in WebMercatorQuad only', async () => {
        respondWith(PygeoapiLakes);
        const tileSets = await OgcOpenApiGetCapabilities.fetchCollectionTileSets(server("https://demo.pygeoapi.io/master/"),
            collection("lakes", VECTOR, "https://demo.pygeoapi.io/master/collections/lakes/tiles?f=json"), CollectionLinkType.VectorTiles);
        expect(tileSets).toEqual([{
            tileMatrixSetURI: URI + "WebMercatorQuad", tileMatrixSetId: undefined, dataType: "vector", crs: "http://www.opengis.net/def/crs/EPSG/0/3857",
            href: "https://demo.pygeoapi.io/master/collections/lakes/tiles/WebMercatorQuad?f=json",
            tilingSchemeHref: "https://demo.pygeoapi.io/master/TileMatrixSets/WebMercatorQuad?f=json",
        }]);
    });

    it('CubeWerx links each tileset with its own tile matrix set id', async () => {
        respondWith(CubewerxDaraaMap);
        const base = "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa/";
        const tileSets = await OgcOpenApiGetCapabilities.fetchCollectionTileSets(server(base),
            collection("Daraa_mosaic_2019", MAP, base + "collections/Daraa_mosaic_2019/map/tiles"));
        expect(tileSets.map(t => [t.tileMatrixSetURI.split("/").pop(), t.href.split("/map/tiles/")[1], t.dataType])).toEqual([
            ["WorldCRS84Quad", "wgs84?f=json", "map"],
            ["WorldMercatorWGS84Quad", "3395?f=json", "map"],
            ["WebMercatorQuad", "smerc?f=json", "map"],
        ]);
    });

    it('Completes relative links (GNOSIS)', async () => {
        respondWith(GnosisOsmDc);
        const tileSets = await OgcOpenApiGetCapabilities.fetchCollectionTileSets(server("https://maps.gnosis.earth/ogcapi/"),
            collection("osm:dc", VECTOR, "https://maps.gnosis.earth/ogcapi/collections/osm:dc/tiles?f=json"), CollectionLinkType.VectorTiles);
        expect(tileSets.length).toBe(GnosisOsmDc.tilesets.length);
        expect(tileSets[0].href).toBe("https://maps.gnosis.earth/ogcapi/collections/osm:dc/tiles/CDB1GlobalGrid?f=json");
        expect(tileSets[0].tilingSchemeHref).toBe("https://maps.gnosis.earth/ogcapi/tileMatrixSets/CDB1GlobalGrid");
    });

    it('Rejects a collection without a tilesets link of the type', async () => {
        await expect(OgcOpenApiGetCapabilities.fetchCollectionTileSets(server("https://example.com/"),
            collection("c", MAP, "https://example.com/collections/c/map/tiles"), CollectionLinkType.VectorTiles)).rejects.toBeDefined();
    });
});

describe('OgcOpenApiGetCapabilities.matchTileMatrixSet', () => {

    const tileSet = (uri?: string, id?: string, tilingScheme?: string): CollectionTileSetInfo =>
        ({tileMatrixSetURI: uri, tileMatrixSetId: id, href: "", tilingSchemeHref: tilingScheme});

    it('By URI, the server names WebMercatorQuad smerc (CubeWerx)', () => {
        const sets = tileMatrixSets({id: "wgs84", uri: URI + "WorldCRS84Quad"}, {id: "3395", uri: URI + "WorldMercatorWGS84Quad"}, {id: "smerc", uri: URI + "WebMercatorQuad"});
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI + "WebMercatorQuad"), sets).id).toBe("smerc");
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI + "WorldCRS84Quad"), sets).id).toBe("wgs84");
    });

    it('By URI, also with http or https, a trailing slash or a host in another case', () => {
        const sets = tileMatrixSets({id: "wgs84", uri: URI + "WorldCRS84Quad"}, {id: "smerc", uri: URI + "WebMercatorQuad"});
        const https = URI.replace("http:", "https:");
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(https + "WebMercatorQuad"), sets).id).toBe("smerc");
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI + "WebMercatorQuad/"), sets).id).toBe("smerc");
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI.replace("www.opengis.net", "WWW.OpenGIS.net") + "WebMercatorQuad"), sets).id).toBe("smerc");
        const httpsSets = tileMatrixSets({id: "smerc", uri: https + "WebMercatorQuad/"});
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI + "WebMercatorQuad"), httpsSets).id).toBe("smerc");
    });

    it('Not by URI when the path differs in case, paths are case-sensitive', () => {
        const sets = tileMatrixSets({id: "smerc", uri: URI + "WebMercatorQuad"});
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI + "webmercatorquad"), sets)).toBeUndefined();
    });

    it('By id', () => {
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(undefined, "WebMercatorQuad"),
            tileMatrixSets({id: "WorldCRS84Quad"}, {id: "WebMercatorQuad"})).id).toBe("WebMercatorQuad");
    });

    it('By the last part of the URI, when the server gives its tile matrix sets no URI', () => {
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI + "WebMercatorQuad"),
            tileMatrixSets({id: "WorldCRS84Quad"}, {id: "WebMercatorQuad"})).id).toBe("WebMercatorQuad");
    });

    it('By the tiling-scheme link', () => {
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(undefined, undefined, "https://example.com/TileMatrixSets/WebMercatorQuad?f=json"),
            tileMatrixSets({id: "WebMercatorQuad"})).id).toBe("WebMercatorQuad");
    });

    it('No tile matrix set of the server for the tileset', () => {
        expect(OgcOpenApiGetCapabilities.matchTileMatrixSet(tileSet(URI + "GNOSISGlobalGrid"), tileMatrixSets({id: "WebMercatorQuad"}))).toBeUndefined();
    });
});

describe('OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const base = "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/";
    // CubeWerx lists the tileset of EuroRegionalMap with a self link only, as OGC API Tiles allows for the summary
    const summary: CollectionTileSetInfo = {dataType: "map", href: base + "collections/erm/styles/default/map/tiles/euro_3857?f=json"};

    it('Reads the tileset when its summary does not identify the tile matrix set', async () => {
        const fetchSpy = respondWith({dataType: "map", links: [{rel: "http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme", href: base + "tileMatrixSets/euro_3857"}]});
        const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(server(base), summary, tileMatrixSets({id: "euro_3857"}));
        expect(tileMatrix.id).toBe("euro_3857");
        expect(String(fetchSpy.mock.calls[0][0])).toBe(summary.href);
    });

    it('Does not read the tileset when its summary identifies the tile matrix set', async () => {
        const fetchSpy = respondWith({});
        const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(server(base),
            {...summary, tileMatrixSetURI: URI + "WebMercatorQuad"}, tileMatrixSets({id: "smerc", uri: URI + "WebMercatorQuad"}));
        expect(tileMatrix.id).toBe("smerc");
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Rejects a tileset that does not identify its tile matrix set at all', async () => {
        respondWith({dataType: "map", links: []});
        await expect(OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(server(base), summary, tileMatrixSets({id: "euro_3857"}))).rejects.toBeDefined();
    });
});

describe('OgcOpenApiGetCapabilities.fetchCollectionTileSet', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const TILESET = {dataType: "vector", links: [{rel: "item", type: "application/vnd.mapbox-vector-tile", href: "https://example.com/{tileMatrix}/{tileRow}/{tileCol}"}]};
    const lakes = collection("lakes", VECTOR, "https://example.com/collections/lakes/tiles?f=json");

    it('Follows the self link of a tileset', async () => {
        const fetchSpy = respondWith(TILESET);
        const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(server("https://example.com/"), lakes,
            {href: "https://example.com/collections/lakes/tiles/smerc?f=json"}, {}, CollectionLinkType.VectorTiles);
        expect(String(fetchSpy.mock.calls[0][0])).toBe("https://example.com/collections/lakes/tiles/smerc?f=json");
        expect(tileSet.links[0].href).toBe("https://example.com/{tileMatrix}/{tileRow}/{tileCol}");
    });

    it('Still builds the tileset URL from a tile matrix set id', async () => {
        const fetchSpy = respondWith(TILESET);
        await OgcOpenApiGetCapabilities.fetchCollectionTileSet(server("https://example.com/"), lakes, "WebMercatorQuad", {}, CollectionLinkType.VectorTiles);
        expect(String(fetchSpy.mock.calls[0][0])).toBe("https://example.com/collections/lakes/tiles/WebMercatorQuad");
    });
});

describe('OgcOpenApiGetCapabilities.fetchTileSetsInFull', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const base = "https://example.com/";
    const definition = (id: string) => ({id, crs: "http://www.opengis.net/def/crs/EPSG/0/3857", tileMatrices: []});
    const list = {tileMatrixSets: ["WebMercatorQuad", "Broken"].map(id => ({id, title: id, links: [{rel: "self", type: "application/json", href: base + "tileMatrixSets/" + id + "?f=json"}]}))};

    function respondByUrl(responses: { [url: string]: { status: number, json?: object } }) {
        return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
            const response = responses[String(input)];
            return Promise.resolve(response ? new Response(JSON.stringify(response.json), {status: response.status}) : new Response("", {status: 404}));
        });
    }

    it('Leaves out a definition that cannot be read', async () => {
        respondByUrl({
            [base + "tileMatrixSets"]: {status: 200, json: list},
            [base + "tileMatrixSets/WebMercatorQuad?f=json"]: {status: 200, json: definition("WebMercatorQuad")},
            [base + "tileMatrixSets/Broken?f=json"]: {status: 500},
        });
        const tileMatrixSets = await OgcOpenApiGetCapabilities.fetchTileSetsInFull(server(base));
        expect(tileMatrixSets.map(t => t.id)).toEqual(["WebMercatorQuad"]);
    });

    it('Rejects with the error when no definition can be read', async () => {
        respondByUrl({[base + "tileMatrixSets"]: {status: 200, json: list}});
        await expect(OgcOpenApiGetCapabilities.fetchTileSetsInFull(server(base))).rejects.toEqual({error: true, message: "Invalid response: 404"});
    });

    it('Requests a definition by its link as given, with its query and an Accept header', async () => {
        const fetchSpy = respondWith(definition("WebMercatorQuad"));
        await OgcOpenApiGetCapabilities.fetchTileset(server(base), list.tileMatrixSets[0] as any, {requestHeaders: {Authorization: "Bearer x"}});
        expect(String(fetchSpy.mock.calls[0][0])).toBe(base + "tileMatrixSets/WebMercatorQuad?f=json");
        expect(fetchSpy.mock.calls[0][1].headers).toEqual({Accept: "application/json", Authorization: "Bearer x"});
    });
});

describe('OgcOpenApiGetCapabilities tiling-scheme links', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Accepts the short rel of the tiling-scheme link', async () => {
        respondWith({tilesets: [{links: [
            {rel: "self", type: "application/json", href: "https://example.com/collections/c/tiles/WebMercatorQuad"},
            {rel: "tiling-scheme", href: "https://example.com/tileMatrixSets/WebMercatorQuad"},
        ]}]});
        const tileSets = await OgcOpenApiGetCapabilities.fetchCollectionTileSets(server("https://example.com/"),
            collection("c", VECTOR, "https://example.com/collections/c/tiles"), CollectionLinkType.VectorTiles);
        expect(tileSets[0].tilingSchemeHref).toBe("https://example.com/tileMatrixSets/WebMercatorQuad");
    });
});

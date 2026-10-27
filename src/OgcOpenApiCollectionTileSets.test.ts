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

    it('Still builds the tileset URL from a tile matrix set id, with the query of the tilesets link', async () => {
        const fetchSpy = respondWith(TILESET);
        await OgcOpenApiGetCapabilities.fetchCollectionTileSet(server("https://example.com/"), lakes, "WebMercatorQuad", {}, CollectionLinkType.VectorTiles);
        expect(String(fetchSpy.mock.calls[0][0])).toBe("https://example.com/collections/lakes/tiles/WebMercatorQuad?f=json");
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

describe('OgcOpenApiGetCapabilities relative links', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Resolves the links of a tileset list against the list', async () => {
        respondWith({tilesets: [{links: [
            {rel: "self", type: "application/json", href: "WebMercatorQuad?f=json"},
            {rel: "http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme", href: "../../../tileMatrixSets/WebMercatorQuad"},
        ]}]});
        const tileSets = await OgcOpenApiGetCapabilities.fetchCollectionTileSets(server("https://example.com/ogcapi/"),
            collection("c", VECTOR, "https://example.com/ogcapi/collections/c/tiles/"), CollectionLinkType.VectorTiles);
        expect(tileSets[0].href).toBe("https://example.com/ogcapi/collections/c/tiles/WebMercatorQuad?f=json");
        expect(tileSets[0].tilingSchemeHref).toBe("https://example.com/ogcapi/tileMatrixSets/WebMercatorQuad");
    });

    it('Resolves the tile URL template of a tileset against the tileset', async () => {
        respondWith({dataType: "vector", links: [{rel: "item", type: "application/vnd.mapbox-vector-tile", href: "./WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}"}]});
        const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(server("https://example.com/ogcapi/"),
            collection("c", VECTOR, "https://example.com/ogcapi/collections/c/tiles"),
            {href: "https://example.com/ogcapi/collections/c/tiles/WebMercatorQuad"}, {}, CollectionLinkType.VectorTiles);
        expect(tileSet.links[0].href).toBe("https://example.com/ogcapi/collections/c/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}");
    });
});

describe('OgcOpenApiGetCapabilities.fromURL query', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Requests the landing page with the query it is given, such as an api key', async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({links: []}), {status: 200})));
        await OgcOpenApiGetCapabilities.fromURL("https://example.com/ogcapi?apikey=k1").catch(() => undefined);
        expect(String(fetchSpy.mock.calls[0][0])).toBe("https://example.com/ogcapi/?apikey=k1");
    });
});

describe('OgcOpenApiGetCapabilities.fromURL relative links', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Resolves the landing page links against it, the collection links against /collections', async () => {
        const documents = {
            "https://example.com/ogcapi/": {links: [
                {rel: "data", type: "application/json", href: "collections?f=json"},
                {rel: "http://www.opengis.net/def/rel/ogc/1.0/tiling-schemes", type: "application/json", href: "./tileMatrixSets"},
            ]},
            "https://example.com/ogcapi/collections?f=json": {collections: [{id: "lakes", title: "Lakes", links: [
                {rel: "items", type: "application/geo+json", href: "collections/lakes/items"},
                {rel: "http://www.opengis.net/def/rel/ogc/1.0/tilesets-vector", type: "application/json", href: "./collections/lakes/tiles"},
            ]}]},
        };
        vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
            Promise.resolve(new Response(JSON.stringify(documents[String(input)]), {status: documents[String(input)] ? 200 : 404})));
        const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://example.com/ogcapi/");
        expect(capabilities.tileMatrixSetsUrl).toBe("https://example.com/ogcapi/tileMatrixSets");
        expect(capabilities.collections[0].links.map(l => l.href)).toEqual([
            "https://example.com/ogcapi/collections/lakes/items",
            "https://example.com/ogcapi/collections/lakes/tiles",
        ]);
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

describe('OgcOpenApiGetCapabilities dataset tilesets', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const base = "https://api.example.com/ogc/v1/";
    const capabilities = (links: { rel: string, href: string }[]) =>
        ({...server(base), links: links.map(l => ({...l, type: "application/json", title: ""}))});
    const LANDING = [{rel: VECTOR, href: base + "tiles"}];

    it('Whether the server tiles the dataset, per type', () => {
        expect(OgcOpenApiGetCapabilities.hasDatasetTileSets(capabilities(LANDING), CollectionLinkType.VectorTiles)).toBe(true);
        expect(OgcOpenApiGetCapabilities.hasDatasetTileSets(capabilities(LANDING), CollectionLinkType.Tiles)).toBe(false);
        expect(OgcOpenApiGetCapabilities.hasDatasetTileSets(server(base), CollectionLinkType.VectorTiles)).toBe(false);
    });

    it('Lists the tilesets of the landing page tiles link (PDOK)', async () => {
        const fetchSpy = respondWith({tilesets: [{
            tileMatrixSetId: "NetherlandsRDNewQuad", dataType: "vector", crs: "https://www.opengis.net/def/crs/EPSG/0/28992",
            links: [{rel: "self", href: base + "tiles/NetherlandsRDNewQuad"}, {rel: "http://www.opengis.net/def/rel/ogc/1.0/tiling-scheme", href: base + "tileMatrixSets/NetherlandsRDNewQuad"}],
        }]});
        const tileSets = await OgcOpenApiGetCapabilities.fetchDatasetTileSets(capabilities(LANDING), CollectionLinkType.VectorTiles);
        expect(String(fetchSpy.mock.calls[0][0])).toBe(base + "tiles");
        expect(tileSets.map(t => [t.tileMatrixSetId, t.href, t.tilingSchemeHref])).toEqual([
            ["NetherlandsRDNewQuad", base + "tiles/NetherlandsRDNewQuad", base + "tileMatrixSets/NetherlandsRDNewQuad"]]);
    });

    it('Rejects when the dataset is not tiled', async () => {
        await expect(OgcOpenApiGetCapabilities.fetchDatasetTileSets(server(base), CollectionLinkType.VectorTiles)).rejects.toBeDefined();
    });

    it('Builds the tileset URL of the dataset from a tile matrix set id', async () => {
        const fetchSpy = respondWith({dataType: "vector", boundingBox: {lowerLeft: [35.7, 32.3], upperRight: [37.2, 33.2], crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
            links: [{rel: "item", type: "application/vnd.mapbox-vector-tile", href: base + "tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}"}]});
        const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities(LANDING), null, "WebMercatorQuad", {}, CollectionLinkType.VectorTiles);
        expect(String(fetchSpy.mock.calls[0][0])).toBe(base + "tiles/WebMercatorQuad");
        expect(tileSet.boundingBox.lowerLeft).toEqual([35.7, 32.3]);
    });
});

describe('OgcOpenApiGetCapabilities tile matrix set in the tileset', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const inline = {id: "Custom", crs: "http://www.opengis.net/def/crs/EPSG/0/3857", tileMatrices: [{id: "0"}]};

    it('Uses the tile matrix set of the tileset summary without a request', async () => {
        const fetchSpy = respondWith({tilesets: [{links: [{rel: "self", type: "application/json", href: "https://example.com/tiles/Custom"}], tileMatrixSet: inline}]});
        const [tileSet] = await OgcOpenApiGetCapabilities.fetchCollectionTileSets(server("https://example.com/"),
            collection("c", VECTOR, "https://example.com/tiles"), CollectionLinkType.VectorTiles);
        fetchSpy.mockClear();
        const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(server("https://example.com/"), tileSet, tileMatrixSets({id: "WebMercatorQuad"}));
        expect(tileMatrix.id).toBe("Custom");
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Uses the tile matrix set of the tileset, when its summary does not identify one', async () => {
        respondWith({dataType: "vector", tileMatrixSet: inline, links: []});
        const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(server("https://example.com/"),
            {href: "https://example.com/tiles/Custom"}, tileMatrixSets({id: "WebMercatorQuad"}));
        expect(tileMatrix.id).toBe("Custom");
    });
});

describe('OgcOpenApiGetCapabilities JSON-FG', () => {
    const link = (type: string, profile?: string | string[]) => ({rel: "items", type, title: "", href: "https://example.com/items", profile});

    it('Recognises JSON-FG by its media type (PDOK, CubeWerx) and by its profile (ldproxy)', () => {
        expect(OgcOpenApiGetCapabilities.isJsonFgLink(link("application/vnd.ogc.fg+json"))).toBe(true);
        expect(OgcOpenApiGetCapabilities.isJsonFgLink(link("application/vnd.ogc.fg+json; conformance=geojson"))).toBe(true);
        expect(OgcOpenApiGetCapabilities.isJsonFgLink(link("application/geo+json", ["http://www.opengis.net/def/profile/OGC/0/jsonfg"]))).toBe(true);
        expect(OgcOpenApiGetCapabilities.isJsonFgLink(link("application/geo+json", ["http://www.opengis.net/def/profile/OGC/0/rfc7946"]))).toBe(false);
        expect(OgcOpenApiGetCapabilities.isJsonFgLink(link("application/geo+json"))).toBe(false);
    });

    it('Reports JSON-FG as application/vnd.ogc.fg+json in the formats of a collection', async () => {
        const documents = {
            "https://example.com/": {links: [{rel: "data", type: "application/json", href: "https://example.com/collections"}]},
            "https://example.com/collections": {collections: [{id: "c", links: [
                {rel: "items", type: "application/geo+json", href: "https://example.com/collections/c/items?f=json&profile=jsonfg", profile: ["http://www.opengis.net/def/profile/OGC/0/jsonfg"]},
                {rel: "items", type: "application/geo+json", href: "https://example.com/collections/c/items?f=json&profile=rfc7946", profile: ["http://www.opengis.net/def/profile/OGC/0/rfc7946"]},
            ]}]},
        };
        vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
            Promise.resolve(new Response(JSON.stringify(documents[String(input)]), {status: documents[String(input)] ? 200 : 404})));
        const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://example.com/", {filterCollectionsByLinkType: CollectionLinkType.Items});
        expect(capabilities.collections[0].outputFormats).toEqual(["application/vnd.ogc.fg+json", "application/geo+json"]);
        vi.restoreAllMocks();
    });
});

describe('OgcOpenApiGetCapabilities collections selection', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const withConformance = (conformsTo?: string[]) => ({...server("https://example.com/"), conformsTo});

    it('Supported when the server declares the conformance class of the standard', () => {
        expect(OgcOpenApiGetCapabilities.supportsCollectionSelection(withConformance(["http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collections-selection"]))).toBe(true);
    });

    it('Supported when the server declares the variant name of ldproxy, collection-selection', () => {
        expect(OgcOpenApiGetCapabilities.supportsCollectionSelection(withConformance(["http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collection-selection"]))).toBe(true);
    });

    it('Not supported otherwise', () => {
        expect(OgcOpenApiGetCapabilities.supportsCollectionSelection(withConformance(["http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/core"]))).toBe(false);
        expect(OgcOpenApiGetCapabilities.supportsCollectionSelection(withConformance(undefined))).toBe(false);
        expect(OgcOpenApiGetCapabilities.supportsCollectionSelection(null)).toBe(false);
    });

    function serve(documents: { [url: string]: object }) {
        return vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
            Promise.resolve(new Response(JSON.stringify(documents[String(input)]), {status: documents[String(input)] ? 200 : 404})));
    }
    const landing = (links: object[]) => ({
        "https://example.com/": {links: [{rel: "data", type: "application/json", href: "https://example.com/collections"}, ...links]},
        "https://example.com/collections": {collections: []},
    });

    it('fromURL reads the conformance classes, from an untyped link, with an Accept header', async () => {
        const fetchSpy = serve({
            ...landing([{rel: "conformance", href: "https://example.com/conformance"}]),
            "https://example.com/conformance": {conformsTo: ["http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collections-selection"]},
        });
        const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://example.com/");
        expect(capabilities.conformsTo).toEqual(["http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collections-selection"]);
        const conformanceCall = fetchSpy.mock.calls.find(call => String(call[0]) === "https://example.com/conformance");
        expect((conformanceCall[1].headers as any).Accept).toBe("application/json");
    });

    it('fromURL declares no conformance classes without a conformance link, or when it cannot be read', async () => {
        serve(landing([]));
        expect((await OgcOpenApiGetCapabilities.fromURL("https://example.com/")).conformsTo).toEqual([]);
        vi.restoreAllMocks();
        serve(landing([{rel: "http://www.opengis.net/def/rel/ogc/1.0/conformance", href: "https://example.com/missing"}]));
        expect((await OgcOpenApiGetCapabilities.fromURL("https://example.com/")).conformsTo).toEqual([]);
    });
});

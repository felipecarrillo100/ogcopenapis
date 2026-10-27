/**
 * Public OGC API servers used by the tests, with one example of each kind of data they serve.
 * test/servers.test.ts replays their recorded responses, test/servers.live.test.ts calls them.
 * Record again with npm run test:record when a server changes.
 */
export interface TestServer {
    id: string;
    title: string;
    url: string;
    features?: { collection: string };
    maps?: { collection: string };
    mapTiles?: { collection: string, tileMatrixSet: string };
    // knownIssue: why the layer is not painted in the demo yet, the browser test expects it to fail
    vectorTiles?: { collection: string, tileMatrixSet: string, style?: string, knownIssue?: string };
    // Why the server is not recorded, its responses are only tested live
    notRecorded?: string;
}

export const TEST_SERVERS: TestServer[] = [
    {
        id: "ldproxy-daraa",
        title: "OGC Daraa, ldproxy",
        url: "https://demo.ldproxy.net/daraa/",
        features: {collection: "TransportationGroundCrv"},
        vectorTiles: {collection: "TransportationGroundCrv", tileMatrixSet: "WebMercatorQuad", style: "topographic"},
    },
    {
        id: "ldproxy-vineyards",
        title: "Vineyards, ldproxy",
        url: "https://demo.ldproxy.net/vineyards/",
        features: {collection: "vineyards"},
        vectorTiles: {collection: "vineyards", tileMatrixSet: "WebMercatorQuad", style: "default"},
    },
    {
        id: "ldproxy-strassen",
        title: "Strassen NRW, ldproxy",
        url: "https://demo.ldproxy.net/strassen/",
        features: {collection: "netzknoten"},
        vectorTiles: {collection: "abschnitteaeste", tileMatrixSet: "WebMercatorQuad"},
    },
    {
        id: "ldproxy-zoomstack",
        title: "OS Open Zoomstack, ldproxy",
        url: "https://demo.ldproxy.net/zoomstack/",
        features: {collection: "airports"},
    },
    {
        id: "cubewerx-daraa",
        title: "OGC Daraa, CubeWerx",
        url: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa/",
        features: {collection: "TransportationGroundCrv"},
        maps: {collection: "Daraa_mosaic_2019"},
        mapTiles: {collection: "Daraa_mosaic_2019", tileMatrixSet: "smerc"},
        vectorTiles: {collection: "TransportationGroundCrv", tileMatrixSet: "smerc"},
    },
    {
        id: "cubewerx-euroregionalmap",
        title: "EuroRegionalMap, CubeWerx",
        url: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/",
        maps: {collection: "erm"},
        mapTiles: {collection: "erm", tileMatrixSet: "euro_3857"},
    },
    {
        id: "pygeoapi",
        title: "pygeoapi demo",
        url: "https://demo.pygeoapi.io/master/",
        features: {collection: "lakes"},
        maps: {collection: "mapserver_world_map"},
        vectorTiles: {collection: "lakes", tileMatrixSet: "WebMercatorQuad"},
    },
    {
        id: "pdok-bgt",
        title: "PDOK BGT",
        url: "https://api.pdok.nl/lv/bgt/ogc/v1/",
        features: {collection: "bord"},
    },
    {
        id: "gnosis",
        title: "GNOSIS Map Server",
        url: "https://maps.gnosis.earth/ogcapi/",
        vectorTiles: {collection: "osm:dc", tileMatrixSet: "WebMercatorQuad", style: "osmDefault"},
        notRecorded: "its /collections response is 9 MB, and tile requests need a login",
    },
];

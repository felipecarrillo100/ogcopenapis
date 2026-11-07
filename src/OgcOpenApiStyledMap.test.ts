import {afterEach, describe, expect, it, vi} from 'vitest';
import {OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiStyleTools} from "./OgcOpenApiStyleTools";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";
import GeoServerBluemarble from "./fixtures/collection-geoserver-bluemarble-maps.json";
import GeoServerBluemarbleStyles from "./fixtures/styles-geoserver-bluemarble.json";

// A collection that offers its map only per style (OGC API Maps, Styled Map class), as GeoServer 2.28.6 does, reported
// by a user of 1.2.2

// The conformance classes GeoServer 2.28.6 OGC API Maps declares
const GEOSERVER_MAPS_CONFORMANCE = [
    "http://www.opengis.net/spec/ogcapi-common-1/1.0/conf/core",
    "http://www.opengis.net/spec/ogcapi-common-2/1.0/conf/collections",
    "http://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/core",
    "http://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/geodata",
    "http://www.opengis.net/spec/ogcapi-maps-2/1.0/conf/bbox",
    "http://www.opengis.net/spec/ogcapi-maps-2/1.0/conf/crs",
];

const capabilitiesOf = (conformsTo: string[]) => ({
    name: "", collections: [], version: "", service: "", info: {}, baseUrl: "http://localhost:8094/geoserver/ogc/maps/v1/",
    conformsTo,
    serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: "http://localhost:8094/geoserver/ogc/maps/v1/"}),
});

const collectionOf = (links: object[]) => ({
    id: "c", name: "c", title: "c", defaultReference: "CRS:84", outputFormats: [], description: "", keywords: [], extent: {},
    links: links as any,
});

const bluemarble = () => collectionOf(GeoServerBluemarble.links);

describe('OgcOpenApiGetCapabilities.mayOfferStyledMap', () => {

    it('True for a GeoServer 2.28.6 Maps collection: styles, no map link, Maps conformance with http', () => {
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(capabilitiesOf(GEOSERVER_MAPS_CONFORMANCE), bluemarble())).toBe(true);
    });

    it('Accepts Maps conformance with https, as OGC 20-058 Table 1 writes it', () => {
        const capabilities = capabilitiesOf(["https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/core"]);
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(capabilities, bluemarble())).toBe(true);
    });

    it('False for a collection with a map link: its map is the one of that link (GNOSIS, CubeWerx)', () => {
        const collection = collectionOf([
            {rel: "http://www.opengis.net/def/rel/ogc/1.0/map", type: "image/png", href: "https://x.test/collections/c/map"},
            {rel: "styles", type: "application/json", href: "https://x.test/collections/c/styles"},
        ]);
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(capabilitiesOf(GEOSERVER_MAPS_CONFORMANCE), collection)).toBe(false);
    });

    it('False without a styles link', () => {
        const collection = collectionOf([{rel: "self", type: "application/json", href: "https://x.test/collections/c"}]);
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(capabilitiesOf(GEOSERVER_MAPS_CONFORMANCE), collection)).toBe(false);
    });

    it('False when the server declares no OGC API Maps Part 1 class: styles for vector tiles are not maps', () => {
        const capabilities = capabilitiesOf([
            "http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/core",
            "http://www.opengis.net/spec/ogcapi-maps-2/1.0/conf/bbox",
        ]);
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(capabilities, bluemarble())).toBe(false);
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(null, bluemarble())).toBe(false);
    });
});

describe('OgcOpenApiStyleTools.fetchMapStyles', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const serve = (body: any, status = 200) =>
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), {status}));

    it('Lists the styles of a GeoServer 2.28.6 collection with their map links, from its styles link', async () => {
        const fetchSpy = serve(GeoServerBluemarbleStyles);
        const styles = await OgcOpenApiStyleTools.fetchMapStyles(capabilitiesOf(GEOSERVER_MAPS_CONFORMANCE), bluemarble());
        expect(String(fetchSpy.mock.calls[0][0])).toBe("http://localhost:8094/geoserver/ogc/maps/v1/collections/basicauth:bluemarble/styles?f=application%2Fjson");
        expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get("Accept")).toBe("application/json");
        expect(styles.map(s => [s.id, s.title])).toEqual([["raster", "Opaque Raster"]]);
        const png = styles[0].mapLinks.find(l => l.type === "image/png");
        expect(png?.href).toBe("http://localhost:8094/geoserver/ogc/maps/v1/collections/basicauth%3Abluemarble/styles/raster/map?f=image%2Fpng");
        expect(styles[0].mapLinks.length).toBe(GeoServerBluemarbleStyles.styles[0].links.filter(l => l.rel === "map").length);
    });

    it('Puts the default style first, leaves out styles without a map, and resolves relative links', async () => {
        serve({
            default: "night",
            styles: [
                {id: "day", links: [{rel: "map", type: "image/png", href: "day/map?f=png"}]},
                {id: "mapbox", links: [{rel: "stylesheet", type: "application/vnd.mapbox.style+json", href: "mapbox?f=mbs"}]},
                {id: "night", title: "Night", links: [{rel: "http://www.opengis.net/def/rel/ogc/1.0/map", type: "image/png", href: "night/map?f=png"}]},
            ],
        });
        const collection = collectionOf([{rel: "styles", type: "application/json", href: "https://x.test/collections/c/styles/"}]);
        const styles = await OgcOpenApiStyleTools.fetchMapStyles(capabilitiesOf([]), collection);
        expect(styles.map(s => [s.id, s.title])).toEqual([["night", "Night"], ["day", "day"]]);
        expect(styles[1].mapLinks[0].href).toBe("https://x.test/collections/c/styles/day/map?f=png");
    });

    it('Resolves an empty list for a collection without styles (404)', async () => {
        serve("", 404);
        expect(await OgcOpenApiStyleTools.fetchMapStyles(capabilitiesOf([]), bluemarble())).toEqual([]);
    });

    it('Rejects with an Error when the styles answer 500, or are not JSON', async () => {
        serve("", 500);
        await expect(OgcOpenApiStyleTools.fetchMapStyles(capabilitiesOf([]), bluemarble())).rejects.toThrow("Invalid response: 500");
        vi.restoreAllMocks();
        serve("<html></html>");
        await expect(OgcOpenApiStyleTools.fetchMapStyles(capabilitiesOf([]), bluemarble())).rejects.toThrow("Not JSON data");
    });

    it('Rejects with the error of fetch as it is when the request fails', async () => {
        const error = new TypeError("Failed to fetch");
        vi.spyOn(globalThis, "fetch").mockRejectedValue(error);
        await expect(OgcOpenApiStyleTools.fetchMapStyles(capabilitiesOf([]), bluemarble())).rejects.toBe(error);
    });
});

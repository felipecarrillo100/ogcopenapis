import {describe, expect, it} from 'vitest';
import {CollectionLinkType, isSameOgcUri, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";
import GeoServer3Countries from "./fixtures/collection-geoserver3-countries-maps.json";
import GeoServer3MapsConformance from "./fixtures/conformance-geoserver3-maps.json";

// OGC URIs are written with http by some OGC standards (OGC API Tiles 20-057, Features) and with https by others
// (OGC API Maps 20-058), and servers follow either: both schemes are accepted for conformance classes, link relations and
// profiles. GeoServer 3.0.2 links the map of a collection with https://www.opengis.net/def/rel/ogc/1.0/map

const base = "https://geoserver.example.com/geoserver/ogc/maps/v1/";

const capabilitiesOf = (conformsTo: string[]) => ({
    name: "", collections: [], version: "", service: "", info: {}, baseUrl: base, conformsTo,
    serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: base}),
});

const collectionOf = (links: object[]) => ({
    id: "c", name: "c", title: "c", defaultReference: "CRS:84", outputFormats: [], description: "", keywords: [], extent: {},
    links: links as any,
});

describe('isSameOgcUri', () => {

    it('Takes the http and https forms of an OGC URI as the same', () => {
        expect(isSameOgcUri("https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/core", "http://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/core")).toBe(true);
        expect(isSameOgcUri("http://www.opengis.net/def/rel/ogc/1.0/map", "https://www.opengis.net/def/rel/ogc/1.0/map")).toBe(true);
    });

    it('Ignores the case of the scheme and the host, not of the path', () => {
        expect(isSameOgcUri("HTTPS://WWW.OPENGIS.NET/def/rel/ogc/1.0/map", "http://www.opengis.net/def/rel/ogc/1.0/map")).toBe(true);
        expect(isSameOgcUri("http://www.opengis.net/def/rel/ogc/1.0/Map", "http://www.opengis.net/def/rel/ogc/1.0/map")).toBe(false);
    });

    it('Takes nothing else as the same: other hosts, the /0 version alias, CURIEs', () => {
        expect(isSameOgcUri("https://example.com/def/rel/ogc/1.0/map", "http://example.com/def/rel/ogc/1.0/map")).toBe(false);
        expect(isSameOgcUri("http://www.opengis.net/spec/ogcapi-maps-1/0/conf/core", "http://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/core")).toBe(false);
        expect(isSameOgcUri("[ogcapi-maps-1:core]", "http://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/core")).toBe(false);
        expect(isSameOgcUri(undefined, "http://www.opengis.net/def/rel/ogc/1.0/map")).toBe(false);
    });
});

describe('Link relations in https', () => {

    it('Finds the map links of a GeoServer 3.0.2 collection, with relation https://www.opengis.net/def/rel/ogc/1.0/map', () => {
        const maps = OgcOpenApiGetCapabilities.filterCollectionLinks(GeoServer3Countries.links, CollectionLinkType.Map);
        expect(maps.length).toBe(GeoServer3Countries.links.filter(l => l.rel === "https://www.opengis.net/def/rel/ogc/1.0/map").length);
        expect(maps.map(l => l.type)).toContain("image/png");
    });

    it('So a GeoServer 3.0.2 collection has a map of its own, not only per style', () => {
        const capabilities = capabilitiesOf(GeoServer3MapsConformance.conformsTo);
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(capabilities, collectionOf(GeoServer3Countries.links))).toBe(false);
    });

    it('Finds styles, tiles and vector tiles links in https', () => {
        const links = [
            {rel: "https://www.opengis.net/def/rel/ogc/1.0/styles", type: "application/json", href: base + "styles"},
            {rel: "https://www.opengis.net/def/rel/ogc/1.0/tilesets-map", type: "application/json", href: base + "map/tiles"},
            {rel: "https://www.opengis.net/def/rel/ogc/1.0/tilesets-vector", type: "application/json", href: base + "tiles"},
        ];
        expect(OgcOpenApiGetCapabilities.filterCollectionLinks(links, CollectionLinkType.Styles).length).toBe(1);
        expect(OgcOpenApiGetCapabilities.filterCollectionLinks(links, CollectionLinkType.Tiles).length).toBe(1);
        expect(OgcOpenApiGetCapabilities.filterCollectionLinks(links, CollectionLinkType.VectorTiles).length).toBe(1);
    });
});

describe('Conformance classes in https', () => {

    it('Reads the Maps conformance of GeoServer 3.0.2, in https as OGC 20-058 writes it', () => {
        const capabilities = capabilitiesOf(GeoServer3MapsConformance.conformsTo);
        const stylesOnly = collectionOf(GeoServer3Countries.links.filter(l => l.rel.indexOf("/map") === -1));
        expect(OgcOpenApiGetCapabilities.mayOfferStyledMap(capabilities, stylesOnly)).toBe(true);
    });

    it('Collections selection of OGC API Tiles in https', () => {
        const capabilities = capabilitiesOf(["https://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collections-selection"]);
        expect(OgcOpenApiGetCapabilities.supportsCollectionSelection(capabilities)).toBe(true);
    });

    it('Features filter and CQL2 classes in https, mixed with http', () => {
        const support = OgcOpenApiGetCapabilities.getFilterSupport(capabilitiesOf([
            "https://www.opengis.net/spec/ogcapi-features-3/1.0/conf/features-filter",
            "https://www.opengis.net/spec/cql2/1.0/conf/cql2-text",
            "http://www.opengis.net/spec/cql2/1.0/conf/basic-cql2",
        ]));
        expect(support).toEqual({filter: true, encodings: ["cql2-text"], levels: ["basic-cql2"]});
    });

    it('The JSON-FG profile in https', () => {
        expect(OgcOpenApiGetCapabilities.isJsonFgLink({
            rel: "items", type: "application/geo+json", href: base + "items", profile: "https://www.opengis.net/def/profile/OGC/0/jsonfg",
        } as any)).toBe(true);
    });
});

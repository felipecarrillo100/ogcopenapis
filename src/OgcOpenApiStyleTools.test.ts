import {describe, expect, it} from '@jest/globals';
import "isomorphic-fetch";

import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiStyleTools} from "./OgcOpenApiStyleTools";

const DARAA = "https://demo.ldproxy.net/daraa/";
const GNOSIS = "https://maps.gnosis.earth/ogcapi/";

describe('OgcOpenApiStyleTools.parseMapboxStyle', () => {

    it('Parses valid JSON as is', () => {
        expect(OgcOpenApiStyleTools.parseMapboxStyle('{"version": 8, "layers": []}')).toEqual({version: 8, layers: []});
    });

    it('Removes properties without a value', () => {
        const text = '{ "version" : 8, "layers" : [ { "filter" : , "id" : "a", "type" : "fill", "paint" : { } }, ' +
            '{ "id" : "b", "filter" : , "type" : "line" }, { "id" : "c", "filter" : } ] }';
        expect(OgcOpenApiStyleTools.parseMapboxStyle(text)).toEqual({
            version: 8,
            layers: [{id: "a", type: "fill", paint: {}}, {id: "b", type: "line"}, {id: "c"}]
        });
    });
});

describe('OgcOpenApiStyleTools.createDefaultStyle', () => {

    it('Paints each layer by geometryDimension', () => {
        const style = OgcOpenApiStyleTools.createDefaultStyle([
            {id: "points", geometryDimension: 0},
            {id: "lines", geometryDimension: 1},
            {id: "surfaces", geometryDimension: 2},
        ]);
        expect(style.version).toBe(8);
        expect(style.layers.map(l => [l.id, l.type, l["source-layer"]])).toEqual([
            ["points_point", "symbol", "points"],
            ["lines_line", "line", "lines"],
            ["surfaces_fill", "fill", "surfaces"],
            ["surfaces_line", "line", "surfaces"],
        ]);
    });

    it('Filters by geometry type when geometryDimension is unknown', () => {
        const style = OgcOpenApiStyleTools.createDefaultStyle([{id: "roads"}]);
        expect(style.layers.map(l => l.type)).toEqual(["fill", "line", "symbol"]);
        expect(style.layers.every(l => Array.isArray(l.filter))).toBe(true);
    });
});

describe('OgcOpenApiStyleTools with OGC API Styles', () => {

    it('daraa styles, one stylesheet per tile matrix set', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(DARAA, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        const collection = capabilities.collections.find(c => c.id === "AgricultureSrf");
        const styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, collection);
        expect(styles.length).toBeGreaterThan(0);
        const stylesheet = OgcOpenApiStyleTools.pickStylesheet(styles[0], "WebMercatorQuad");
        const style = await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, stylesheet);
        expect(style.version).toBe(8);
        expect(style.layers.some(l => l["source-layer"] === "AgricultureSrf")).toBe(true);
    });

    it('gnosis osm:dc osmDefault is repaired', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(GNOSIS, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        const collection = capabilities.collections.find(c => c.id === "osm:dc");
        const styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, collection);
        const osmDefault = styles.find(s => s.id === "osmDefault");
        const style = await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, OgcOpenApiStyleTools.pickStylesheet(osmDefault, "WebMercatorQuad"));
        expect(style.layers.length).toBeGreaterThan(10);
        expect(style.layers.some(l => l["source-layer"] === "roads")).toBe(true);
    });
});

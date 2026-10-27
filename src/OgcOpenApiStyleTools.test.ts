import {afterEach, describe, expect, it, vi} from 'vitest';

import {OgcOpenApiStyleTools} from "./OgcOpenApiStyleTools";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";

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

describe('OgcOpenApiStyleTools.getStylesForTileMatrixSet', () => {

    const style = (id: string, title = id) => ({id, title, mapboxStylesheets: []});
    const TILE_MATRIX_SETS = ["NetherlandsRDNewQuad", "EuropeanETRS89_LAEAQuad", "WebMercatorQuad"];

    it('Leaves out styles named after another tile matrix set (PDOK)', () => {
        const styles = [
            style("bgt_standaardvisualisatie__netherlandsrdnewquad", "BGT Standaardvisualisatie (NetherlandsRDNewQuad)"),
            style("bgt_standaardvisualisatie__webmercatorquad", "BGT Standaardvisualisatie (WebMercatorQuad)"),
            style("bgt_standaardvisualisatie__europeanetrs89_laeaquad"),
        ];
        expect(OgcOpenApiStyleTools.getStylesForTileMatrixSet(styles, "WebMercatorQuad", TILE_MATRIX_SETS).map(s => s.id))
            .toEqual(["bgt_standaardvisualisatie__webmercatorquad"]);
    });

    it('Keeps styles that are not named after a tile matrix set (ldproxy)', () => {
        const styles = [style("topographic"), style("night")];
        expect(OgcOpenApiStyleTools.getStylesForTileMatrixSet(styles, "WorldMercatorWGS84Quad", ["WebMercatorQuad", "WorldMercatorWGS84Quad"]))
            .toEqual(styles);
    });
});

describe('OgcOpenApiStyleTools.fetchStyles of the dataset', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Follows the styles link of the landing page', async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({styles: [
            {id: "topographic", links: [{rel: "stylesheet", type: "application/vnd.mapbox.style+json", href: "https://example.com/styles/topographic?f=mbs"}]},
        ]}), {status: 200})));
        const capabilities = {
            name: "", collections: [], version: "", service: "", info: {}, baseUrl: "https://example.com/",
            links: [{rel: "http://www.opengis.net/def/rel/ogc/1.0/styles", type: "application/json", title: "", href: "https://example.com/api/styles"}],
            serverOptions: OgcOpenApiFetchTools.createFetchOptions({originalUrl: "https://example.com/"}),
        };
        const styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, null);
        expect(String(fetchSpy.mock.calls[0][0])).toBe("https://example.com/api/styles?f=json");
        expect(styles.map(s => s.id)).toEqual(["topographic"]);
    });
});

import {describe, expect, it} from 'vitest';

import {OgcOpenApiStyleTools} from "./OgcOpenApiStyleTools";

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

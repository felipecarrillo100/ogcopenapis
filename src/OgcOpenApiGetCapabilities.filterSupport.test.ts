import {describe, expect, it} from 'vitest';
import {type OgcOpenApiCapabilitiesObject, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";

// The filter related conformance classes the test servers declared on 29 October 2026, with one class of another part
const CQL2 = "http://www.opengis.net/spec/cql2/1.0/conf/";
const FEATURES_3 = "http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/";
const CORE = "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core";

const LDPROXY = [CORE, ...["advanced-comparison-operators", "array-functions", "basic-cql2", "basic-spatial-functions",
    "basic-spatial-functions-plus", "case-insensitive-comparison", "cql2-json", "cql2-text", "functions",
    "property-property", "spatial-functions", "temporal-functions"].map(c => CQL2 + c),
    ...["features-filter", "filter", "queryables", "queryables-query-parameters"].map(c => FEATURES_3 + c)];
const PDOK = [CORE, ...["accent-insensitive-comparison", "advanced-comparison-operators", "basic-cql2",
    "basic-spatial-functions", "basic-spatial-functions-plus", "case-insensitive-comparison", "cql2-text",
    "spatial-functions", "temporal-functions"].map(c => CQL2 + c),
    ...["features-filter", "filter", "queryables", "queryables-query-parameters"].map(c => FEATURES_3 + c)];
const PYGEOAPI = [CORE, CQL2 + "basic-cql2", CQL2 + "cql2-text", FEATURES_3 + "queryables", FEATURES_3 + "queryables-query-parameters"];
const CUBEWERX = [CORE, ...["cql-text", "features-filter", "filter", "simple-cql"].map(c => FEATURES_3 + c)];

const withConformance = (conformsTo?: string[]) => ({conformsTo} as OgcOpenApiCapabilitiesObject);

describe('OgcOpenApiGetCapabilities.getFilterSupport', () => {

    it('ldproxy: filters, in both encodings', () => {
        expect(OgcOpenApiGetCapabilities.getFilterSupport(withConformance(LDPROXY))).toEqual({
            filter: true,
            encodings: ["cql2-json", "cql2-text"],
            levels: ["advanced-comparison-operators", "array-functions", "basic-cql2", "basic-spatial-functions",
                "basic-spatial-functions-plus", "case-insensitive-comparison", "functions", "property-property",
                "spatial-functions", "temporal-functions"],
        });
    });

    it('PDOK: filters, in CQL2 text', () => {
        const support = OgcOpenApiGetCapabilities.getFilterSupport(withConformance(PDOK));
        expect(support.filter).toBe(true);
        expect(support.encodings).toEqual(["cql2-text"]);
        expect(support.levels).toContain("accent-insensitive-comparison");
        expect(support.levels).not.toContain("cql2-text");
    });

    it('pygeoapi: a CQL2 encoding without the Features Filter class, reported as declared', () => {
        expect(OgcOpenApiGetCapabilities.getFilterSupport(withConformance(PYGEOAPI))).toEqual({
            filter: false,
            encodings: ["cql2-text"],
            levels: ["basic-cql2"],
        });
    });

    it('CubeWerx: the Features Filter class with pre-standard CQL only, no CQL2', () => {
        expect(OgcOpenApiGetCapabilities.getFilterSupport(withConformance(CUBEWERX))).toEqual({
            filter: true,
            encodings: [],
            levels: [],
        });
    });

    it('Nothing declared, no conformance classes, no capabilities', () => {
        const none = {filter: false, encodings: [], levels: []};
        expect(OgcOpenApiGetCapabilities.getFilterSupport(withConformance([CORE]))).toEqual(none);
        expect(OgcOpenApiGetCapabilities.getFilterSupport(withConformance(undefined))).toEqual(none);
        expect(OgcOpenApiGetCapabilities.getFilterSupport(null)).toEqual(none);
    });
});

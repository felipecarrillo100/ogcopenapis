import {describe, expect, test} from '@jest/globals';
import {OgcOpenApiCrsTools} from './OgcOpenApiCrsTools';

describe('OAPICrsTools module getReferenceName', () => {
    test("URL 'http://www.opengis.net/def/crs/EPSG/0/4326' must return EPSG:4326", () => {
        expect(OgcOpenApiCrsTools.getReferenceName("http://www.opengis.net/def/crs/EPSG/0/4326")).toEqual("EPSG:4326");
    });
});
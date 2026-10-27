import {describe, expect, it} from 'vitest';
import {OgcOpenApiMapsModel} from "./OgcOpenApiMapsModel";

const MAP_URL = "https://example.com/collections/c/map";
const WEB_MERCATOR = "http://www.opengis.net/def/crs/EPSG/0/3857";
const HALF_WORLD = 20037508.3427892;

function getQuery(url: string) {
    return new URLSearchParams(url.split("?")[1]);
}

function getBBox(url: string) {
    return getQuery(url).get("bbox").split(",").map(Number);
}

describe('OgcOpenApiMapsModel', () => {

    it('Tiles the Web Mercator world, not the larger bounds of the EPSG:3857 reference', () => {
        const model = new OgcOpenApiMapsModel({crs: WEB_MERCATOR, baseURL: MAP_URL, collection: "c"});
        for (const tile of [{level: 0, x: 0, y: 0}, {level: 1, x: 0, y: 0}, {level: 1, x: 1, y: 1}, {level: 3, x: 7, y: 7}]) {
            const [minX, minY, maxX, maxY] = getBBox(model.getTileURL(model.getMapRoot, tile));
            expect(minX).toBeGreaterThanOrEqual(-HALF_WORLD - 1e-6);
            expect(minY).toBeGreaterThanOrEqual(-HALF_WORLD - 1e-6);
            expect(maxX).toBeLessThanOrEqual(HALF_WORLD + 1e-6);
            expect(maxY).toBeLessThanOrEqual(HALF_WORLD + 1e-6);
        }
    });

    it('Requests the bbox and crs of the map', () => {
        const model = new OgcOpenApiMapsModel({crs: WEB_MERCATOR, baseURL: MAP_URL, collection: "c", format: "image/png"});
        const url = model.getTileURL(model.getMapRoot, {level: 0, x: 0, y: 0});
        const query = getQuery(url);
        expect(url.split("?")[0]).toBe(MAP_URL);
        expect(query.get("crs")).toBe(WEB_MERCATOR);
        expect(query.get("bbox-crs")).toBe(WEB_MERCATOR);
        expect(query.get("f")).toBe("image/png");
        expect(query.get("transparent")).toBe("true");
    });

    it('Keeps the query of the map link, such as the f value the server advertises', () => {
        const model = new OgcOpenApiMapsModel({crs: WEB_MERCATOR, baseURL: MAP_URL + "?f=png", collection: "c"});
        const query = getQuery(model.getTileURL(model.getMapRoot, {level: 0, x: 0, y: 0}));
        expect(query.get("f")).toBe("png");
        expect(query.getAll("f").length).toBe(1);
    });

    it('Overrides the f of the map link with format', () => {
        const model = new OgcOpenApiMapsModel({crs: WEB_MERCATOR, baseURL: MAP_URL + "?f=png", collection: "c", format: "jpeg"});
        expect(getQuery(model.getTileURL(model.getMapRoot, {level: 0, x: 0, y: 0})).get("f")).toBe("jpeg");
    });

    it('Encodes the bgcolor', () => {
        const model = new OgcOpenApiMapsModel({crs: WEB_MERCATOR, baseURL: MAP_URL, collection: "c", transparent: false, bgcolor: "#FFFFFF"});
        const url = model.getTileURL(model.getMapRoot, {level: 0, x: 0, y: 0});
        expect(url).toContain("bgcolor=%23FFFFFF");
        expect(getQuery(url).get("bgcolor")).toBe("#FFFFFF");
    });

    it('Joins the subsets', () => {
        const model = new OgcOpenApiMapsModel({crs: WEB_MERCATOR, baseURL: MAP_URL, collection: "c", subset: ["time(\"2020\")", "elevation(0)"]});
        const url = model.getTileURL(model.getMapRoot, {level: 0, x: 0, y: 0});
        expect(getQuery(url).get("subset")).toBe("time(\"2020\"),elevation(0)");
    });
});

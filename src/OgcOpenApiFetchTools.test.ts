import {describe, expect, it} from 'vitest';
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";


describe('OgcOpenApiFetchTools',  () => {

    it('Test Create fetch options',  () => {

        const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/"});
        expect(serverOptions.hostname).toBe("https://test.cubewerx.com")
    });

    it('Test url completion', async () => {
        const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/"});
        expect(serverOptions.complete("/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/")).toBe("https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/");

    });

    it('OgcOpenApiFetchTools.getHostURL relative url', async () => {
        expect(OgcOpenApiFetchTools.getHostURL("../api/user/proxy/auto_1674068062840")).toEqual("")
    });

    it('OgcOpenApiFetchTools.getHostURL full url', async () => {
        expect(OgcOpenApiFetchTools.getHostURL("https://demo.pygeoapi.io/master2/")).toEqual("https://demo.pygeoapi.io")
    });

    it('OgcOpenApiFetchTools.getHostURL localhost', async () => {
        expect(OgcOpenApiFetchTools.getHostURL("http://localhost:8080/api/user/proxy/auto_1674072985294_1")).toEqual("http://localhost:8080")
    });

    it('OgcOpenApiGetCapabilities.cleanUrl with api/?f=json', async () => {
        expect(OgcOpenApiFetchTools.cleanUrl("http://localhost:8080/api/?f=json")).toEqual("http://localhost:8080/api/")
    });
    it('OgcOpenApiGetCapabilities.cleanUrl with api?f=json', async () => {
        expect(OgcOpenApiFetchTools.cleanUrl("http://localhost:8080/api?f=json")).toEqual("http://localhost:8080/api/")
    });
    it('OgcOpenApiGetCapabilities.cleanUrl with api/', async () => {
        expect(OgcOpenApiFetchTools.cleanUrl("http://localhost:8080/api/")).toEqual("http://localhost:8080/api/")
    });
    it('OgcOpenApiGetCapabilities.cleanUrl with /api', async () => {
        expect(OgcOpenApiFetchTools.cleanUrl("http://localhost:8080/api")).toEqual("http://localhost:8080/api/")
    });
    it('OgcOpenApiGetCapabilities.cleanUrl with some/api/?f=json', async () => {
        expect(OgcOpenApiFetchTools.cleanUrl("http://localhost:8080/some/api/?f=json")).toEqual("http://localhost:8080/some/api/")
    });

    describe('resolveUrl, relative to the document of the link', () => {
        const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: "https://example.com/ogcapi/"});
        const document = "https://example.com/ogcapi/collections/lakes/tiles?f=json";
        const resolve = (href: string, documentUrl = document) => OgcOpenApiFetchTools.resolveUrl(href, documentUrl, serverOptions);

        it('Paths relative to the document', () => {
            expect(resolve("./WebMercatorQuad")).toBe("https://example.com/ogcapi/collections/lakes/WebMercatorQuad");
            expect(resolve("tiles/WebMercatorQuad")).toBe("https://example.com/ogcapi/collections/lakes/tiles/WebMercatorQuad");
            expect(resolve("../../tileMatrixSets/WebMercatorQuad")).toBe("https://example.com/ogcapi/tileMatrixSets/WebMercatorQuad");
            expect(resolve("WebMercatorQuad?f=json", "https://example.com/ogcapi/collections/lakes/tiles/")).toBe("https://example.com/ogcapi/collections/lakes/tiles/WebMercatorQuad?f=json");
        });

        it('Paths relative to the host, and to the scheme', () => {
            expect(resolve("/ogcapi/tileMatrixSets/WebMercatorQuad")).toBe("https://example.com/ogcapi/tileMatrixSets/WebMercatorQuad");
            expect(resolve("//tiles.example.com/a")).toBe("https://tiles.example.com/a");
        });

        it('Keeps the braces of tile URL templates', () => {
            expect(resolve("lakes/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt"))
                .toBe("https://example.com/ogcapi/collections/lakes/lakes/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt");
        });

        it('Keeps absolute links as they are', () => {
            const template = "https://other.example.com/tiles/{tileMatrix}/{tileRow}/{tileCol}?f=a b";
            expect(resolve(template)).toBe(template);
        });

        it('Completes with the host of the server when the document URL is not absolute, as behind a relative proxy path', () => {
            expect(resolve("/ogcapi/collections", "../api/proxy/collections")).toBe("https://example.com/ogcapi/collections");
        });
    });
})

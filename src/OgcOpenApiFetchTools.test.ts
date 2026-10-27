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
})

import {describe, expect, it} from '@jest/globals';
import "isomorphic-fetch";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";


describe('OgcOpenApiGetCapabilities',  () => {

    it('Test Create fetch options',  () => {

        const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/"});
        expect(serverOptions.hostname).toBe("https://test.cubewerx.com")
    });

    it('Test url completion', async () => {
        const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/"});
        expect(serverOptions.complete("/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/")).toBe("https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/");

    });
    it('Test fetch execution', async () => {

        const serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/"});

        return new Promise((resolve)=>{
            OgcOpenApiFetchTools.fetch("/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/", {}, serverOptions).then(respose => {
                if (respose.ok) {
                    respose.json().then((data)=>{
                        expect(data.title).toBe("EuroRegionalMap");
                        resolve(true)
                    })
                } else {
                    expect(false).toBe(true);
                    resolve(true)
                }
            }, (err) => {
                expect(false).toBe(true);
                resolve(true)
            })
        })
    });

})

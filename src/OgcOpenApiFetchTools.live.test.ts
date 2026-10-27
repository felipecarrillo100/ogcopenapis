import {describe, expect, it} from 'vitest';
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";

describe('OgcOpenApiFetchTools live',  () => {

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

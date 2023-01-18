import {describe, expect, it} from '@jest/globals';
import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";

class Test extends OgcOpenApiGetCapabilities {
    static testAll() {
        describe('OgcOpenApiGetCapabilities',  () => {
            it('OgcOpenApiGetCapabilities.fromURL success', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{}).then(data=>{
                    console.log(JSON.stringify(data.featureTypes.length,null,2))
                    expect(data.version).toBe("3.0.2");
                }, (err)=>{
                    expect(2).toBe(3);
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL success', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{}).then(data=>{
                    console.log(data.featureTypes.length)
                }, (err)=>{
                    expect(2).toBe(3);
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL success', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/",{filterCollectionsByLinkType: CollectionLinkType.Items}).then(data=>{
                    console.log(data.featureTypes.length)
                }, (err)=>{
                    expect(2).toBe(3);
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL 404', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master2/",{}).then(data=>{
                    expect(data.version).toBe("3.0.1");
                }, (err)=>{
                    expect(404).toBe(404);
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL Not JSON', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/",{}).then(data=>{
                    expect(data.version).toBe("3.0.1");
                }, (err)=>{
                    expect(err).toBe("Not JSON");
                })
            });
            it('OgcOpenApiGetCapabilities.fromURL Not valid API', async () => {
                return OgcOpenApiGetCapabilities.fromURL("https://jsonplaceholder.typicode.com/todos/",{}).then(data=>{
                    expect(data.version).toBe("3.0.1");
                }, (err)=>{
                    expect(err).toBe("Invalid format: (property 'links' is missing)");
                })
            });

            it('OgcOpenApiGetCapabilities.getHostURL relative url', async () => {
                expect(OgcOpenApiGetCapabilities.getHostURL("../api/user/proxy/auto_1674068062840")).toEqual("")
            });

            it('OgcOpenApiGetCapabilities.getHostURL full url', async () => {
                expect(OgcOpenApiGetCapabilities.getHostURL("https://demo.pygeoapi.io/master2/")).toEqual("https://demo.pygeoapi.io")
            });

            it('OgcOpenApiGetCapabilities.getHostURL localhost', async () => {
                expect(OgcOpenApiGetCapabilities.getHostURL("http://localhost:8080/api/user/proxy/auto_1674072985294_1")).toEqual("http://localhost:8080")
            });
        });
    }
}

Test.testAll();


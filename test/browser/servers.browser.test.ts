import {afterEach, describe, expect, it} from "vitest";
import {mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {TEST_SERVERS, TestServer} from "../servers";
import {DemoPage, DemoType, openDemo} from "./demoPage";

/**
 * Adds a layer of each kind of data of each test server in the demo, and checks that the map paints it.
 * Screenshots of the last test are in test/browser/screenshots.
 */
const SCREENSHOTS = fileURLToPath(new URL("./screenshots/", import.meta.url));
// A layer must paint at least this many pixels once the basemap is hidden, an empty map paints none.
// Low because some collections are a few small points
const MIN_PAINTED = 20;
const GENERATED_STYLE = "__generated__";

interface Case {
    server: TestServer;
    type: DemoType;
    collection: string;
    tileMatrixSet?: string;
    style?: string;
    knownIssue?: string;
}

function getCases(server: TestServer): Case[] {
    const cases: Case[] = [];
    if (server.features) cases.push({server, type: "items", collection: server.features.collection});
    if (server.maps) cases.push({server, type: "map", collection: server.maps.collection});
    if (server.mapTiles) cases.push({server, type: "tiles", ...server.mapTiles});
    if (server.vectorTiles) {
        const {collection, tileMatrixSet, style, knownIssue} = server.vectorTiles;
        cases.push({server, type: "vectorTiles", collection, tileMatrixSet, style: style ? style : GENERATED_STYLE, knownIssue});
    }
    return cases;
}

mkdirSync(SCREENSHOTS, {recursive: true});

describe("Test servers in the demo", () => {
    let demo: DemoPage | null = null;

    afterEach(async () => {
        await demo?.close();
        demo = null;
    });

    for (const server of TEST_SERVERS.filter(s => !s.notRecorded)) {
        for (const c of getCases(server)) {
            // A known issue is expected to fail, the test fails once it is fixed, as a reminder to remove it
            const test = c.knownIssue ? it.fails : it;
            const name = `${server.title}: ${c.type} ${c.collection}` + (c.knownIssue ? ` (known issue: ${c.knownIssue})` : "");
            test(name, async () => {
                demo = await openDemo(new URL(server.url).host);
                await demo.load();
                await demo.connect(server.url, c.type);
                expect(await demo.status()).toMatch(/collections/);
                await demo.addLayer(c.collection, {tileMatrixSet: c.tileMatrixSet, style: c.style});
                expect(await demo.status()).toMatch(/^Added/);
                await demo.waitForData();
                await demo.hideBasemap();
                const painted = await demo.countPaintedPixels();
                await demo.screenshot(SCREENSHOTS + `${server.id}-${c.type}.png`);

                expect(demo.pageErrors, "page errors").toEqual([]);
                expect(demo.failedResponses, "failed responses of " + server.url).toEqual([]);
                expect(painted, "pixels painted by the layer").toBeGreaterThanOrEqual(MIN_PAINTED);
            });
        }
    }
});

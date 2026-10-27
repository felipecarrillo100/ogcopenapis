import {describe, expect, it} from "vitest";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {TEST_SERVERS} from "./servers";
import {startRecording} from "./recorder";
import {runScenario} from "./scenario";

// Calls each server and compares the outcome with the recording, so it also reports servers that changed.
// With RECORD=1 (npm run test:record) it records the responses and the outcome instead.
const FIXTURES = join(__dirname, "fixtures", "servers");
const RECORD = process.env.RECORD === "1";
// The scenario connects once per kind of data, and CubeWerx takes about 6 s to list its collections
const TIMEOUT = 60000;

describe("Test servers, live", () => {
    for (const server of TEST_SERVERS.filter(s => !s.notRecorded)) {
        const dir = join(FIXTURES, server.id);
        it(server.title, async () => {
            if (RECORD) {
                const recording = startRecording(dir);
                try {
                    const summary = JSON.parse(JSON.stringify(await runScenario(server)));
                    writeFileSync(join(dir, "expected.json"), JSON.stringify(summary, null, 2) + "\n");
                } finally {
                    recording.stop();
                }
                return;
            }
            const summary = JSON.parse(JSON.stringify(await runScenario(server)));
            const expectedFile = join(dir, "expected.json");
            if (existsSync(expectedFile)) {
                expect(summary, server.url + " answers differently than when it was recorded").toEqual(JSON.parse(readFileSync(expectedFile, "utf8")));
            }
        }, TIMEOUT);
    }
});

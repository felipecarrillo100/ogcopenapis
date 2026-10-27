import {describe, expect, it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {TEST_SERVERS} from "./servers";
import {hasRecording, startReplay} from "./recorder";
import {runScenario} from "./scenario";

// Replays the recorded responses of each server: offline, and the outcome must be the recorded one
const FIXTURES = join(__dirname, "fixtures", "servers");

describe("Test servers, recorded", () => {
    for (const server of TEST_SERVERS.filter(s => !s.notRecorded)) {
        const dir = join(FIXTURES, server.id);
        it.skipIf(!hasRecording(dir))(server.title, async () => {
            const replay = startReplay(dir);
            try {
                const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));
                expect(JSON.parse(JSON.stringify(await runScenario(server)))).toEqual(expected);
            } finally {
                replay.stop();
            }
        });
    }
});

import {describe, expect, it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {RECORDED_WRITE_SERVERS} from "./servers/write/servers";
import {hasRecording, startReplay} from "./recorder";
import {runWriteScenario} from "./writeScenario";

// Replays the recorded write scenario of each write test server: offline, and the outcome must be the recorded one
const FIXTURES = join(__dirname, "fixtures", "write");

describe("Write test servers, recorded", () => {
    for (const server of RECORDED_WRITE_SERVERS) {
        const dir = join(FIXTURES, server.id);
        it.skipIf(!hasRecording(dir))(server.id, async () => {
            const replay = startReplay(dir);
            try {
                const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));
                expect(JSON.parse(JSON.stringify(await runWriteScenario(server)))).toEqual(expected);
            } finally {
                replay.stop();
            }
        });
    }
});

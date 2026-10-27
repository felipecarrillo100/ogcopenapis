import {vi} from "vitest";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";

/**
 * Records the responses of fetch to a fixtures folder, and replays them with a mocked fetch.
 * index.json maps each requested URL to its status, the headers the library reads and the file with its body.
 */
interface RecordedResponse {
    status: number;
    headers: { [name: string]: string };
    file?: string;
}

type Recording = { [url: string]: RecordedResponse };

const KEPT_HEADERS = ["content-type", "content-crs", "content-length"];

// OpenAPI documents are large and only their version is read, they are replayed as missing
const isNotSaved = (contentType: string) => contentType.indexOf("openapi") > -1;

// Statuses whose response must not have a body
const hasNoBody = (status: number) => status === 204 || status === 304;

function getUrl(input: RequestInfo | URL) {
    return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

export function startRecording(dir: string) {
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const recording: Recording = {};
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = getUrl(input);
        const response = await realFetch(input, init);
        const body = Buffer.from(await response.arrayBuffer());
        const headers: { [name: string]: string } = {};
        KEPT_HEADERS.forEach(name => {
            const value = response.headers.get(name);
            if (value !== null) headers[name] = value;
        });
        const contentType = headers["content-type"] || "";
        if (isNotSaved(contentType)) {
            recording[url] = {status: 404, headers: {}};
        } else {
            const file = createHash("sha1").update(url).digest("hex").slice(0, 16) + (contentType.indexOf("json") > -1 ? ".json" : ".bin");
            writeFileSync(join(dir, file), body);
            recording[url] = {status: response.status, headers, file};
        }
        return new Response(hasNoBody(response.status) ? null : body, {status: response.status, headers});
    });
    return {
        stop() {
            spy.mockRestore();
            const sorted: Recording = {};
            Object.keys(recording).sort().forEach(url => sorted[url] = recording[url]);
            writeFileSync(join(dir, "index.json"), JSON.stringify(sorted, null, 2) + "\n");
        }
    };
}

export function hasRecording(dir: string) {
    return existsSync(join(dir, "index.json"));
}

export function startReplay(dir: string) {
    const recording: Recording = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = getUrl(input);
        const recorded = recording[url];
        if (!recorded) throw new Error("No recorded response for " + url + ", record again with npm run test:record");
        const body = recorded.file && !hasNoBody(recorded.status) ? readFileSync(join(dir, recorded.file)) : null;
        return new Response(body, {status: recorded.status, headers: recorded.headers});
    });
    return {
        stop() {
            spy.mockRestore();
        }
    };
}

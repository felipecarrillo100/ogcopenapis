import {vi} from "vitest";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";

/**
 * Records the responses of fetch to a fixtures folder, and replays them with a mocked fetch.
 * index.json maps each request to its status, the headers the library reads and the file with its body. A GET is
 * keyed by its URL, another method by "METHOD URL". A request made more than once, such as an item read before and
 * after a write, keeps its responses in a list, replayed in that order.
 */
interface RecordedResponse {
    status: number;
    headers: { [name: string]: string };
    file?: string;
}

type Recording = { [key: string]: RecordedResponse | RecordedResponse[] };

const KEPT_HEADERS = ["content-type", "content-crs", "content-length", "location", "allow", "last-modified", "cache-control", "www-authenticate"];

// OpenAPI documents are large and only their version is read, they are replayed as missing
const isNotSaved = (contentType: string) => contentType.indexOf("openapi") > -1;

// Statuses whose response must not have a body
const hasNoBody = (status: number) => status === 204 || status === 304;

function getUrl(input: RequestInfo | URL) {
    return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

function getKey(input: RequestInfo | URL, init?: RequestInit) {
    const method = (init && init.method ? init.method : input instanceof Request ? input.method : "GET").toUpperCase();
    const url = getUrl(input);
    return method === "GET" ? url : method + " " + url;
}

export function startRecording(dir: string) {
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const recording: { [key: string]: RecordedResponse[] } = {};
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = getUrl(input);
        // LuciadRIA's WMTS capabilities of a tileset are a data URL, nothing to record
        if (url.startsWith("data:")) return realFetch(input, init);
        const key = getKey(input, init);
        const response = await realFetch(input, init);
        const body = Buffer.from(await response.arrayBuffer());
        const headers: { [name: string]: string } = {};
        KEPT_HEADERS.forEach(name => {
            const value = response.headers.get(name);
            if (value !== null) headers[name] = value;
        });
        const contentType = headers["content-type"] || "";
        const responses = recording[key] ? recording[key] : (recording[key] = []);
        if (isNotSaved(contentType)) {
            responses.push({status: 404, headers: {}});
        } else {
            const name = responses.length === 0 ? key : key + "#" + responses.length;
            const file = createHash("sha1").update(name).digest("hex").slice(0, 16) + (contentType.indexOf("json") > -1 ? ".json" : ".bin");
            writeFileSync(join(dir, file), body);
            responses.push({status: response.status, headers, file});
        }
        return new Response(hasNoBody(response.status) ? null : body, {status: response.status, headers});
    });
    return {
        stop() {
            spy.mockRestore();
            const sorted: Recording = {};
            Object.keys(recording).sort().forEach(key => sorted[key] = recording[key].length === 1 ? recording[key][0] : recording[key]);
            writeFileSync(join(dir, "index.json"), JSON.stringify(sorted, null, 2) + "\n");
        }
    };
}

export function hasRecording(dir: string) {
    return existsSync(join(dir, "index.json"));
}

export function startReplay(dir: string) {
    const recording: Recording = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    const replayed: { [key: string]: number } = {};
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = getUrl(input);
        if (url.startsWith("data:")) return realFetch(input, init);
        const key = getKey(input, init);
        const entry = recording[key];
        if (!entry) throw new Error("No recorded response for " + key + ", record again with npm run test:record");
        const count = replayed[key] ? replayed[key] : 0;
        replayed[key] = count + 1;
        const recorded = Array.isArray(entry) ? entry[Math.min(count, entry.length - 1)] : entry;
        const body = recorded.file && !hasNoBody(recorded.status) ? readFileSync(join(dir, recorded.file)) : null;
        return new Response(body, {status: recorded.status, headers: recorded.headers});
    });
    return {
        stop() {
            spy.mockRestore();
        }
    };
}

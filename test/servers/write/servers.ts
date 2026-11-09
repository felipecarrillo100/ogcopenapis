import {createHmac} from "node:crypto";

/**
 * The write test servers of test/servers/write, as the live write tests reach them. Their users and keys are for
 * these local containers only.
 */

// The HS256 key of ldproxy's JWT provider (ldproxy/ldproxy-data/cfg.yml), base64
const LDPROXY_SIGNING_KEY = "Z95Ka80dmouVVk0YZ/Qvh72SE/1Ynr7MZMT8Aiw+Tdk=";

const base64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

/**
 * A bearer token for ldproxy, which checks only bearer tokens. roles are its permissions: "write" writes every
 * collection, "data:write::spike:poi" only poi, "read" reads. Valid for an hour.
 */
export function ldproxyToken(user: string, roles: string[]) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({alg: "HS256", typ: "JWT"}));
    const payload = base64url(JSON.stringify({sub: user, roles, iat: now, exp: now + 3600}));
    const signature = createHmac("sha256", Buffer.from(LDPROXY_SIGNING_KEY, "base64")).update(header + "." + payload).digest();
    return header + "." + payload + "." + base64url(signature);
}

export const basic = (user: string, password: string) => "Basic " + Buffer.from(user + ":" + password).toString("base64");

export const WRITE_SERVERS = {
    // poi has CRUD on, without optimistic locking. A token with data:write::spike:poi writes poi only
    ldproxy: {url: "http://localhost:7081/spike/", collection: "poi", otherCollection: "roads"},
    // Through the nginx proxy: anonymous reads, writes with Basic editor (allowed) or viewer (403). places is
    // editable, roads not
    pygeoapi: {url: "http://localhost:5002/", collection: "places", readOnlyCollection: "roads"},
    // Through nginx with Basic: editor writes cities, viewer and anonymous only read. parcels is read-only
    qgis: {url: "http://localhost:8086/ogc/spike/ogcapi/", collection: "cities", readOnlyCollection: "parcels"},
    // OGC API Features is read-only in GeoServer 3.0.2
    geoserver: {url: "http://localhost:8085/geoserver/ogc/features/v1/", collection: "spike:cities"},
};

export const USERS = {
    editor: basic("editor", "editor"),
    viewer: basic("viewer", "viewer"),
};

/**
 * The servers whose write scenario (test/writeScenario.ts) is recorded in test/fixtures/write: the two that write.
 * Record again with npm run test:record-write, the write test servers running
 */
export const RECORDED_WRITE_SERVERS = [
    {
        id: "ldproxy", url: WRITE_SERVERS.ldproxy.url, collection: WRITE_SERVERS.ldproxy.collection,
        writer: "Bearer " + ldproxyToken("alice", ["write"]), refused: "Bearer " + ldproxyToken("carol", ["read"]),
        properties: {name: "recorded-write", category: "cafe", rating: 3},
        replaced: {name: "recorded-write-2", rating: 4},
        patch: {rating: 5, category: "bar"},
    },
    {
        id: "pygeoapi", url: WRITE_SERVERS.pygeoapi.url, collection: WRITE_SERVERS.pygeoapi.collection,
        writer: USERS.editor, refused: USERS.viewer,
        properties: {name: "recorded-write", kind: "cafe", pop: 3},
        replaced: {name: "recorded-write-2", kind: "bar", pop: 4},
        patch: {pop: 5},
    },
];

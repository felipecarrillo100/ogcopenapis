import type {ProxifyFunction} from "./OgcOpenApiGetCapabilities.js";

interface ExtFetchOptions {
    originalUrl: string;
    complete?: (url: string) => string;
    proxify?: ProxifyFunction;
    // Other origins than the one of originalUrl that may receive the credentials of the app
    credentialsOrigins?: string[];
}
export interface FetchServerOptions {
    proxy: (url: string, fetchOptions) => { fetchOptions: any; url: string };
    hostname: string;
    complete: (url: string) => string;
    // The origins that receive the requestHeaders and credentials of the app: the server's, and credentialsOrigins
    trustedOrigins?: string[];
}

// Stand-ins for the braces of URL templates while resolving, URL keeps them as they are
const OPEN_BRACE = "__OGC_OPEN_BRACE__";
const CLOSE_BRACE = "__OGC_CLOSE_BRACE__";

class OgcOpenApiFetchTools {

    public static createFetchOptions(options: ExtFetchOptions) {
        const hostname = this.getHostURL(options.originalUrl);
        const appOrigin = hostname ? hostname : typeof globalThis.location !== "undefined" ? globalThis.location.origin : "";
        const trustedOrigins = [appOrigin, ...(options.credentialsOrigins ? options.credentialsOrigins : [])]
            .map(origin => OgcOpenApiFetchTools.getOrigin(origin)).filter(origin => !!origin);
        return {
            hostname: hostname,
            trustedOrigins,
            complete: typeof options.complete === "function" ? options.complete : (url: string) => {
                return this.addHostURL(url, hostname)
            },
            proxy: typeof options.proxify === "function" ? options.proxify : (url: string, fetchOptions) => ({
                url: url,
                fetchOptions: fetchOptions
            })
        }
    }

    /**
     * The fetch mode of the credentials option, as LuciadRIA gives it to the images it loads: true includes the
     * credentials, cookies among them, also for another origin; false or unset only for the same origin, which is
     * also what fetch does without a mode.
     */
    public static toFetchCredentials(credentials?: boolean): RequestCredentials {
        return credentials ? "include" : "same-origin";
    }

    /**
     * Fetches input, completed with the host of the server and through its proxify. requestHeaders are the headers of
     * the app in options.headers: they and the credentials are sent only to the trusted origins of serverOptions, the
     * server's own and the credentialsOrigins of the app. A request to another origin, which a link of the server can
     * name, is sent without them, but with Accept, and with credentials "same-origin". The origin is the one of the
     * link, before proxify, which is the app's own routing. A URL without an origin, behind a relative proxy path, is
     * the server's.
     */
    public static fetch(input: string, options: RequestInit, serverOptions: FetchServerOptions, requestHeaders?: {[name: string]: string} | null) {
        const fullUrl = serverOptions.complete(input);
        const fetchOptions = requestHeaders && !OgcOpenApiFetchTools.isTrusted(fullUrl, serverOptions) ?
            OgcOpenApiFetchTools.withoutAppCredentials(options, requestHeaders) : options;
        const result = serverOptions.proxy(fullUrl, fetchOptions)
        return fetch(result.url, result.fetchOptions);
    }

    private static isTrusted(url: string, serverOptions: FetchServerOptions) {
        const origin = OgcOpenApiFetchTools.getOrigin(url);
        // Server options made without createFetchOptions trust the origin of their host
        const trusted = serverOptions.trustedOrigins ? serverOptions.trustedOrigins : [OgcOpenApiFetchTools.getOrigin(serverOptions.hostname)];
        return origin === "" || trusted.indexOf(origin) > -1;
    }

    private static withoutAppCredentials(options: RequestInit, requestHeaders: {[name: string]: string}): RequestInit {
        const appHeaders = Object.keys(requestHeaders).map(name => name.toLowerCase()).filter(name => name !== "accept");
        const headers = {};
        new Headers(options.headers).forEach((value, name) => {
            if (appHeaders.indexOf(name) === -1) headers[name] = value;
        });
        return {...options, headers, credentials: "same-origin"};
    }

    // The origin of an absolute http(s) URL, as the browser compares it (scheme, host and port), "" for another URL
    private static getOrigin(url: string) {
        if (!/^https?:\/\//i.test(url)) return "";
        try {
            return new URL(url).origin;
        } catch (e) {
            return "";
        }
    }

    /**
     * A link of a document, resolved against the URL of that document (RFC 3986): ./x, ../x, x, /x and //host/x.
     * Absolute links are kept as they are. Without an absolute document URL, as behind a relative proxy path, the link
     * is completed with the host of the server.
     */
    public static resolveUrl(href: string, documentUrl: string, serverOptions: FetchServerOptions) {
        if (typeof href !== "string" || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
        if (!/^https?:\/\//i.test(documentUrl)) return serverOptions.complete(href);
        // URL encodes { and } in paths, which tile URL templates use: {tileMatrix}/{tileRow}/{tileCol}
        const resolved = new URL(href.replace(/\{/g, OPEN_BRACE).replace(/}/g, CLOSE_BRACE), documentUrl).href;
        return resolved.split(OPEN_BRACE).join("{").split(CLOSE_BRACE).join("}");
    }

    public static addHostURL(url: string, HostUrl?: string) {
        if (typeof url === "undefined") return url;
        const hostUrl = HostUrl ? HostUrl : "";
        if (url.startsWith("http://") ||  url.startsWith("https://")) {
            return url;
        } else {
            if (url.startsWith("/")) return hostUrl + url;
            if (url.startsWith("./")) return hostUrl + url.substring(1);
        }
        return hostUrl + "/" + url;
    }

    /**
     * A value for a query parameter: encoded, except for , : and / which are allowed in a query (RFC 3986) and keep
     * values such as bbox=1,2,3,4 and crs=http://www.opengis.net/def/crs/... readable. Spaces, &, #, + and = are encoded.
     */
    public static encodeQueryValue(value: string | number | boolean | Array<string | number>) {
        return encodeURIComponent(Array.isArray(value) ? value.join(",") : String(value))
            .replace(/%2C/gi, ",").replace(/%3A/gi, ":").replace(/%2F/gi, "/");
    }

    /**
     * url with path appended to its path, keeping its query: .../collections/c?f=json and styles give .../collections/c/styles?f=json
     */
    public static appendPath(url: string, path: string) {
        const [base, query] = url.split(/\?(.*)/s);
        return OgcOpenApiFetchTools.cleanUrl(base) + path + (query ? "?" + query : "");
    }

    public static cleanUrl(inputUrl:string) {
        return inputUrl.split("?")[0].replace(/\/?$/, '/');
    }

    public static cleanUrlToAsset(inputUrl:string) {
        return inputUrl.split("?")[0].replace(/\/?$/, '');
    }

    public static getHostURL(fullUrl: string) {
        if (!fullUrl.startsWith("http")) return "";
        const pathArray = fullUrl.split( '/' );
        const protocol = pathArray[0];
        const host = pathArray[2];
        return protocol + '//' + host;
    }
}

export {
    OgcOpenApiFetchTools
}

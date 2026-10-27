import {ProxifyFunction} from "./OgcOpenApiGetCapabilities";

interface ExtFetchOptions {
    originalUrl: string;
    complete?: (url: string) => string;
    proxify?: ProxifyFunction
}
export interface FetchServerOptions {
    proxy: (url: string, fetchOptions) => { fetchOptions: any; url: string };
    hostname: string;
    complete: (url: string) => string
}

// Stand-ins for the braces of URL templates while resolving, URL keeps them as they are
const OPEN_BRACE = "__OGC_OPEN_BRACE__";
const CLOSE_BRACE = "__OGC_CLOSE_BRACE__";

class OgcOpenApiFetchTools {

    public static createFetchOptions(options: ExtFetchOptions) {
        const hostname = this.getHostURL(options.originalUrl);
        return {
            hostname: hostname,
            complete: typeof options.complete === "function" ? options.complete : (url: string) => {
                return this.addHostURL(url, hostname)
            },
            proxy: typeof options.proxify === "function" ? options.proxify : (url: string, fetchOptions) => ({
                url: url,
                fetchOptions: fetchOptions
            })
        }
    }

    public static fetch(input: string, options: RequestInit, serverOptions: FetchServerOptions) {
        const fullUrl = serverOptions.complete(input);
        const result = serverOptions.proxy(fullUrl, options)
        return fetch(result.url, result.fetchOptions);
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

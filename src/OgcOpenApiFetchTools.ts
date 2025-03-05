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

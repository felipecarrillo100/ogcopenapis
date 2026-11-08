import {
    CollectionLinkType,
    type LinkType,
    type OgcOpenApiCapabilitiesCollection,
    type OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities,
    type TileSetLayer
} from "./OgcOpenApiGetCapabilities.js";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools.js";
import {OgcOpenApiError} from "./OgcOpenApiError.js";

export const MAPBOX_STYLE_TYPE = "application/vnd.mapbox.style+json";

type RequestHeaders = {[headerName: string]: string;} | null

export interface OgcOpenApiStyle {
    id: string;
    title: string;
    // The stylesheets of this style in the Mapbox GL encoding, the only one LuciadRIA reads
    mapboxStylesheets: LinkType[];
}

export interface OgcOpenApiMapStyle {
    id: string;
    title: string;
    // The map links of this style, one per format (OGC API Maps, Styled Map class): …/styles/{styleId}/map
    mapLinks: LinkType[];
}

const DEFAULT_COLORS =["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

class OgcOpenApiStyleTools {

    /**
     * Lists the styles of a collection (OGC API Styles) that are available as a Mapbox GL style, or with collection
     * null the styles of the dataset, for its dataset tilesets.
     */
    public static fetchStyles(
        capabilities: OgcOpenApiCapabilitiesObject | null,
        collection: OgcOpenApiCapabilitiesCollection | null,
        options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
    ) {
        return new Promise<OgcOpenApiStyle[]>((resolve, reject) => {
            if (capabilities === null) {
                reject(new OgcOpenApiError("No capabilities"));
                return;
            }
            const href = OgcOpenApiStyleTools.withJsonFormat(OgcOpenApiStyleTools.getStylesHref(capabilities, collection));
            OgcOpenApiFetchTools.fetch(href, {
                method: "GET",
                credentials: OgcOpenApiFetchTools.toFetchCredentials(options?.credentials),
                headers: {...(options?.requestHeaders ? options.requestHeaders : {}), Accept: "application/json"}
            }, capabilities.serverOptions).then(response => {
                // A collection without styles
                if (response.status === 404) {
                    resolve([]);
                    return;
                }
                if (response.status !== 200) {
                    OgcOpenApiError.fromResponse(response, "Invalid response: " + response.status, href).then(reject);
                    return;
                }
                response.json().then(data => {
                    const styles = data.styles ? data.styles : [];
                    resolve(styles.map(style => ({
                        id: style.id,
                        title: style.title ? style.title : style.id,
                        mapboxStylesheets: (style.links ? style.links : [])
                            .filter(l => l.rel === "stylesheet" && typeof l.type === "string" && l.type.indexOf(MAPBOX_STYLE_TYPE) === 0)
                            // Relative to the styles document
                            .map(l => ({...l, href: OgcOpenApiFetchTools.resolveUrl(l.href, href, capabilities.serverOptions)}))
                    })).filter(style => style.mapboxStylesheets.length > 0));
                }, () => reject(new OgcOpenApiError("Not JSON data", {url: href})));
            }, reject);
        });
    }

    /**
     * Lists the styles of a collection that have a map (OGC API Maps, Styled Map class, OGC 20-058 clause 21), or with
     * collection null the styles of the dataset. The default style of the styles document comes first, then the others
     * in the server's order. For a collection that offers its map only per style, as GeoServer's do
     * (OgcOpenApiGetCapabilities.mayOfferStyledMap): a map link of a style is the baseURL of an OgcOpenApiMapsModel.
     * Resolves an empty list for a collection without styles (404). Rejects with an Error otherwise, and with the error
     * of the request as it is when it fails, an AbortError included.
     */
    public static async fetchMapStyles(
        capabilities: OgcOpenApiCapabilitiesObject,
        collection: OgcOpenApiCapabilitiesCollection | null,
        options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
    ): Promise<OgcOpenApiMapStyle[]> {
        const href = OgcOpenApiStyleTools.withJsonFormat(OgcOpenApiStyleTools.getStylesHref(capabilities, collection));
        const response = await OgcOpenApiFetchTools.fetch(href, {
            method: "GET",
            credentials: OgcOpenApiFetchTools.toFetchCredentials(options?.credentials),
            headers: {...(options?.requestHeaders ? options.requestHeaders : {}), Accept: "application/json"}
        }, capabilities.serverOptions);
        if (response.status === 404) return [];
        if (response.status !== 200) throw await OgcOpenApiError.fromResponse(response, "Invalid response: " + response.status + " in " + href, href);
        let data: any;
        try {
            data = await response.json();
        } catch (e) {
            throw new OgcOpenApiError("Not JSON data in " + href, {url: href});
        }
        const styles: OgcOpenApiMapStyle[] = (Array.isArray(data?.styles) ? data.styles : [])
            .filter(style => style && typeof style.id === "string")
            .map(style => ({
                id: style.id,
                title: style.title ? style.title : style.id,
                mapLinks: OgcOpenApiGetCapabilities.filterCollectionLinks(Array.isArray(style.links) ? style.links : [], CollectionLinkType.Map)
                    // Relative to the styles document
                    .map(l => ({...l, href: OgcOpenApiFetchTools.resolveUrl(l.href, href, capabilities.serverOptions)}))
            }))
            .filter(style => style.mapLinks.length > 0);
        const defaultStyle = styles.find(style => style.id === data.default);
        return defaultStyle ? [defaultStyle, ...styles.filter(style => style !== defaultStyle)] : styles;
    }

    /**
     * The styles for a tile matrix set. Zoom levels are tile matrix set specific, so a server can have a style per
     * tile matrix set and name it after it (PDOK: bgt_standaardvisualisatie__netherlandsrdnewquad). A style named after
     * another of tileMatrixSetIds, and not after tileMatrixSetId, is left out. Other styles have a stylesheet per tile
     * matrix set or serve all of them (pickStylesheet).
     */
    public static getStylesForTileMatrixSet(styles: OgcOpenApiStyle[], tileMatrixSetId: string, tileMatrixSetIds: string[]) {
        const names = (style: OgcOpenApiStyle, id: string) => (style.id + " " + style.title).toLowerCase().indexOf(id.toLowerCase()) > -1;
        const others = tileMatrixSetIds.filter(id => id.toLowerCase() !== tileMatrixSetId.toLowerCase());
        return styles.filter(style => names(style, tileMatrixSetId) || !others.some(id => names(style, id)));
    }

    /**
     * A style can have one stylesheet per tile matrix set, because zoom levels are tile matrix set specific.
     * Prefers the stylesheet for tileMatrixSetId, then the one without a tile matrix set.
     */
    public static pickStylesheet(style: OgcOpenApiStyle, tileMatrixSetId: string): LinkType | undefined {
        const forTileMatrixSet = style.mapboxStylesheets.find(l => l.href.indexOf("tile-matrix-set=" + tileMatrixSetId) > -1);
        if (forTileMatrixSet) return forTileMatrixSet;
        const generic = style.mapboxStylesheets.find(l => l.href.indexOf("tile-matrix-set=") === -1);
        return generic ? generic : style.mapboxStylesheets[0];
    }

    /**
     * Fetches a Mapbox GL style. Properties without a value, as in `"filter" : ,`, are removed so that styles
     * that are not valid JSON can still be used.
     */
    public static fetchMapboxStyle(
        capabilities: OgcOpenApiCapabilitiesObject,
        stylesheet: LinkType,
        options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
    ) {
        return OgcOpenApiFetchTools.fetch(stylesheet.href, {
            method: "GET",
            credentials: OgcOpenApiFetchTools.toFetchCredentials(options?.credentials),
            headers: {...(options?.requestHeaders ? options.requestHeaders : {}), Accept: MAPBOX_STYLE_TYPE}
        }, capabilities.serverOptions).then(async response => {
            if (response.status !== 200) throw await OgcOpenApiError.fromResponse(response, "Invalid response: " + response.status, stylesheet.href);
            return response.text();
        }).then(text => OgcOpenApiStyleTools.parseMapboxStyle(text));
    }

    public static parseMapboxStyle(text: string): any {
        try {
            return JSON.parse(text);
        } catch (e) {
            const repaired = text
                .replace(/"[^"\\]*"\s*:\s*(?=[,}\]])/g, "")
                .replace(/,(\s*[,}\]])/g, "$1")
                .replace(/,(\s*[,}\]])/g, "$1")
                .replace(/([{\[])(\s*),/g, "$1$2");
            return JSON.parse(repaired);
        }
    }

    /**
     * A Mapbox GL style that paints every layer of a vector tileset, by geometryDimension: points as dots,
     * lines as lines and surfaces as filled polygons. Layers without geometryDimension get all three, filtered
     * by geometry type.
     */
    public static createDefaultStyle(layers: TileSetLayer[], name?: string): any {
        const styleLayers = [];
        layers.forEach((layer, index) => {
            const color = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            const dimension = layer.geometryDimension;
            const known = typeof dimension === "number";
            if (!known || dimension === 2) {
                styleLayers.push({
                    id: layer.id + "_fill", type: "fill", "source-layer": layer.id,
                    ...(known ? {} : {filter: ["==", ["geometry-type"], "Polygon"]}),
                    paint: {"fill-color": color, "fill-opacity": 0.4, "fill-outline-color": color}
                });
            }
            if (!known || dimension === 1 || dimension === 2) {
                styleLayers.push({
                    id: layer.id + "_line", type: "line", "source-layer": layer.id,
                    ...(known ? {} : {filter: ["!=", ["geometry-type"], "Point"]}),
                    paint: {"line-color": color, "line-width": dimension === 2 ? 1 : 2}
                });
            }
            if (!known || dimension === 0) {
                // A text dot rather than a circle layer: LuciadRIA 2026.1.1 does not paint circle layers
                styleLayers.push({
                    id: layer.id + "_point", type: "symbol", "source-layer": layer.id,
                    ...(known ? {} : {filter: ["==", ["geometry-type"], "Point"]}),
                    layout: {"text-field": "\u25CF", "text-size": 16, "text-allow-overlap": true},
                    paint: {"text-color": color, "text-halo-color": "#ffffff", "text-halo-width": 1}
                });
            }
        });
        return {version: 8, name: name ? name : "default", sources: {}, layers: styleLayers};
    }

    // Some servers (ldproxy) list the styles link only in the collection document, not in /collections.
    // The styles of the dataset are linked from the landing page.
    private static getStylesHref(capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection | null) {
        if (!collection) {
            const datasetLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(capabilities.links ? capabilities.links : [], CollectionLinkType.Styles);
            const datasetLink = datasetLinks.find(l => l.type === "application/json") || datasetLinks.find(l => !l.type);
            return datasetLink ? datasetLink.href : capabilities.baseUrl + "styles";
        }
        const stylesLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Styles);
        const link = stylesLinks.find(l => l.type === "application/json") || stylesLinks.find(l => !l.type);
        if (link) return link.href;
        const self = collection.links.find(l => l.rel === "self");
        const collectionHref = self ? self.href : capabilities.baseUrl + "collections/" + collection.id;
        return OgcOpenApiFetchTools.appendPath(collectionHref, "styles");
    }

    private static withJsonFormat(href: string) {
        if (/[?&]f=/.test(href)) return href;
        return href + (href.indexOf("?") > -1 ? "&" : "?") + "f=json";
    }
}

export {
    OgcOpenApiStyleTools
}

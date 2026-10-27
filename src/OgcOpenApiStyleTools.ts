import {
    CollectionLinkType,
    LinkType,
    OgcOpenApiCapabilitiesCollection,
    OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities,
    TileSetLayer
} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";

export const MAPBOX_STYLE_TYPE = "application/vnd.mapbox.style+json";

type RequestHeaders = {[headerName: string]: string;} | null

export interface OgcOpenApiStyle {
    id: string;
    title: string;
    // The stylesheets of this style in the Mapbox GL encoding, the only one LuciadRIA reads
    mapboxStylesheets: LinkType[];
}

const DEFAULT_COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

class OgcOpenApiStyleTools {

    /**
     * Lists the styles of a collection (OGC API Styles) that are available as a Mapbox GL style.
     */
    public static fetchStyles(
        capabilities: OgcOpenApiCapabilitiesObject | null,
        collection: OgcOpenApiCapabilitiesCollection,
        options?: {credentials?: boolean, requestHeaders?: RequestHeaders}
    ) {
        return new Promise<OgcOpenApiStyle[]>((resolve, reject) => {
            if (capabilities === null) {
                reject();
                return;
            }
            const href = OgcOpenApiStyleTools.withJsonFormat(OgcOpenApiStyleTools.getStylesHref(capabilities, collection));
            OgcOpenApiFetchTools.fetch(href, {
                method: "GET",
                credentials: options?.credentials ? "same-origin" : "omit",
                headers: {...(options?.requestHeaders ? options.requestHeaders : {}), Accept: "application/json"}
            }, capabilities.serverOptions).then(response => {
                // A collection without styles
                if (response.status === 404) {
                    resolve([]);
                    return;
                }
                if (response.status !== 200) {
                    reject({error: true, message: "Invalid response: " + response.status});
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
                }, () => reject({error: true, message: "Not JSON data"}));
            }, err => reject({error: true, message: err.message}));
        });
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
            credentials: options?.credentials ? "same-origin" : "omit",
            headers: {...(options?.requestHeaders ? options.requestHeaders : {}), Accept: MAPBOX_STYLE_TYPE}
        }, capabilities.serverOptions).then(response => {
            if (response.status !== 200) throw new Error("Invalid response: " + response.status);
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

    // Some servers (ldproxy) list the styles link only in the collection document, not in /collections
    private static getStylesHref(capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection) {
        const stylesLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Styles);
        const link = stylesLinks.find(l => l.type === "application/json") || stylesLinks.find(l => !l.type);
        if (link) return link.href;
        const self = collection.links.find(l => l.rel === "self");
        const collectionHref = self ? self.href : capabilities.baseUrl + "collections/" + collection.id;
        return OgcOpenApiFetchTools.cleanUrl(collectionHref) + "styles";
    }

    private static withJsonFormat(href: string) {
        if (/[?&]f=/.test(href)) return href;
        return href + (href.indexOf("?") > -1 ? "&" : "?") + "f=json";
    }
}

export {
    OgcOpenApiStyleTools
}

import {MapboxVectorTileSetModel} from "@luciad/ria/model/tileset/mapbox/MapboxVectorTileSetModel";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {Bounds} from "@luciad/ria/shape/Bounds";
import {ProxifyFunction, TileSetData} from "./OgcOpenApiGetCapabilities";
import {FetchServerOptions, OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";
import {OgcOpenApiTileGrid, OgcOpenApiTileMatrixTools} from "./OgcOpenApiTileMatrixTools";

export interface OgcOpenApiVectorTilesModelOptions {
    tileMatrix: TileSetData;
    baseURL: string;
    collection: string;
    credentials?: boolean;
    requestHeaders?: { [p: string]: string };
    // From OgcOpenApiGetCapabilities.fetchCollectionTileSet, restricts the levels that are requested
    tileMatrixSetLimits?: { tileMatrix: string }[];
    // The data extent, defaults to the extent of the tile matrix set
    bounds?: Bounds;
    styleUrl?: string;

    proxify?: ProxifyFunction
}

export class OgcOpenApiVectorTilesModel extends MapboxVectorTileSetModel {
    private tileGrid: OgcOpenApiTileGrid;
    private tileTemplate: string;
    private serverOptions: FetchServerOptions;

    constructor(options: OgcOpenApiVectorTilesModelOptions) {
        const tileGrid = OgcOpenApiTileMatrixTools.createTileGrid(options.tileMatrix);
        const levels = OgcOpenApiVectorTilesModel.getLevelRange(tileGrid, options.tileMatrixSetLimits);
        super({
            baseURL: options.baseURL,
            structure: {
                reference: tileGrid.reference,
                bounds: tileGrid.bounds,
                level0Columns: tileGrid.level0Columns,
                level0Rows: tileGrid.level0Rows,
            },
            minLevel: levels.minLevel,
            maxLevel: levels.maxLevel,
            bounds: options.bounds,
            name: options.collection,
            styleUrl: options.styleUrl ? options.styleUrl : null,
            credentials: options.credentials,
            requestHeaders: options.requestHeaders ? options.requestHeaders : {},
        });
        this.tileGrid = tileGrid;
        this.tileTemplate = options.baseURL;
        this.serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: options.baseURL, proxify: options.proxify});
    }

    getVectorTile(tile: TileCoordinate, signal?: AbortSignal): Promise<ArrayBuffer | null> {
        const targetUrl = OgcOpenApiTileMatrixTools.resolveTileTemplate(this.tileTemplate, this.tileGrid, tile);
        if (targetUrl === null) return Promise.resolve(null);
        const tileUrl = OgcOpenApiTileMatrixTools.appendQueryParameters(targetUrl, this.requestParameters ? this.requestParameters : {});
        return OgcOpenApiFetchTools.fetch(tileUrl, {
            method: "GET",
            credentials: this.credentials ? "same-origin" : "omit",
            headers: this.requestHeaders ? this.requestHeaders : {},
            signal
        }, this.serverOptions).then(response => {
            // Servers answer a tile without data with 204, 404 or an empty 200
            if (response.status === 204 || response.status === 404) return null;
            if (response.status !== 200) throw new Error("Invalid response: " + response.status + " for " + tileUrl);
            return response.arrayBuffer().then(content => content.byteLength > 0 ? content : null);
        });
    }

    // Maps tileMatrixSetLimits (by tile matrix id) onto LuciadRIA levels
    private static getLevelRange(tileGrid: OgcOpenApiTileGrid, tileMatrixSetLimits?: { tileMatrix: string }[]) {
        const levels = tileMatrixSetLimits ?
            tileMatrixSetLimits.map(l => tileGrid.tileMatrices.findIndex(m => m.id === l.tileMatrix)).filter(level => level > -1) :
            [];
        if (levels.length === 0) return {minLevel: 0, maxLevel: tileGrid.levelCount - 1};
        return {minLevel: Math.min(...levels), maxLevel: Math.max(...levels)};
    }
}

import {MapboxVectorTileSetModel} from "@luciad/ria/model/tileset/mapbox/MapboxVectorTileSetModel";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {Bounds} from "@luciad/ria/shape/Bounds";
import {ProxifyFunction, TileMatrixLimits, TileSetData} from "./OgcOpenApiGetCapabilities";
import {FetchServerOptions, OgcOpenApiFetchTools} from "./OgcOpenApiFetchTools";
import {OgcOpenApiTileGrid, OgcOpenApiTileMatrixTools} from "./OgcOpenApiTileMatrixTools";

export interface OgcOpenApiVectorTilesModelOptions {
    tileMatrix: TileSetData;
    baseURL: string;
    collection: string;
    credentials?: boolean;
    requestHeaders?: { [p: string]: string };
    // From OgcOpenApiGetCapabilities.fetchCollectionTileSet, tiles outside these limits are not requested
    tileMatrixSetLimits?: TileMatrixLimits[];
    // The data extent, defaults to the extent of the tile matrix set
    bounds?: Bounds;
    styleUrl?: string;

    proxify?: ProxifyFunction
}

export class OgcOpenApiVectorTilesModel extends MapboxVectorTileSetModel {
    private tileGrid: OgcOpenApiTileGrid;
    private tileTemplate: string;
    private serverOptions: FetchServerOptions;
    private tileMatrixSetLimits: TileMatrixLimits[] | undefined;

    constructor(options: OgcOpenApiVectorTilesModelOptions) {
        const tileGrid = OgcOpenApiTileMatrixTools.createTileGrid(options.tileMatrix);
        const maxLevel = OgcOpenApiVectorTilesModel.getMaxLevel(tileGrid, options.tileMatrixSetLimits);
        super({
            baseURL: options.baseURL,
            structure: {
                reference: tileGrid.reference,
                bounds: tileGrid.bounds,
                level0Columns: tileGrid.level0Columns,
                level0Rows: tileGrid.level0Rows,
            },
            // LuciadRIA 2026.1.1 paints nothing when minLevel > 0, levels without data are skipped in getVectorTile
            minLevel: 0,
            maxLevel,
            bounds: options.bounds,
            name: options.collection,
            styleUrl: options.styleUrl ? options.styleUrl : null,
            credentials: options.credentials,
            requestHeaders: options.requestHeaders ? options.requestHeaders : {},
        });
        this.tileGrid = tileGrid;
        this.tileTemplate = options.baseURL;
        this.serverOptions = OgcOpenApiFetchTools.createFetchOptions({originalUrl: options.baseURL, proxify: options.proxify});
        this.tileMatrixSetLimits = options.tileMatrixSetLimits;
    }

    getVectorTile(tile: TileCoordinate, signal?: AbortSignal): Promise<ArrayBuffer | null> {
        if (!this.hasData(tile)) return Promise.resolve(null);
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

    // Whether the tile is inside the tileMatrixSetLimits, all tiles are when there are no limits
    private hasData(tile: TileCoordinate) {
        if (!this.tileMatrixSetLimits) return true;
        const ogcTile = OgcOpenApiTileMatrixTools.getOgcTile(this.tileGrid, tile);
        if (ogcTile === null) return false;
        const limits = this.tileMatrixSetLimits.find(l => l.tileMatrix === ogcTile.tileMatrix);
        return !!limits &&
            ogcTile.tileRow >= limits.minTileRow && ogcTile.tileRow <= limits.maxTileRow &&
            ogcTile.tileCol >= limits.minTileCol && ogcTile.tileCol <= limits.maxTileCol;
    }

    // The deepest level in the tileMatrixSetLimits, LuciadRIA over-zooms beyond it
    private static getMaxLevel(tileGrid: OgcOpenApiTileGrid, tileMatrixSetLimits?: TileMatrixLimits[]) {
        const levels = tileMatrixSetLimits ?
            tileMatrixSetLimits.map(l => tileGrid.tileMatrices.findIndex(m => m.id === l.tileMatrix)).filter(level => level > -1) :
            [];
        return levels.length === 0 ? tileGrid.levelCount - 1 : Math.max(...levels);
    }
}

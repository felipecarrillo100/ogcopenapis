import {MapboxVectorTileSetModel} from "@luciad/ria/model/tileset/mapbox/MapboxVectorTileSetModel";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {Bounds} from "@luciad/ria/shape/Bounds";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createPoint} from "@luciad/ria/shape/ShapeFactory";
import {createTransformation} from "@luciad/ria/transformation/TransformationFactory";
import {ProxifyFunction, TileMatrixLimits, TileSetData, TileSetLayer} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiMvtTools} from "./OgcOpenApiMvtTools";
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

    /**
     * The layers in the tiles, read from a few sample tiles. For tilesets whose metadata does not list their layers,
     * the layer names in the tiles cannot be guessed: some servers name a layer after the collection, others not.
     * extent, in CRS:84 as [minX, minY, maxX, maxY], is where the data is, such as the extent of the collection.
     * Resolves the layers of the first sample tile that has any, or an empty array.
     */
    async discoverLayers(options: { extent?: number[], maxRequests?: number } = {}): Promise<TileSetLayer[]> {
        const maxRequests = typeof options.maxRequests === "number" ? options.maxRequests : 6;
        for (const tile of this.getSampleTiles(options.extent).slice(0, maxRequests)) {
            const content = await this.getVectorTile(tile).catch(() => null);
            if (!content) continue;
            const layers = await OgcOpenApiMvtTools.getLayers(content).catch(() => []);
            if (layers.length > 0) return layers;
        }
        return [];
    }

    // Tiles likely to have data: the middle tile of the limits per level, or the tile at the center of the extent
    private getSampleTiles(extent?: number[]): TileCoordinate[] {
        if (this.tileMatrixSetLimits) {
            return this.tileMatrixSetLimits
                .map(l => OgcOpenApiTileMatrixTools.getLuciadTile(this.tileGrid, l.tileMatrix,
                    Math.floor((l.minTileRow + l.maxTileRow) / 2), Math.floor((l.minTileCol + l.maxTileCol) / 2)))
                .filter(tile => tile !== null)
                .sort((a, b) => a.level - b.level);
        }
        if (!extent || extent.length < 4) {
            const tiles: TileCoordinate[] = [];
            for (let x = 0; x < this.tileGrid.level0Columns; x++) {
                for (let y = 0; y < this.tileGrid.level0Rows; y++) tiles.push({level: 0, x, y});
            }
            return tiles;
        }
        const crs84 = getReference("CRS:84");
        const center = createTransformation(crs84, this.tileGrid.reference)
            .transform(createPoint(crs84, [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]));
        const bounds = this.tileGrid.bounds;
        return [0, 2, 4, 6, 8, 10, 12].filter(level => level < this.tileGrid.levelCount).map(level => {
            const columns = this.tileGrid.level0Columns * Math.pow(2, level);
            const rows = this.tileGrid.level0Rows * Math.pow(2, level);
            const x = Math.floor((center.x - bounds.x) / (bounds.width / columns));
            const y = Math.floor((center.y - bounds.y) / (bounds.height / rows));
            return {level, x: Math.min(Math.max(x, 0), columns - 1), y: Math.min(Math.max(y, 0), rows - 1)};
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

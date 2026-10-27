import {WMTSTileSetModel, type WMTSTileSetModelConstructorOptions} from "@luciad/ria/model/tileset/WMTSTileSetModel.js";
import {WMTSRequestEncoding} from "@luciad/ria/model/tileset/WMTSRequestEncoding.js";
import type {QuadTreeRasterTileSetStructure, TileMatrix, TileMatrixSet2DRasterTileSetStructure} from "@luciad/ria/model/tileset/RasterTileSetModel.js";
import {RasterDataType} from "@luciad/ria/model/tileset/RasterDataType.js";
import {RasterSamplingMode} from "@luciad/ria/model/tileset/RasterSamplingMode.js";
import type {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate.js";
import type {ProxifyFunction, TileMatrixLimits, TileSetData} from "./OgcOpenApiGetCapabilities.js";
import {type OgcOpenApiTileGrid, OgcOpenApiTileMatrixTools} from "./OgcOpenApiTileMatrixTools.js";
import {OgcOpenApiWmtsTools} from "./OgcOpenApiWmtsTools.js";


export interface OgcOpenApiTilesModelOptions {
    tileMatrix: TileSetData;
    baseURL: string;
    collection: string;
    dataType?: RasterDataType;
    samplingMode?: RasterSamplingMode;
    credentials?: boolean;
    requestHeaders?: { [p: string]: string };
    transparent?: boolean;
    bgcolor?: string;

    proxify?: ProxifyFunction
}

export interface OgcOpenApiTilesModelCreateOptions extends OgcOpenApiTilesModelOptions {
    // From OgcOpenApiGetCapabilities.fetchCollectionTileSet, tiles outside these limits are not requested
    tileMatrixSetLimits?: TileMatrixLimits[];
    // The data extent in CRS:84, [minX, minY, maxX, maxY], such as the extent of the collection
    extent?: number[];
    // The media type of the tiles, image/png by default
    format?: string;
}

// The tile structure that LuciadRIA's WMTS support derived from the tile matrix set
interface WmtsTileStructure {
    structure: QuadTreeRasterTileSetStructure | TileMatrixSet2DRasterTileSetStructure;
    // The tile matrix of each level, with its OGC id and number of rows
    tileMatrices: { id: string, matrixHeight: number }[];
}

export class OgcOpenApiTilesModel extends WMTSTileSetModel {
    private transparent: boolean;
    private bgcolor: string | undefined;
    private proxy: ProxifyFunction;
    private tileMatrixSetLimits: TileMatrixLimits[] | undefined;
    // Not tileMatrices: WMTSTileSetModel keeps the tile matrix ids in that property
    private ogcTileMatrices: { id: string, matrixHeight: number }[];
    // Only for the deprecated constructor, which addresses the tiles itself with the OGC API template
    private tileGrid: OgcOpenApiTileGrid | null;
    private ogcTemplate: string;

    /**
     * Creates the model with LuciadRIA's WMTS support, which handles tile matrix sets that are quad-trees and
     * tile matrix sets that are not, such as GlobalCRS84Scale.
     */
    static async createFromTileSet(options: OgcOpenApiTilesModelCreateOptions): Promise<OgcOpenApiTilesModel> {
        const tileSet = options.tileMatrix;
        // WMTS 1.0 has no other corner of origin than the top left
        if (tileSet.tileMatrices.some(m => typeof m.cornerOfOrigin === "string" && m.cornerOfOrigin.toUpperCase() === "BOTTOMLEFT")) {
            return new OgcOpenApiTilesModel(options);
        }
        const format = options.format ? options.format : "image/png";
        const capabilities = await OgcOpenApiWmtsTools.createCapabilities({
            layer: options.collection, tileMatrix: tileSet, template: options.baseURL, format,
            tileMatrixSetLimits: options.tileMatrixSetLimits, extent: options.extent,
        });
        const wmts = WMTSTileSetModel.createFromCapabilities(capabilities, {layer: options.collection}, {format});
        return new OgcOpenApiTilesModel(options, OgcOpenApiTilesModel.getTileStructure(wmts, tileSet));
    }

    /**
     * @deprecated Supports quad-tree tile matrix sets only, use createFromTileSet
     */
    constructor(options: OgcOpenApiTilesModelCreateOptions, wmtsStructure?: WmtsTileStructure) {
        const tileGrid = wmtsStructure ? null : OgcOpenApiTileMatrixTools.createTileGrid(options.tileMatrix);
        const tileMatrices = wmtsStructure ? wmtsStructure.tileMatrices :
            tileGrid.tileMatrices.map(m => ({id: m.id, matrixHeight: m.matrixHeight}));
        const structure = wmtsStructure ? wmtsStructure.structure : {
            reference: tileGrid.reference,
            bounds: tileGrid.bounds,
            levelCount: tileGrid.levelCount,
            level0Columns: tileGrid.level0Columns,
            level0Rows: tileGrid.level0Rows,
            tileWidth: tileGrid.tileWidth,
            tileHeight: tileGrid.tileHeight,
        };
        const template = OgcOpenApiWmtsTools.toWmtsTemplate(options.baseURL);
        const o: WMTSTileSetModelConstructorOptions = {
            baseURL: template,
            url: template,
            layer: options.collection,
            tileMatrixSet: options.tileMatrix.id,
            tileMatrices: tileMatrices.map(m => m.id),
            format: options.format ? options.format : "image/png",
            requestEncoding: WMTSRequestEncoding.REST,
            structure,
            // Tiles can be missing inside the limits, do not stop refining at them
            isSparseTileSet: !!options.tileMatrixSetLimits,
            dataType: options.dataType,
            samplingMode: options.samplingMode,
            credentials: options.credentials,
            requestHeaders: options.requestHeaders ? options.requestHeaders : {},
        }
        super(o);
        this.tileGrid = tileGrid;
        this.ogcTemplate = options.baseURL;
        this.ogcTileMatrices = tileMatrices;
        this.tileMatrixSetLimits = options.tileMatrixSetLimits;
        this.transparent = typeof options.transparent !== "undefined" ? options.transparent : true;
        this.bgcolor = options.bgcolor;

        this.proxy = options.proxify;

        this.modelDescriptor = {
            source: options.baseURL,
            name: options.collection,
            description: "OGC Open API Tiles",
            type: this.dataType
        };
    }

    getTileURL(baseURL: string, tile: TileCoordinate): string | null {
        //  return this.debugAsImage(tile)
        if (!this.hasData(tile)) return null;
        const targetUrl = this.tileGrid ?
            OgcOpenApiTileMatrixTools.resolveTileTemplate(this.ogcTemplate, this.tileGrid, tile) :
            super.getTileURL(baseURL, tile);
        if (targetUrl === null) return null;
        let tileUrl = OgcOpenApiTileMatrixTools.appendQueryParameters(targetUrl, {
            transparent: this.transparent,
            bgcolor: this.transparent ? undefined : this.bgcolor
        });
        if (typeof this.proxy === "function") {
            const proxyfied = this.proxy(tileUrl, {});
            tileUrl = proxyfied.url;
        }
        return tileUrl
    }

    // Whether the tile is inside the tileMatrixSetLimits, all tiles are when there are no limits
    private hasData(tile: TileCoordinate) {
        if (!this.tileMatrixSetLimits) return true;
        const tileMatrix = this.ogcTileMatrices[tile.level];
        if (!tileMatrix) return false;
        const limits = this.tileMatrixSetLimits.find(l => l.tileMatrix === tileMatrix.id);
        const tileRow = tileMatrix.matrixHeight - 1 - tile.y;
        return !!limits &&
            tileRow >= limits.minTileRow && tileRow <= limits.maxTileRow &&
            tile.x >= limits.minTileCol && tile.x <= limits.maxTileCol;
    }

    // Reads the levels of the model that LuciadRIA's WMTS support created, as a quad-tree structure when they are one
    private static getTileStructure(wmts: WMTSTileSetModel, tileSet: TileSetData): WmtsTileStructure {
        const levels: TileMatrix[] = [];
        for (let level = 0; level < wmts.levelCount; level++) {
            levels.push({
                bounds: wmts.getBounds(level),
                tileColumnCount: wmts.getTileColumnCount(level),
                tileRowCount: wmts.getTileRowCount(level),
                tileWidth: wmts.getTileWidth(level),
                tileHeight: wmts.getTileHeight(level),
            });
        }
        // The OGC tile matrix of each level, in order and with the same number of columns and rows
        const tileMatrices: { id: string, matrixHeight: number }[] = [];
        let next = 0;
        for (const level of levels) {
            while (next < tileSet.tileMatrices.length &&
            (tileSet.tileMatrices[next].matrixWidth !== level.tileColumnCount || tileSet.tileMatrices[next].matrixHeight !== level.tileRowCount)) next++;
            if (next >= tileSet.tileMatrices.length) throw new Error("The tile matrices of " + tileSet.id + " do not match the WMTS levels");
            tileMatrices.push({id: tileSet.tileMatrices[next].id, matrixHeight: tileSet.tileMatrices[next].matrixHeight});
            next++;
        }
        const first = levels[0];
        const isQuadTree = levels.every((level, l) =>
            level.tileColumnCount === first.tileColumnCount * Math.pow(2, l) &&
            level.tileRowCount === first.tileRowCount * Math.pow(2, l) &&
            level.tileWidth === first.tileWidth && level.tileHeight === first.tileHeight &&
            level.bounds.equals(first.bounds));
        // A quad-tree structure also works on a Canvas map, a structure per level only on a WebGL map
        const structure = isQuadTree ? {
            reference: wmts.reference,
            bounds: first.bounds,
            levelCount: levels.length,
            level0Columns: first.tileColumnCount,
            level0Rows: first.tileRowCount,
            tileWidth: first.tileWidth,
            tileHeight: first.tileHeight,
        } : {
            reference: wmts.reference,
            bounds: first.bounds,
            tileMatrix: levels,
        };
        return {structure, tileMatrices};
    }

    debugAsImage(tileCorrected: TileCoordinate) {
        const canvas = document.createElement('canvas');
        if (canvas) {
            canvas.width = this.getTileWidth(tileCorrected.level) as number;
            canvas.height = this.getTileHeight(tileCorrected.level) as number;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.font = "30px Arial";
                ctx.fillText(`x:${tileCorrected.x}, y:${tileCorrected.y}, z:${tileCorrected.level}`, 10, canvas.height/2);
            }
            const dataURL = canvas.toDataURL();
            return dataURL;
        }
        return null;
    }

}

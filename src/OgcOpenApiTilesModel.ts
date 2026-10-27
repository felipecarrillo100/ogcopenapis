import {UrlTileSetModel, URLTileSetModelConstructorOptions} from "@luciad/ria/model/tileset/UrlTileSetModel";
import {RasterDataType} from "@luciad/ria/model/tileset/RasterDataType";
import {RasterSamplingMode} from "@luciad/ria/model/tileset/RasterSamplingMode";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {ProxifyFunction, TileSetData} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiTileGrid, OgcOpenApiTileMatrixTools} from "./OgcOpenApiTileMatrixTools";


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

export class OgcOpenApiTilesModel extends UrlTileSetModel {
    private tileGrid: OgcOpenApiTileGrid;
    private transparent: boolean;
    private bgcolor: string | undefined;
    private proxy: ProxifyFunction;

    constructor(options: OgcOpenApiTilesModelOptions) {
        const tileGrid = OgcOpenApiTileMatrixTools.createTileGrid(options.tileMatrix);
        const o: URLTileSetModelConstructorOptions = {
            baseURL: options.baseURL,
            structure: {
                reference: tileGrid.reference,
                bounds: tileGrid.bounds,
                levelCount: tileGrid.levelCount,
                level0Columns: tileGrid.level0Columns,
                level0Rows: tileGrid.level0Rows,
                tileWidth: tileGrid.tileWidth,
                tileHeight: tileGrid.tileHeight,
            },
            dataType: options.dataType,
            samplingMode: options.samplingMode,
            credentials: options.credentials,
            requestHeaders: options.requestHeaders ? options.requestHeaders : {},
        }
        super(o);
        this.tileGrid = tileGrid;
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
        const targetUrl = OgcOpenApiTileMatrixTools.resolveTileTemplate(baseURL, this.tileGrid, tile);
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

import {UrlTileSetModel, URLTileSetModelConstructorOptions} from "@luciad/ria/model/tileset/UrlTileSetModel";
import {Bounds} from "@luciad/ria/shape/Bounds";
import {RasterDataType} from "@luciad/ria/model/tileset/RasterDataType";
import {RasterSamplingMode} from "@luciad/ria/model/tileset/RasterSamplingMode";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createBounds} from "@luciad/ria/shape/ShapeFactory";
import {OgcOpenApiCrsTools} from "./OgcOpenApiCrsTools";
import {TileSetData} from "./OgcOpenApiGetCapabilities";


export interface OgcOpenApiTilesModelOptions {
    tileMatrix: TileSetData;
    baseURL: string;
    collection: string;
    format?: string;
    dataType?: RasterDataType;
    samplingMode?: RasterSamplingMode;
    requestHeaders?: { [p: string]: string };
    // requestParameters?: { [parameterName: string]: string | number | boolean | null | undefined } | null;
}

export class OgcOpenApiTilesModel extends UrlTileSetModel {
    private tileMatrix: TileSetData;
    private invertY: boolean;
    private format: string;
    private requestParameters: { [p: string]: string | number | boolean | null | undefined };

    constructor(options: OgcOpenApiTilesModelOptions) {
        const crsName = OgcOpenApiCrsTools.getReferenceName(options.tileMatrix.crs);
        const reference = getReference(crsName);
        const levelCount = options.tileMatrix.tileMatrices.filter((t)=>Number(t.id)>-1).length;
        let invertY = true;

        let axisX = 0;
        let axisY = 1;

        const orderedAxes0 = options.tileMatrix.orderedAxes[0].toUpperCase();
        if (orderedAxes0 === "LAT" || orderedAxes0 === "N" || orderedAxes0 === "S") {
            axisX = 1;
            axisY = 0;
        }

        console.log(reference.axisInformation)

        //const tm0 = options.tileMatrix.tileMatrices.find(t=>Number(t.id)===0);
        const tm0 = options.tileMatrix.tileMatrices[0];
        const calculated = {
            tileWidth: 256,
            tileHeight: 256,
        }
        let bounds;
        if (options.tileMatrix.boundingBox && options.tileMatrix.boundingBox.lowerLeft &&options.tileMatrix.boundingBox.upperRight) {
            bounds = createBounds(reference, [
                options.tileMatrix.boundingBox.lowerLeft[1], options.tileMatrix.boundingBox.upperRight[1]-options.tileMatrix.boundingBox.lowerLeft[1],
                options.tileMatrix.boundingBox.lowerLeft[0], options.tileMatrix.boundingBox.upperRight[0]-options.tileMatrix.boundingBox.lowerLeft[0],
            ]);
        }

        let level0Columns = 1;
        let level0Rows = 1;
        let tileHeight = 256;
        let tileWidth = 256;
        if (tm0) {
            const cornerOfOrigin = tm0.cornerOfOrigin ? tm0.cornerOfOrigin : "TOPLEFT";
            calculated.tileWidth = tm0.tileWidth;
            calculated.tileHeight = tm0.tileHeight;
            level0Rows = tm0.matrixHeight;
            level0Columns = tm0.matrixWidth;
            tileHeight = tm0.tileHeight;
            tileWidth = tm0.tileHeight;

            bounds =  bounds ? bounds : (reference as any).bounds;
            if (cornerOfOrigin.toUpperCase() === "TOPLEFT"){
                invertY = true
               // bounds = bounds ? bounds : createBounds(reference, [tm0.pointOfOrigin[axisX],tm0.matrixWidth, tm0.pointOfOrigin[axisY]-tm0.matrixHeight, tm0.matrixHeight])
            }
            else {
                invertY = false
                //bounds = bounds ? bounds : createBounds(reference, [tm0.pointOfOrigin[axisX],tm0.matrixWidth, tm0.pointOfOrigin[axisY], tm0.matrixHeight])
            }
        }

        const o: URLTileSetModelConstructorOptions = {
            baseURL: options.baseURL,
            reference: reference,
            bounds: bounds as Bounds,
            tileHeight,
            tileWidth,
            levelCount: levelCount,
            level0Columns,
            level0Rows,
            dataType: options.dataType,
            samplingMode: options.samplingMode,
            requestHeaders: options.requestHeaders ? options.requestHeaders : {},
        }
        super(o);
        this.format = options.format ? options.format : "image/png"

            this.invertY = invertY;
        this.tileMatrix = options.tileMatrix;
        this.modelDescriptor = {
            source: options.baseURL,
            name: options.collection,
            description: "OGC Open API Tiles",
            type: super.dataType
        };
    }

    getTileURL(baseURL: string, tile: TileCoordinate): string | null {
        const tileCorrected = {...tile};
        const maxY = Math.pow(2, tile.level) - 1;
        tileCorrected.y = this.invertY ? maxY - tile.y : tile.y;
        const zoomLevel = this.tileMatrix.tileMatrices.find(t=>Number(t.id) === tile.level);
        const level = zoomLevel ? zoomLevel.id : tile.level.toString();

        const targetUrl = baseURL.replace("{tileMatrix}",level).replace("{tileRow}", tileCorrected.y.toString()).replace("{tileCol}", tileCorrected.x.toString());
        return targetUrl;
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

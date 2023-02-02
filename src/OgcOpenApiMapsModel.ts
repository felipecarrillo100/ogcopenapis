import {RasterDataType} from "@luciad/ria/model/tileset/RasterDataType";
import {RasterSamplingMode} from "@luciad/ria/model/tileset/RasterSamplingMode";
import {WMSTileSetModel} from "@luciad/ria/model/tileset/WMSTileSetModel";
import {OgcOpenApiCrsTools} from "./OgcOpenApiCrsTools";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";

interface OgcOpenApiMapsModelConstructorOptions {
    crs: string;
    baseURL: string;
    collection: string;
    dataType?: RasterDataType;
    samplingMode?: RasterSamplingMode;
    requestHeaders?: { [p: string]: string };
    format?: string;
    // To be implemented
    reverseAxis?: boolean;
    datetime?: string;
    subset?: string[];
    transparent?: boolean;
    bgcolor?: string;
}

class OgcOpenApiMapsModel extends WMSTileSetModel {
    public static REVERSED_PPROJECTIONS = ["EPSG:4269", "EPSG:4326", "EPSG:4267"];

    private format: string | undefined;
    private crs: string;
    private reverseAxis: boolean | undefined;

    constructor(o: OgcOpenApiMapsModelConstructorOptions) {
        const referenceName = OgcOpenApiCrsTools.getReferenceName(o.crs)
        const reference = getReference(referenceName);
        super({
            reference,
            getMapRoot: o.baseURL,
            layers: [o.collection],
            dataType: o.dataType,
            samplingMode: o.samplingMode,
            requestHeaders: o.requestHeaders
        });
        this.crs = o.crs;
        this.format = o.format;
        this.reverseAxis = o.reverseAxis;
        this.modelDescriptor = {
            source: o.baseURL,
            name: o.collection,
            description: "OGC Open API Maps",
            type: super.dataType
        };
    }

    public static isReversedProjection(projection:string) {
        return OgcOpenApiMapsModel.REVERSED_PPROJECTIONS.includes(projection)
    }


    public swapAxes(match: any, x1: any, y1:any, x2:any, y2:any) {
        return "BBOX=" + y1 + "," + x1 + "," + y2 + "," + x2;
    }

    getTileURL(baseURL: string, tile: TileCoordinate): string | null {
        let aURL = super.getTileURL(baseURL, tile);
        if (aURL) {
            const parts = aURL.split("?");
            const queryString = parts.length>1 ? parts[1] : "";
            const url = parts[0];
            const urlParams = new URLSearchParams(queryString);
            const bbox = urlParams.get('BBOX');

            // let transformedUrl =  bbox ? url + `?bbox=${newBbox}&crs=${this.crs}` : url;
            let transformedUrl =  bbox ? url + `?bbox=${bbox}&crs=${this.crs}&bbox-crs=${this.crs}` : url;
            if (this.format) transformedUrl += "&f="+this.format;
            return transformedUrl;
        } else {
            return aURL
        }
    }

}

export {
    OgcOpenApiMapsModel
}
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
    reverseAxis?: boolean;
    datetime?: string;
    subset?: string[];
    transparent?: boolean;
    bgcolor?: string;
}

class OgcOpenApiMapsModel extends WMSTileSetModel {
    public static REVERSED_PPROJECTIONS = ["EPSG:4269"];

    private format: string | undefined;
    private crs: string;
    private reverseAxis: boolean | undefined;
    private datetime: string | undefined;
    private subset: string[] | undefined;
    private bgcolor: string | undefined;

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

        this.datetime = o.datetime;
        this.subset = o.subset;
        this.transparent = typeof o.transparent !== "undefined" ? o.transparent : true;
        this.bgcolor = o.bgcolor;

        this.modelDescriptor = {
            source: o.baseURL,
            name: o.collection,
            description: "OGC Open API Maps",
            type: super.dataType
        };
    }

    getTileURL(baseURL: string, tile: TileCoordinate): string | null {
        let aURL = super.getTileURL(baseURL, tile);
        if (aURL) {
            const parts = aURL.split("?");
            const queryString = parts.length>1 ? parts[1] : "";
            const url = parts[0];
            const urlParams = new URLSearchParams(queryString);
            const bbox = urlParams.get('BBOX');
            const urlParameters = {
                bbox:bbox,
                "bbox-crs":this.crs,
                crs:this.crs,
                f: this.format,
                datetime: this.datetime,
                subset: this.subset,
                transparent: this.transparent,
                bgcolor: this.transparent ? undefined : this.bgcolor
            }
            const query = OgcOpenApiMapsModel.createURLParameters(urlParameters);
            const transformedUrl = url + "?" + query;
            return transformedUrl;
        } else {
            return aURL
        }
    }

    private static createURLParameters(obj:{[key:string]: any}) {
        let str = Object.keys(obj).filter(k=>obj[k]!==undefined).map(function(key) {
            if(Array.isArray(obj[key])) {
                return key + '=' + obj[key].join(",")
            }
            if (typeof obj[key] == "boolean") {
                return key + '=' + (obj[key]?"true":"false")
            }
            return key + '=' + obj[key];
        }).join('&');
        return str
    }

}

export {
    OgcOpenApiMapsModel
}
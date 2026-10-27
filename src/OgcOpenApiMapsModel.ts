import {RasterDataType} from "@luciad/ria/model/tileset/RasterDataType";
import {RasterSamplingMode} from "@luciad/ria/model/tileset/RasterSamplingMode";
import {WMSTileSetModel} from "@luciad/ria/model/tileset/WMSTileSetModel";
import {OgcOpenApiCrsTools} from "./OgcOpenApiCrsTools";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {Bounds} from "@luciad/ria/shape/Bounds";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference";
import {createBounds} from "@luciad/ria/shape/ShapeFactory";
import {ProxifyFunction} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiTileMatrixTools} from "./OgcOpenApiTileMatrixTools";

// Half the extent of the Web Mercator world, in metres
const WEB_MERCATOR_HALF_WORLD = 20037508.3427892;

interface OgcOpenApiMapsModelConstructorOptions {
    crs: string;
    baseURL: string;
    collection: string;
    dataType?: RasterDataType;
    samplingMode?: RasterSamplingMode;
    credentials?: boolean;
    requestHeaders?: { [p: string]: string };
    format?: string;
    reverseAxis?: boolean;
    datetime?: string;
    subset?: string[];
    transparent?: boolean;
    bgcolor?: string;
    // The extent that is tiled, defaults to the Web Mercator world for EPSG:3857
    bounds?: Bounds;

    proxify?: ProxifyFunction
}

class OgcOpenApiMapsModel extends WMSTileSetModel {
    private format: string | undefined;
    private crs: string;
    private reverseAxis: boolean | undefined;
    private datetime: string | undefined;
    private subset: string[] | undefined;
    private bgcolor: string | undefined;
    private proxy: ProxifyFunction;
    // The query of the map link, such as f=png: servers advertise the f values they accept
    private linkParameters: { [key: string]: string };

    constructor(o: OgcOpenApiMapsModelConstructorOptions) {
        const referenceName = OgcOpenApiCrsTools.getReferenceName(o.crs)
        const reference = getReference(referenceName);
        super({
            reference,
            bounds: o.bounds ? o.bounds : OgcOpenApiMapsModel.getDefaultBounds(reference),
            getMapRoot: o.baseURL,
            layers: [o.collection],
            dataType: o.dataType,
            samplingMode: o.samplingMode,
            credentials: o.credentials,
            requestHeaders: o.requestHeaders
        });
        this.crs = o.crs;
        this.format = o.format;
        this.reverseAxis = o.reverseAxis;

        this.datetime = o.datetime;
        this.subset = o.subset;
        this.transparent = typeof o.transparent !== "undefined" ? o.transparent : true;
        this.bgcolor = o.bgcolor;

        this.proxy = o.proxify;
        this.linkParameters = OgcOpenApiMapsModel.getQueryParameters(o.baseURL);

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
                ...this.linkParameters,
                bbox:bbox,
                "bbox-crs":this.crs,
                crs:this.crs,
                f: this.format ? this.format : this.linkParameters.f,
                datetime: this.datetime ,
                subset: this.subset ? this.subset.join(",") : undefined,
                transparent: this.transparent,
                bgcolor: this.transparent ? undefined : this.bgcolor
            }
            let transformedUrl = OgcOpenApiTileMatrixTools.appendQueryParameters(url, urlParameters);
            if (typeof this.proxy === "function") {
                const proxyfied = this.proxy(transformedUrl, {});
                transformedUrl = proxyfied.url;
            }
            return transformedUrl;
        } else {
            return aURL
        }
    }

    private static getQueryParameters(url: string) {
        const parameters: { [key: string]: string } = {};
        const query = url.split("?")[1];
        if (query) new URLSearchParams(query).forEach((value, key) => parameters[key] = value);
        return parameters;
    }

    // The reference's own bounds for EPSG:3857 are a little larger than the Web Mercator world (y up to 20048966),
    // tiles cover exactly the Web Mercator world instead, the same bounds as LuciadRIA's OSM tiles
    private static getDefaultBounds(reference: CoordinateReference): Bounds | undefined {
        if (reference.identifier !== "EPSG:3857" && reference.identifier !== "EPSG:900913") return undefined;
        return createBounds(reference, [-WEB_MERCATOR_HALF_WORLD, 2 * WEB_MERCATOR_HALF_WORLD, -WEB_MERCATOR_HALF_WORLD, 2 * WEB_MERCATOR_HALF_WORLD]);
    }

}

export {
    OgcOpenApiMapsModel
}
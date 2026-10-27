import {WMTSCapabilities} from "@luciad/ria/model/capabilities/WMTSCapabilities.js";
import {WMTSRequestEncoding} from "@luciad/ria/model/tileset/WMTSRequestEncoding.js";
import {CoordinateType} from "@luciad/ria/reference/CoordinateType.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {OgcOpenApiCrsTools} from "./OgcOpenApiCrsTools.js";
import type {TileMatrixLimits, TileSetData} from "./OgcOpenApiGetCapabilities.js";

/**
 * Describes an OGC API tileset as a WMTS 1.0 layer, so that LuciadRIA's WMTS support reads its tile matrix set:
 * quad-trees and tile matrix sets that are not quad-trees, with their tile matrix limits.
 */
export interface OgcOpenApiWmtsLayer {
    layer: string;
    tileMatrix: TileSetData;
    // The OGC API tile URL template, with {tileMatrix}, {tileRow} and {tileCol}
    template: string;
    format: string;
    tileMatrixSetLimits?: TileMatrixLimits[];
    // The data extent in CRS:84, [minX, minY, maxX, maxY]
    extent?: number[];
}

// Meters per degree at the equator, to derive a scale denominator from the cell size of a geographic tile matrix set
const METERS_PER_DEGREE = 2 * Math.PI * 6378137 / 360;
// The standardized rendering pixel size of WMTS, 0.28 mm
const PIXEL_SIZE = 0.00028;

class OgcOpenApiWmtsTools {

    /**
     * WMTS uses {TileMatrix}, {TileRow} and {TileCol} where OGC API Tiles uses {tileMatrix}, {tileRow} and {tileCol}
     */
    public static toWmtsTemplate(template: string) {
        return template.replace("{tileMatrix}", "{TileMatrix}").replace("{tileRow}", "{TileRow}").replace("{tileCol}", "{TileCol}");
    }

    // http://www.opengis.net/def/crs/EPSG/0/3857 becomes urn:ogc:def:crs:EPSG::3857
    public static toCrsUrn(crs: string) {
        const match = /^https?:\/\/www\.opengis\.net\/def\/crs\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(crs.replace(/[<>]/g, "").trim());
        if (!match) return crs;
        const [, authority, version, code] = match;
        return "urn:ogc:def:crs:" + authority + ":" + (version === "0" ? "" : version) + ":" + code;
    }

    public static toCapabilitiesXml(description: OgcOpenApiWmtsLayer): string {
        const tileSet = description.tileMatrix;
        const isGeographic = getReference(OgcOpenApiCrsTools.getReferenceName(tileSet.crs)).coordinateType === CoordinateType.GEODETIC;
        const matrices = tileSet.tileMatrices.map(m => {
            const scaleDenominator = typeof m.scaleDenominator === "number" ? m.scaleDenominator :
                m.cellSize * (isGeographic ? METERS_PER_DEGREE : 1) / PIXEL_SIZE;
            return "<TileMatrix>" +
                OgcOpenApiWmtsTools.element("ows:Identifier", m.id) +
                OgcOpenApiWmtsTools.element("ScaleDenominator", scaleDenominator) +
                // Both pointOfOrigin and TopLeftCorner are in the axis order of the CRS
                OgcOpenApiWmtsTools.element("TopLeftCorner", m.pointOfOrigin[0] + " " + m.pointOfOrigin[1]) +
                OgcOpenApiWmtsTools.element("TileWidth", m.tileWidth) +
                OgcOpenApiWmtsTools.element("TileHeight", m.tileHeight) +
                OgcOpenApiWmtsTools.element("MatrixWidth", m.matrixWidth) +
                OgcOpenApiWmtsTools.element("MatrixHeight", m.matrixHeight) +
                "</TileMatrix>";
        }).join("");
        const limits = description.tileMatrixSetLimits && description.tileMatrixSetLimits.length > 0 ?
            "<TileMatrixSetLimits>" + description.tileMatrixSetLimits.map(l => "<TileMatrixLimits>" +
                OgcOpenApiWmtsTools.element("TileMatrix", l.tileMatrix) +
                OgcOpenApiWmtsTools.element("MinTileRow", l.minTileRow) +
                OgcOpenApiWmtsTools.element("MaxTileRow", l.maxTileRow) +
                OgcOpenApiWmtsTools.element("MinTileCol", l.minTileCol) +
                OgcOpenApiWmtsTools.element("MaxTileCol", l.maxTileCol) +
                "</TileMatrixLimits>").join("") + "</TileMatrixSetLimits>" : "";
        const extent = description.extent && description.extent.length >= 4 ?
            "<ows:WGS84BoundingBox>" +
            OgcOpenApiWmtsTools.element("ows:LowerCorner", description.extent[0] + " " + description.extent[1]) +
            OgcOpenApiWmtsTools.element("ows:UpperCorner", description.extent[2] + " " + description.extent[3]) +
            "</ows:WGS84BoundingBox>" : "";
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">' +
            "<ows:ServiceIdentification><ows:Title>OGC API Tiles</ows:Title><ows:ServiceType>OGC WMTS</ows:ServiceType>" +
            "<ows:ServiceTypeVersion>1.0.0</ows:ServiceTypeVersion></ows:ServiceIdentification>" +
            "<Contents><Layer>" +
            OgcOpenApiWmtsTools.element("ows:Title", description.layer) +
            OgcOpenApiWmtsTools.element("ows:Identifier", description.layer) +
            extent +
            '<Style isDefault="true"><ows:Identifier>default</ows:Identifier></Style>' +
            OgcOpenApiWmtsTools.element("Format", description.format) +
            "<TileMatrixSetLink>" + OgcOpenApiWmtsTools.element("TileMatrixSet", tileSet.id) + limits + "</TileMatrixSetLink>" +
            '<ResourceURL format="' + OgcOpenApiWmtsTools.escape(description.format) + '" resourceType="tile" template="' +
            OgcOpenApiWmtsTools.escape(OgcOpenApiWmtsTools.toWmtsTemplate(description.template)) + '"/>' +
            "</Layer><TileMatrixSet>" +
            OgcOpenApiWmtsTools.element("ows:Identifier", tileSet.id) +
            OgcOpenApiWmtsTools.element("ows:SupportedCRS", OgcOpenApiWmtsTools.toCrsUrn(tileSet.crs)) +
            matrices +
            "</TileMatrixSet></Contents></Capabilities>";
    }

    /**
     * LuciadRIA's WMTSCapabilities for the tileset. The document is passed as a data URL, so it is not requested.
     */
    public static createCapabilities(description: OgcOpenApiWmtsLayer): Promise<WMTSCapabilities> {
        const url = "data:application/xml;charset=utf-8," + encodeURIComponent(OgcOpenApiWmtsTools.toCapabilitiesXml(description));
        return WMTSCapabilities.fromURL(url, {preferredRequestEncoding: WMTSRequestEncoding.REST});
    }

    private static element(name: string, value: string | number) {
        return "<" + name + ">" + OgcOpenApiWmtsTools.escape(String(value)) + "</" + name + ">";
    }

    private static escape(value: string) {
        return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}

export {
    OgcOpenApiWmtsTools
}

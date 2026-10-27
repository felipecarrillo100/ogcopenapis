import {Bounds} from "@luciad/ria/shape/Bounds";
import {CoordinateReference} from "@luciad/ria/reference/CoordinateReference";
import {TileCoordinate} from "@luciad/ria/model/tileset/TileCoordinate";
import {getReference} from "@luciad/ria/reference/ReferenceProvider";
import {createBounds} from "@luciad/ria/shape/ShapeFactory";
import {OgcOpenApiCrsTools} from "./OgcOpenApiCrsTools";
import {OgcOpenApiGetCapabilities, TileMatrix, TileSetData} from "./OgcOpenApiGetCapabilities";

/**
 * The part of an OGC TileMatrixSet that LuciadRIA can address as a quad-tree:
 * LuciadRIA level 0 maps to tileMatrices[levelOffset].
 */
export interface OgcOpenApiTileGrid {
    reference: CoordinateReference;
    bounds: Bounds;
    levelOffset: number;
    levelCount: number;
    level0Columns: number;
    level0Rows: number;
    tileWidth: number;
    tileHeight: number;
    tileMatrices: TileMatrix[];
}

class OgcOpenApiTileMatrixTools {

    public static createTileGrid(tileSet: TileSetData): OgcOpenApiTileGrid {
        if (!tileSet.tileMatrices || tileSet.tileMatrices.length === 0) {
            throw new Error("TileMatrixSet " + tileSet.id + " has no tileMatrices");
        }
        const reference = getReference(OgcOpenApiCrsTools.getReferenceName(tileSet.crs));
        const levelOffset = OgcOpenApiGetCapabilities.getQuadTreeCompatibleLevelOffset(tileSet);
        const tileMatrices = tileSet.tileMatrices.slice(levelOffset);
        const tm0 = tileMatrices[0];
        return {
            reference,
            bounds: OgcOpenApiTileMatrixTools.getTileMatrixBounds(reference, tileSet, tm0),
            levelOffset,
            levelCount: tileMatrices.length,
            level0Columns: tm0.matrixWidth,
            level0Rows: tm0.matrixHeight,
            tileWidth: tm0.tileWidth,
            tileHeight: tm0.tileHeight,
            tileMatrices
        };
    }

    /**
     * Resolves {tileMatrix}, {tileRow} and {tileCol} for a LuciadRIA tile. LuciadRIA counts rows
     * bottom-up, OGC counts them from the cornerOfOrigin (topLeft by default).
     */
    public static resolveTileTemplate(template: string, grid: OgcOpenApiTileGrid, tile: TileCoordinate): string | null {
        const ogcTile = OgcOpenApiTileMatrixTools.getOgcTile(grid, tile);
        if (ogcTile === null) return null;
        return template
            .replace("{tileMatrix}", ogcTile.tileMatrix)
            .replace("{tileRow}", ogcTile.tileRow.toString())
            .replace("{tileCol}", ogcTile.tileCol.toString());
    }

    public static getOgcTile(grid: OgcOpenApiTileGrid, tile: TileCoordinate): { tileMatrix: string, tileRow: number, tileCol: number } | null {
        const tileMatrix = grid.tileMatrices[tile.level];
        if (!tileMatrix) return null;
        const tileRow = OgcOpenApiTileMatrixTools.isBottomLeft(tileMatrix) ? tile.y : tileMatrix.matrixHeight - 1 - tile.y;
        return {tileMatrix: tileMatrix.id, tileRow, tileCol: tile.x};
    }

    // The inverse of getOgcTile, null when the tile matrix is not part of the grid
    public static getLuciadTile(grid: OgcOpenApiTileGrid, tileMatrixId: string, tileRow: number, tileCol: number): TileCoordinate | null {
        const level = grid.tileMatrices.findIndex(m => m.id === tileMatrixId);
        if (level < 0) return null;
        const tileMatrix = grid.tileMatrices[level];
        const y = OgcOpenApiTileMatrixTools.isBottomLeft(tileMatrix) ? tileRow : tileMatrix.matrixHeight - 1 - tileRow;
        return {level, x: tileCol, y};
    }

    public static appendQueryParameters(url: string, parameters: { [key: string]: string | number | boolean | undefined }): string {
        const query = Object.keys(parameters)
            .filter(k => parameters[k] !== undefined && parameters[k] !== null)
            .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(String(parameters[k])))
            .join("&");
        if (query === "") return url;
        return url + (url.indexOf("?") > -1 ? "&" : "?") + query;
    }

    private static isBottomLeft(tileMatrix: TileMatrix) {
        return typeof tileMatrix.cornerOfOrigin === "string" && tileMatrix.cornerOfOrigin.toUpperCase() === "BOTTOMLEFT";
    }

    // The grid extent follows from the origin and cell size, pointOfOrigin is given in orderedAxes order.
    private static getTileMatrixBounds(reference: CoordinateReference, tileSet: TileSetData, tileMatrix: TileMatrix): Bounds {
        const swap = OgcOpenApiTileMatrixTools.isFirstAxisNorthing(tileSet.orderedAxes);
        const originX = tileMatrix.pointOfOrigin[swap ? 1 : 0];
        const originY = tileMatrix.pointOfOrigin[swap ? 0 : 1];
        const width = tileMatrix.cellSize * tileMatrix.tileWidth * tileMatrix.matrixWidth;
        const height = tileMatrix.cellSize * tileMatrix.tileHeight * tileMatrix.matrixHeight;
        const minY = OgcOpenApiTileMatrixTools.isBottomLeft(tileMatrix) ? originY : originY - height;
        return createBounds(reference, [originX, width, minY, height]);
    }

    private static isFirstAxisNorthing(orderedAxes: string[] | undefined) {
        if (!orderedAxes || orderedAxes.length === 0) return false;
        const axis = orderedAxes[0].toUpperCase();
        return axis === "LAT" || axis === "N" || axis === "S";
    }
}

export {
    OgcOpenApiTileMatrixTools
}

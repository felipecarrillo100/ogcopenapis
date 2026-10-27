import {TileSetLayer} from "./OgcOpenApiGetCapabilities";

/**
 * Reads the layers of a Mapbox Vector Tile: their names, and the geometryDimension of their features (0 points,
 * 1 lines, 2 surfaces). Only what is needed to style a tileset that does not describe its layers.
 * See https://github.com/mapbox/vector-tile-spec/blob/master/2.1/README.md
 */
const LAYER = 3;
const LAYER_NAME = 1;
const LAYER_FEATURE = 2;
const FEATURE_TYPE = 3;
// MVT GeomType POINT, LINESTRING, POLYGON
const GEOMETRY_DIMENSION = {1: 0, 2: 1, 3: 2};

const WIRE_VARINT = 0;
const WIRE_64BIT = 1;
const WIRE_LENGTH = 2;
const WIRE_32BIT = 5;

interface Field {
    field: number;
    value: number | Uint8Array;
}

class OgcOpenApiMvtTools {

    /**
     * The layers of a tile, a layer has geometryDimension when all its features have the same geometry type.
     * The tile may be gzip compressed.
     */
    public static async getLayers(content: ArrayBuffer): Promise<TileSetLayer[]> {
        const bytes = await OgcOpenApiMvtTools.decompress(new Uint8Array(content));
        const layers: TileSetLayer[] = [];
        for (const layer of OgcOpenApiMvtTools.readFields(bytes)) {
            if (layer.field !== LAYER || typeof layer.value === "number") continue;
            let id: string | undefined;
            const dimensions = new Set<number>();
            for (const property of OgcOpenApiMvtTools.readFields(layer.value)) {
                if (property.field === LAYER_NAME && typeof property.value !== "number") {
                    id = new TextDecoder().decode(property.value);
                } else if (property.field === LAYER_FEATURE && typeof property.value !== "number") {
                    for (const feature of OgcOpenApiMvtTools.readFields(property.value)) {
                        if (feature.field === FEATURE_TYPE && typeof feature.value === "number" && feature.value in GEOMETRY_DIMENSION) {
                            dimensions.add(GEOMETRY_DIMENSION[feature.value]);
                        }
                    }
                }
            }
            if (id !== undefined && dimensions.size > 0) {
                layers.push(dimensions.size === 1 ? {id, geometryDimension: dimensions.values().next().value} : {id});
            }
        }
        return layers;
    }

    private static async decompress(bytes: Uint8Array): Promise<Uint8Array> {
        if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
        // DecompressionStream is in all current browsers and Node 18, not yet in the TypeScript 4.6 DOM types
        const DecompressionStreamClass = (globalThis as any).DecompressionStream;
        if (!DecompressionStreamClass) throw new Error("A gzip compressed vector tile needs DecompressionStream");
        const stream = new Response(bytes).body.pipeThrough(new DecompressionStreamClass("gzip"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // The fields of a protobuf message, nested messages are returned as bytes
    private static* readFields(bytes: Uint8Array): Generator<Field> {
        let position = 0;
        const readVarint = () => {
            let result = 0;
            let shift = 0;
            let byte: number;
            do {
                if (position >= bytes.length) throw new Error("Invalid vector tile");
                byte = bytes[position++];
                result += (byte & 0x7f) * Math.pow(2, shift);
                shift += 7;
            } while (byte >= 0x80);
            return result;
        };
        while (position < bytes.length) {
            const key = readVarint();
            const field = Math.floor(key / 8);
            const wireType = key % 8;
            if (wireType === WIRE_VARINT) {
                yield {field, value: readVarint()};
            } else if (wireType === WIRE_LENGTH) {
                const length = readVarint();
                if (position + length > bytes.length) throw new Error("Invalid vector tile");
                yield {field, value: bytes.subarray(position, position + length)};
                position += length;
            } else if (wireType === WIRE_64BIT) {
                position += 8;
            } else if (wireType === WIRE_32BIT) {
                position += 4;
            } else {
                throw new Error("Invalid vector tile");
            }
        }
    }
}

export {
    OgcOpenApiMvtTools
}

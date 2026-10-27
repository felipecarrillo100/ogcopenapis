import {WebGLMap} from "@luciad/ria/view/WebGLMap.js";
import {Layer} from "@luciad/ria/view/Layer.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {LoadSpatially} from "@luciad/ria/view/feature/loadingstrategy/LoadSpatially.js";
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {MapboxVectorTileSetLayer} from "@luciad/ria/view/mapbox/MapboxVectorTileSetLayer.js";
import {MapboxStyle} from "@luciad/ria/view/mapbox/MapboxStyle.js";
import {MapboxVectorTileSetModel} from "@luciad/ria/model/tileset/mapbox/MapboxVectorTileSetModel.js";
import {UrlTileSetModel} from "@luciad/ria/model/tileset/UrlTileSetModel.js";
import {LayerType} from "@luciad/ria/view/LayerType.js";
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {createBounds} from "@luciad/ria/shape/ShapeFactory.js";
import {Bounds} from "@luciad/ria/shape/Bounds.js";

import {
    CollectionLinkType,
    CollectionTileSet,
    CollectionTileSetInfo,
    OgcOpenApiCapabilitiesCollection,
    OgcOpenApiCapabilitiesObject,
    OgcOpenApiGetCapabilities,
    TileSetData
} from "ogcopenapis/OgcOpenApiGetCapabilities";
import {OgcOpenApiFeatureStore} from "ogcopenapis/OgcOpenApiFeatureStore";
import {OgcOpenApiMapsModel} from "ogcopenapis/OgcOpenApiMapsModel";
import {OgcOpenApiTilesModel} from "ogcopenapis/OgcOpenApiTilesModel";
import {OgcOpenApiVectorTilesModel} from "ogcopenapis/OgcOpenApiVectorTilesModel";
import {OgcOpenApiStyle, OgcOpenApiStyleTools} from "ogcopenapis/OgcOpenApiStyleTools";
import {OgcOpenApiTileMatrixTools} from "ogcopenapis/OgcOpenApiTileMatrixTools";
import {OgcOpenApiCrsTools} from "ogcopenapis/OgcOpenApiCrsTools";
import {registerReferences} from "./references";

// What each server supports, as tested with this demo
const PRESETS = [
    {title: "OGC Daraa, ldproxy (features, vector tiles)", url: "https://demo.ldproxy.net/daraa/"},
    {title: "OGC Daraa, CubeWerx (features, maps, raster tiles, vector tiles)", url: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa/"},
    {title: "EuroRegionalMap, CubeWerx (maps, raster tiles)", url: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/"},
    {title: "Vineyards, ldproxy (features, vector tiles)", url: "https://demo.ldproxy.net/vineyards/"},
    {title: "OS Open Zoomstack, ldproxy (features)", url: "https://demo.ldproxy.net/zoomstack/"},
    {title: "pygeoapi demo (features, vector tiles)", url: "https://demo.pygeoapi.io/master/"},
    {title: "PDOK BGT (features, vector tiles of the dataset in RD)", url: "https://api.pdok.nl/lv/bgt/ogc/v1/"},
];

const GEOJSON = "application/geo+json";
const MVT = "application/vnd.mapbox-vector-tile";
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";
const GENERATED_STYLE = "__generated__";
// The collection option for the tilesets of the dataset, all collections in each tile
const DATASET = "__dataset__";

registerReferences();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const presetSelect = $<HTMLSelectElement>("preset");
const urlInput = $<HTMLInputElement>("url");
const typeSelect = $<HTMLSelectElement>("type");
const connectButton = $<HTMLButtonElement>("connect");
const collectionSelect = $<HTMLSelectElement>("collection");
const tmsSelect = $<HTMLSelectElement>("tms");
const styleSelect = $<HTMLSelectElement>("style");
const addButton = $<HTMLButtonElement>("add");
const statusLine = $<HTMLDivElement>("status");
const layerList = $<HTMLUListElement>("layers");

// wrapAroundWorld repeats the world across the dateline, it needs a cylindrical projection such as Web Mercator
const map = new WebGLMap($("map"), {reference: getReference("EPSG:3857"), wrapAroundWorld: true});

// OpenStreetMap basemap. LuciadRIA counts tile rows bottom-up, OSM top-down, hence {-y}.
const HALF_WORLD = 20037508.3427892;
const osmModel = new UrlTileSetModel({
    baseURL: "https://tile.openstreetmap.org/{z}/{x}/{-y}.png",
    structure: {
        reference: getReference("EPSG:3857"),
        bounds: createBounds(getReference("EPSG:3857"), [-HALF_WORLD, 2 * HALF_WORLD, -HALF_WORLD, 2 * HALF_WORLD]),
        level0Columns: 1,
        level0Rows: 1,
        levelCount: 20,
    },
});
const osmLayer = new RasterTileSetLayer(osmModel, {label: "OpenStreetMap", layerType: LayerType.BASE});
map.layerTree.addChild(osmLayer, "bottom");
// For experiments from the browser console
(window as any).map = map;
(window as any).demo = {
    MapboxVectorTileSetModel, MapboxVectorTileSetLayer, MapboxStyle, OgcOpenApiStyleTools, OgcOpenApiGetCapabilities, OgcOpenApiVectorTilesModel,
    // Fits the map to a square of size degrees around a point
    zoomTo: (lon: number, lat: number, size: number) => map.mapNavigator.fit({
        bounds: createBounds(getReference("CRS:84"), [lon - size / 2, size, lat - size / 2, size]), animate: false
    }),
};

let capabilities: OgcOpenApiCapabilitiesObject | null = null;
// All tile matrix sets of the server, and the tilesets of the selected collection with their tile matrix set
let tileMatrixSets: TileSetData[] = [];
let collectionTileSets: { tileSet: CollectionTileSetInfo, tileMatrix: TileSetData }[] = [];
let styles: OgcOpenApiStyle[] = [];

function setStatus(message: string, error = false) {
    statusLine.textContent = message;
    statusLine.classList.toggle("error", error);
    if (error) console.error(message);
}

function errorMessage(e: any) {
    return e && e.message ? e.message : typeof e === "string" || typeof e === "number" ? String(e) : "Request failed";
}

function fillSelect(select: HTMLSelectElement, options: { value: string, label: string, data?: Record<string, string> }[], selected?: string) {
    select.replaceChildren(...options.map(o => {
        const option = new Option(o.label, o.value, false, o.value === selected);
        Object.assign(option.dataset, o.data);
        return option;
    }));
    select.disabled = options.length === 0;
}

const linkType = () => typeSelect.value as CollectionLinkType;
const isTiled = () => linkType() === CollectionLinkType.Tiles || linkType() === CollectionLinkType.VectorTiles;
const selectedCollection = () => capabilities?.collections.find(c => c.id === collectionSelect.value);
const isDatasetSelected = () => collectionSelect.value === DATASET;
const hasSelection = () => isDatasetSelected() || !!selectedCollection();

function updateRows() {
    $("tmsRow").hidden = !isTiled();
    $("styleRow").hidden = linkType() !== CollectionLinkType.VectorTiles;
}

// Connecting, or selecting another collection, while the lists load starts again: only the latest request fills them
let listRequest = 0;
let listedRequest = 0;
const isListing = () => listedRequest !== listRequest;

async function connect() {
    const request = ++listRequest;
    capabilities = null;
    tileMatrixSets = [];
    collectionTileSets = [];
    styles = [];
    fillSelect(collectionSelect, []);
    fillSelect(tmsSelect, []);
    fillSelect(styleSelect, []);
    addButton.disabled = true;
    setStatus("Connecting...");
    try {
        const connected = await OgcOpenApiGetCapabilities.fromURL(urlInput.value, {filterCollectionsByLinkType: linkType()});
        const connectedTileMatrixSets = isTiled() ? await OgcOpenApiGetCapabilities.fetchTileSetsInFull(connected) : [];
        if (request !== listRequest) return;
        capabilities = connected;
        tileMatrixSets = connectedTileMatrixSets;
        const collections = [...capabilities.collections].sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
        // Some servers tile the dataset as a whole, all collections in each tile, and some only the dataset (PDOK)
        const dataset = isTiled() && OgcOpenApiGetCapabilities.hasDatasetTileSets(capabilities, linkType());
        // The collections are selectable once the tile matrix sets of the server are known
        fillSelect(collectionSelect, [
            ...(dataset ? [{value: DATASET, label: "All collections (dataset)"}] : []),
            ...collections.map(c => ({value: c.id, label: c.title || c.id}))
        ]);
        setStatus(collections.length + " collections" + (dataset ? ", and tiles of the dataset" : ""));
        await updateCollection();
    } catch (e) {
        if (request === listRequest) setStatus("Could not connect: " + errorMessage(e), true);
    }
}

// Only tile matrix sets in a known reference. Map tiles support any tile matrix set,
// vector tiles only the ones that LuciadRIA can address as a quad-tree
function isUsableTileMatrixSet(tileMatrixSet: TileSetData, type: CollectionLinkType) {
    try {
        const grid = OgcOpenApiTileMatrixTools.createTileGrid(tileMatrixSet);
        return type === CollectionLinkType.Tiles || grid.levelCount > 1;
    } catch (e) {
        console.info("Skipping tile matrix set " + tileMatrixSet.id + ": " + errorMessage(e));
        return false;
    }
}

// Adding a layer waits until the tile matrix sets and styles of the collection are listed
async function updateCollection() {
    const request = ++listRequest;
    addButton.disabled = true;
    await Promise.all([updateTileMatrixSets(request), updateStyles(request)]);
    if (request !== listRequest) return;
    listedRequest = request;
    fillStyleSelect();
    addButton.disabled = !hasSelection();
}

// Only the tile matrix sets the collection is tiled in, which can be fewer than the ones of the server.
// A collection can have several tilesets in one tile matrix set, so an option is a tileset: its self link.
async function updateTileMatrixSets(request: number) {
    collectionTileSets = [];
    fillSelect(tmsSelect, []);
    const collection = selectedCollection();
    if (!isTiled() || !hasSelection()) return;
    let tileSets: CollectionTileSetInfo[] = [];
    try {
        tileSets = collection ?
            await OgcOpenApiGetCapabilities.fetchCollectionTileSets(capabilities, collection, linkType()) :
            await OgcOpenApiGetCapabilities.fetchDatasetTileSets(capabilities, linkType());
    } catch (e) {
        if (request === listRequest) setStatus("Could not list the tilesets of " + (collection ? collection.id : "the dataset") + ": " + errorMessage(e), true);
        return;
    }
    const resolved = await Promise.all(tileSets.map(async tileSet => {
        try {
            const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(capabilities, tileSet, tileMatrixSets);
            return isUsableTileMatrixSet(tileMatrix, linkType()) ? {tileSet, tileMatrix} : null;
        } catch (e) {
            console.info("Skipping tileset " + tileSet.href + ": " + errorMessage(e));
            return null;
        }
    }));
    if (request !== listRequest) return;
    collectionTileSets = resolved.filter(t => t !== null);
    const webMercator = collectionTileSets.find(t => /WebMercatorQuad\/?$/.test(t.tileSet.tileMatrixSetURI || t.tileMatrix.id));
    fillSelect(tmsSelect, collectionTileSets.map(t => ({
        value: t.tileSet.href, label: t.tileMatrix.title || t.tileMatrix.id, data: {tileMatrixSet: t.tileMatrix.id}
    })), webMercator ? webMercator.tileSet.href : undefined);
}

function getSelectedTileSet() {
    const selected = collectionTileSets.find(t => t.tileSet.href === tmsSelect.value);
    if (!selected) throw new Error("The collection has no tileset in a supported tile matrix set");
    return selected;
}

// The styles of the collection, or of the dataset for its tilesets
async function updateStyles(request: number) {
    styles = [];
    fillSelect(styleSelect, []);
    if (linkType() !== CollectionLinkType.VectorTiles || !hasSelection()) return;
    let collectionStyles: OgcOpenApiStyle[] = [];
    try {
        collectionStyles = await OgcOpenApiStyleTools.fetchStyles(capabilities, isDatasetSelected() ? null : selectedCollection());
    } catch (e) {
        console.warn("No OGC API styles", e);
    }
    if (request !== listRequest) return;
    styles = collectionStyles;
}

// Only the styles for the selected tile matrix set, a server can have a style per tile matrix set
function fillStyleSelect() {
    if (linkType() !== CollectionLinkType.VectorTiles || !hasSelection()) {
        fillSelect(styleSelect, []);
        return;
    }
    const selected = collectionTileSets.find(t => t.tileSet.href === tmsSelect.value);
    const forTileMatrixSet = selected ?
        OgcOpenApiStyleTools.getStylesForTileMatrixSet(styles, selected.tileMatrix.id, collectionTileSets.map(t => t.tileMatrix.id)) :
        styles;
    fillSelect(styleSelect, [
        ...forTileMatrixSet.map(s => ({value: s.id, label: s.title})),
        {value: GENERATED_STYLE, label: "Generated default style"}
    ]);
}

// The tile models report the extent of the tile matrix set, so layers fit to the extent of their collection
const layerExtents = new Map<Layer, Bounds>();
const MIN_EXTENT = 0.01;

// The extent of a collection or tileset, in CRS:84 as [minX, minY, maxX, maxY]
function getExtentBounds(bbox: number[] | undefined): Bounds | null {
    if (!bbox || bbox.length < 4) return null;
    // A collection with a single point has an empty extent, which cannot be fitted
    const width = Math.max(bbox[2] - bbox[0], MIN_EXTENT);
    const height = Math.max(bbox[3] - bbox[1], MIN_EXTENT);
    return createBounds(getReference("CRS:84"), [(bbox[0] + bbox[2] - width) / 2, width, (bbox[1] + bbox[3] - height) / 2, height]);
}

// A FeatureLayer has no bounds until its first query finished, as in MapEvolution's fitToLayer
function getLayerBounds(layer: Layer): Promise<Bounds | null> {
    const bounds = layerExtents.get(layer) || (layer as any).bounds;
    if (bounds) return Promise.resolve(bounds);
    if (!(layer instanceof FeatureLayer)) return Promise.resolve(null);
    return new Promise(resolve => {
        const handle = layer.workingSet.on("QueryFinished", () => {
            handle.remove();
            resolve(layer.bounds ? layer.bounds : null);
        });
    });
}

async function zoomToLayer(layer: Layer) {
    const bounds = await getLayerBounds(layer);
    if (bounds) await map.mapNavigator.fit({bounds, animate: true}).catch(() => undefined);
}

// The extent of a tileset in CRS:84, when the server gives it
function getTileSetExtent(tileSet: CollectionTileSet): number[] | undefined {
    const box = tileSet.boundingBox;
    // Without a crs, the bounding box is in the CRS of the tile matrix set
    if (!box || !box.crs || !/CRS84$/.test(box.crs)) return undefined;
    return [box.lowerLeft[0], box.lowerLeft[1], box.upperRight[0], box.upperRight[1]];
}

// collection is undefined for the tiles of the dataset. Resolves the layer and its extent in CRS:84
async function createLayer(collection: OgcOpenApiCapabilitiesCollection | undefined): Promise<{ layer: Layer, extent?: number[] }> {
    const collectionExtent = collection ? collection.extent?.spatial?.bbox?.[0] : undefined;
    if (collection) return {layer: await createCollectionLayer(collection), extent: collectionExtent};
    const label = "All collections";
    const {tileSet: tileSetInfo, tileMatrix} = getSelectedTileSet();
    const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, null, tileSetInfo, {}, linkType());
    const extent = getTileSetExtent(tileSet);
    return {layer: await createTileLayer(tileSet, tileMatrix, "dataset", label, extent), extent};
}

async function createTileLayer(tileSet: CollectionTileSet, tileMatrix: TileSetData, id: string, label: string, extent?: number[]): Promise<Layer> {
    if (linkType() === CollectionLinkType.Tiles) {
        const link = tileSet.links.find(l => l.type === "image/png") || tileSet.links[0];
        const model = await OgcOpenApiTilesModel.createFromTileSet({
            tileMatrix,
            baseURL: link.href,
            collection: id,
            format: link.type && link.type.indexOf("image/") === 0 ? link.type : undefined,
            tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
            extent,
        });
        return new RasterTileSetLayer(model, {label});
    }
    const link = tileSet.links.find(l => l.type === MVT) || tileSet.links[0];
    const model = new OgcOpenApiVectorTilesModel({
        tileMatrix,
        baseURL: link.href,
        collection: id,
        tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
    });
    // Not all servers list the layers of a tileset, then they are read from the tiles
    const layers = tileSet.layers.length > 0 ? tileSet.layers : await model.discoverLayers({extent});
    const style = await createStyle(layers, tileMatrix.id, label);
    return new MapboxVectorTileSetLayer(model, {label, style});
}

async function createCollectionLayer(collection: OgcOpenApiCapabilitiesCollection): Promise<Layer> {
    const label = collection.title || collection.id;
    switch (linkType()) {
        case CollectionLinkType.Items: {
            const items = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Items);
            const link = items.find(l => l.type === GEOJSON) || items.find(l => l.type === "application/json") || items[0];
            const store = new OgcOpenApiFeatureStore({
                dataUrl: link.href,
                // The encoding of the link: GeoJSON, as application/geo+json or application/json
                outputFormat: link.type ? link.type : GEOJSON,
                codec: new GeoJsonCodec({generateIDs: false}),
                crs: CRS84,
                extent: collection.extent,
                useCrs84Bounds: true,
            });
            const model = new FeatureModel(store, {reference: getReference("CRS:84")});
            return new FeatureLayer(model, {label, selectable: true, loadingStrategy: new LoadSpatially()});
        }
        case CollectionLinkType.Map: {
            const maps = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Map);
            const link = maps.find(l => l.type === "image/png") || maps[0];
            // The reference of the map when the collection offers it, otherwise CRS84, which every server supports
            const crs = (collection.crs || []).find(c => OgcOpenApiCrsTools.getReferenceName(c) === map.reference.identifier) || CRS84;
            const model = new OgcOpenApiMapsModel({
                crs,
                // The link carries the f value the server accepts, such as f=png
                baseURL: link.href,
                collection: collection.id,
            });
            return new RasterTileSetLayer(model, {label});
        }
        case CollectionLinkType.Tiles:
        case CollectionLinkType.VectorTiles: {
            const {tileSet: tileSetInfo, tileMatrix} = getSelectedTileSet();
            const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileSetInfo, {}, linkType());
            return createTileLayer(tileSet, tileMatrix, collection.id, label, collection.extent?.spatial?.bbox?.[0]);
        }
    }
    throw new Error("Unsupported type " + linkType());
}

async function createStyle(layers, tileMatrixSetId: string, name: string) {
    const style = styles.find(s => s.id === styleSelect.value);
    if (style) {
        try {
            const stylesheet = OgcOpenApiStyleTools.pickStylesheet(style, tileMatrixSetId);
            return MapboxStyle.createFromObject(await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, stylesheet), {name: style.title});
        } catch (e) {
            setStatus("Style " + style.id + " could not be used (" + errorMessage(e) + "), using a generated style", true);
        }
    }
    return MapboxStyle.createFromObject(OgcOpenApiStyleTools.createDefaultStyle(layers, name));
}

function addToLayerList(layer: Layer) {
    const item = document.createElement("li");
    const visible = document.createElement("input");
    visible.type = "checkbox";
    visible.checked = true;
    visible.onchange = () => layer.visible = visible.checked;
    const name = document.createElement("span");
    name.textContent = layer.label;
    name.title = layer.label;
    const zoom = document.createElement("button");
    // Four arrows pointing to the corners
    zoom.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 6 2 2M2 5.5V2h3.5M10 6l4-4M10.5 2H14v3.5M6 10l-4 4M2 10.5V14h3.5M10 10l4 4M14 10.5V14h-3.5"/></svg>';
    zoom.title = "Zoom to layer";
    zoom.onclick = () => void zoomToLayer(layer);
    const remove = document.createElement("button");
    remove.textContent = "✕";
    remove.title = "Remove layer";
    remove.onclick = () => {
        map.layerTree.removeChild(layer);
        layerExtents.delete(layer);
        item.remove();
    };
    item.append(visible, name, zoom, remove);
    layerList.prepend(item);
}

async function addLayer() {
    if (!hasSelection()) return;
    const collection = selectedCollection();
    addButton.disabled = true;
    setStatus("Adding " + (collection ? collection.title || collection.id : "all collections") + "...");
    try {
        const {layer, extent} = await createLayer(collection);
        map.layerTree.addChild(layer);
        const bounds = getExtentBounds(extent);
        if (bounds) layerExtents.set(layer, bounds);
        addToLayerList(layer);
        void zoomToLayer(layer);
        setStatus("Added " + layer.label);
    } catch (e) {
        setStatus("Could not add the layer: " + errorMessage(e), true);
    } finally {
        addButton.disabled = isListing() || !hasSelection();
    }
}

fillSelect(presetSelect, PRESETS.map(p => ({value: p.url, label: p.title})));
urlInput.value = PRESETS[0].url;
presetSelect.onchange = () => urlInput.value = presetSelect.value;
typeSelect.onchange = () => {
    updateRows();
    void connect();
};
connectButton.onclick = () => void connect();
collectionSelect.onchange = () => void updateCollection();
tmsSelect.onchange = () => fillStyleSelect();
addButton.onclick = () => void addLayer();
updateRows();
addToLayerList(osmLayer);

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

// What each server supports, as tested with this demo
const PRESETS = [
    {title: "OGC Daraa, ldproxy (features, vector tiles)", url: "https://demo.ldproxy.net/daraa/"},
    {title: "OGC Daraa, CubeWerx (features, maps, raster tiles, vector tiles)", url: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/Daraa/"},
    {title: "EuroRegionalMap, CubeWerx (maps, raster tiles)", url: "https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/EuroRegionalMap/"},
    {title: "Vineyards, ldproxy (features, vector tiles)", url: "https://demo.ldproxy.net/vineyards/"},
    {title: "OS Open Zoomstack, ldproxy (features)", url: "https://demo.ldproxy.net/zoomstack/"},
    {title: "pygeoapi demo (features, vector tiles)", url: "https://demo.pygeoapi.io/master/"},
    {title: "PDOK BGT (features)", url: "https://api.pdok.nl/lv/bgt/ogc/v1/"},
];

const GEOJSON = "application/geo+json";
const MVT = "application/vnd.mapbox-vector-tile";
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";
const GENERATED_STYLE = "__generated__";

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
(window as any).demo = {MapboxVectorTileSetModel, MapboxVectorTileSetLayer, MapboxStyle, OgcOpenApiStyleTools, OgcOpenApiGetCapabilities, OgcOpenApiVectorTilesModel};

let capabilities: OgcOpenApiCapabilitiesObject | null = null;
let tileMatrixSets: TileSetData[] = [];
let styles: OgcOpenApiStyle[] = [];

function setStatus(message: string, error = false) {
    statusLine.textContent = message;
    statusLine.classList.toggle("error", error);
    if (error) console.error(message);
}

function errorMessage(e: any) {
    return e && e.message ? e.message : typeof e === "string" || typeof e === "number" ? String(e) : "Request failed";
}

function fillSelect(select: HTMLSelectElement, options: { value: string, label: string }[], selected?: string) {
    select.replaceChildren(...options.map(o => new Option(o.label, o.value, false, o.value === selected)));
    select.disabled = options.length === 0;
}

const linkType = () => typeSelect.value as CollectionLinkType;
const isTiled = () => linkType() === CollectionLinkType.Tiles || linkType() === CollectionLinkType.VectorTiles;
const selectedCollection = () => capabilities?.collections.find(c => c.id === collectionSelect.value);

function updateRows() {
    $("tmsRow").hidden = !isTiled();
    $("styleRow").hidden = linkType() !== CollectionLinkType.VectorTiles;
}

async function connect() {
    capabilities = null;
    fillSelect(collectionSelect, []);
    fillSelect(tmsSelect, []);
    fillSelect(styleSelect, []);
    addButton.disabled = true;
    setStatus("Connecting...");
    try {
        capabilities = await OgcOpenApiGetCapabilities.fromURL(urlInput.value, {filterCollectionsByLinkType: linkType()});
        const collections = [...capabilities.collections].sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
        fillSelect(collectionSelect, collections.map(c => ({value: c.id, label: c.title || c.id})));
        if (isTiled()) {
            tileMatrixSets = (await OgcOpenApiGetCapabilities.fetchTileSetsInFull(capabilities)).filter(t => isUsableTileMatrixSet(t, linkType()));
            fillSelect(tmsSelect, tileMatrixSets.map(t => ({value: t.id, label: t.title || t.id})), "WebMercatorQuad");
        }
        setStatus(collections.length + " collections");
        addButton.disabled = collections.length === 0;
        await updateStyles();
    } catch (e) {
        setStatus("Could not connect: " + errorMessage(e), true);
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

async function updateStyles() {
    styles = [];
    if (linkType() !== CollectionLinkType.VectorTiles || !selectedCollection()) return;
    fillSelect(styleSelect, [{value: GENERATED_STYLE, label: "Generated default style"}]);
    try {
        styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, selectedCollection());
    } catch (e) {
        console.warn("No OGC API styles", e);
    }
    fillSelect(styleSelect, [
        ...styles.map(s => ({value: s.id, label: s.title})),
        {value: GENERATED_STYLE, label: "Generated default style"}
    ]);
}

// The tile models report the extent of the tile matrix set, so layers fit to the extent of their collection
const layerExtents = new Map<Layer, Bounds>();
const MIN_EXTENT = 0.01;

function getCollectionBounds(collection: OgcOpenApiCapabilitiesCollection): Bounds | null {
    const bbox = collection.extent?.spatial?.bbox?.[0];
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

async function createLayer(collection: OgcOpenApiCapabilitiesCollection): Promise<Layer> {
    const label = collection.title || collection.id;
    switch (linkType()) {
        case CollectionLinkType.Items: {
            const items = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Items);
            const link = items.find(l => l.type === GEOJSON) || items.find(l => l.type === "application/json") || items[0];
            const store = new OgcOpenApiFeatureStore({
                dataUrl: link.href,
                outputFormat: GEOJSON,
                codec: new GeoJsonCodec({generateIDs: true}),
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
            const model = new OgcOpenApiMapsModel({
                crs: "http://www.opengis.net/def/crs/EPSG/0/3857",
                // The link carries the f value the server accepts, such as f=png
                baseURL: link.href,
                collection: collection.id,
            });
            return new RasterTileSetLayer(model, {label});
        }
        case CollectionLinkType.Tiles: {
            const tileMatrix = tileMatrixSets.find(t => t.id === tmsSelect.value);
            const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileMatrix.id, {}, CollectionLinkType.Tiles);
            const link = tileSet.links.find(l => l.type === "image/png") || tileSet.links[0];
            const model = await OgcOpenApiTilesModel.createFromTileSet({
                tileMatrix,
                baseURL: link.href,
                collection: collection.id,
                format: link.type && link.type.indexOf("image/") === 0 ? link.type : undefined,
                tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
                extent: collection.extent?.spatial?.bbox?.[0],
            });
            return new RasterTileSetLayer(model, {label});
        }
        case CollectionLinkType.VectorTiles: {
            const tileMatrix = tileMatrixSets.find(t => t.id === tmsSelect.value);
            const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileMatrix.id, {}, CollectionLinkType.VectorTiles);
            const link = tileSet.links.find(l => l.type === MVT) || tileSet.links[0];
            const model = new OgcOpenApiVectorTilesModel({
                tileMatrix,
                baseURL: link.href,
                collection: collection.id,
                tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
            });
            // Not all servers list the layers of a tileset, then they are read from the tiles
            const layers = tileSet.layers.length > 0 ? tileSet.layers : await model.discoverLayers({extent: collection.extent?.spatial?.bbox?.[0]});
            const style = await createStyle(layers, tileMatrix.id, label);
            return new MapboxVectorTileSetLayer(model, {label, style});
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
    const collection = selectedCollection();
    if (!collection) return;
    addButton.disabled = true;
    setStatus("Adding " + (collection.title || collection.id) + "...");
    try {
        const layer = await createLayer(collection);
        map.layerTree.addChild(layer);
        const bounds = getCollectionBounds(collection);
        if (bounds) layerExtents.set(layer, bounds);
        addToLayerList(layer);
        void zoomToLayer(layer);
        setStatus("Added " + layer.label);
    } catch (e) {
        setStatus("Could not add the layer: " + errorMessage(e), true);
    } finally {
        addButton.disabled = false;
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
collectionSelect.onchange = () => void updateStyles();
addButton.onclick = () => void addLayer();
updateRows();
addToLayerList(osmLayer);

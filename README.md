# OGC API for LuciadRIA

## Description
The ogcopenapis package provides OGC API functionalities to LuciadRIA applications.

Implements
* __OGC API - Features__
* __OGC API - Maps__
* __OGC API - Tiles__, map (raster) tiles and vector tiles, of collections and of the dataset
* __OGC API - Styles__, for vector tiles

The Main Components are:

* __OgcOpenApiGetCapabilities__: a helper to retrieve the capabilities of a server such as available collections, available formats, tilesets and tile matrix sets
* __OgcOpenApiFeatureStore__: a ready to use LuciadRIA store that retrieves features from an OGC API Features service
* __OgcOpenApiMapsModel__: a ready to use model that retrieves images from an OGC API Maps service
* __OgcOpenApiTilesModel__: a ready to use model that retrieves map tiles from an OGC API Tiles service
* __OgcOpenApiVectorTilesModel__: a ready to use model that retrieves vector tiles (Mapbox Vector Tiles) from an OGC API Tiles service
* __OgcOpenApiStyleTools__: a helper to retrieve OGC API Styles as Mapbox GL styles, or to generate a default style

And the helpers they share:

* __OgcOpenApiTileMatrixTools__: maps an OGC TileMatrixSet onto a LuciadRIA tile structure, shared by both tiles models
* __OgcOpenApiWmtsTools__: describes an OGC API tileset as a WMTS layer, for LuciadRIA's WMTS support
* __OgcOpenApiMvtTools__: reads the layers in a Mapbox Vector Tile
* __OgcOpenApiCrsTools__: converts OGC CRS URIs to LuciadRIA reference identifiers, `http://www.opengis.net/def/crs/EPSG/0/3857` to `EPSG:3857`
* __OgcOpenApiFetchTools__: the requests of all components, with URL completion and the proxify option

## To build
This is the source code that produces a library delivered as a npm package of native ES modules, in the `lib` folder,
with type declarations and source maps. To build the source code use the npm scripts:
```
npm install
npm run build
```
`build` runs `build:lib`, which compiles with `tsc` (TypeScript 5, `module: NodeNext`, target ES2020): one module per
source file, with the `.js` extensions that native ES modules need. LuciadRIA is never bundled: it is a peer dependency,
and every `@luciad/ria/...` import stays an import of the application's single copy.

Then you can publish the package to npm or other repository. `npm publish` first runs the tests and the package check.

## To test
The tests run in Node.js using Vitest, with jsdom as environment.

The default tests run offline, on fixtures in `src/fixtures` and `test/fixtures/servers`, with a mocked `fetch`:
```
npm run test
```

The servers the tests use are listed in `test/servers.ts`, with an example of each kind of data they serve (features, maps,
map tiles, vector tiles of a collection and of the dataset, and styles): pygeoapi (https://demo.pygeoapi.io/master/), ldproxy
(https://demo.ldproxy.net/), CubeWerx (https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/) and PDOK (https://api.pdok.nl/).
`npm run test` replays their recorded responses in `test/fixtures/servers`, and the live tests (`*.live.test.ts`) check that
the servers still answer as recorded:
```
npm run test:live
```
The servers are reliable and stable, but take into account that changes at a server may break some of these tests.
When a server changed, record its responses again:
```
npm run test:record
```
GNOSIS (https://maps.gnosis.earth/ogcapi/) is in the list but not tested: its `/collections` response is 9 MB, and its tiles need a login.

The package check builds and packs the package, and checks it as published: only `lib/`, the sources of its source
maps, README, CHANGELOG, LICENSE and package.json are in it, nothing of LuciadRIA; `lib/` imports only its own modules and
`@luciad/ria`; [publint](https://publint.dev) and [Are the Types Wrong](https://arethetypeswrong.github.io) find no
problems; and every module loads through the package exports, installed in a `node_modules` folder, by Node's own
ES module loader, as in the tests of an application:
```
npm run test:package
```

The browser tests run the demo in Chrome: for each test server and each kind of data, they add a layer and check that the
map paints it, without failed requests or page errors. They need the LuciadRIA license in `demo/license` (see
[demo/README.md](demo/README.md)) and Google Chrome, or another Chrome set with `CHROME_PATH`. `HEADED=1` shows the browser,
and screenshots are saved in `test/browser/screenshots`.
```
npm run test:browser
```
Layers that are not painted yet are marked with `knownIssue` in `test/servers.ts`, the browser tests expect them to fail.

## Demo
The `demo` folder contains a minimal page to open Features, Maps, Tiles and Vector Tiles collections, and the tiles of a
dataset, in a LuciadRIA map. It needs a LuciadRIA development license in `demo/license/luciadria_development.txt`, see
[demo/README.md](demo/README.md).
```
npm run demo
```

## To use in your project

Simply import the NPM package into your project, with LuciadRIA, its peer dependency:

```
npm install ogcopenapis @luciad/ria
```

The package is native ES modules. Import each component by its name, `ogcopenapis/OgcOpenApiFeatureStore` for
instance. The paths of version 0.0.12, `ogcopenapis/lib/OgcOpenApiFeatureStore`, still work.

### Capabilities
`fromURL` reads the landing page of a server and its collections, optionally only those with links of one type. Everything
the examples below need comes from these capabilities: links and their formats, extents, the CRSs a collection offers,
tilesets, tile matrix sets and styles. Nothing is configured by hand.
```typescript
import {CollectionLinkType, OgcOpenApiGetCapabilities} from "ogcopenapis/OgcOpenApiGetCapabilities";

const capabilities = await OgcOpenApiGetCapabilities.fromURL(serverUrl, {filterCollectionsByLinkType: CollectionLinkType.Items});
// The collections, as the server lists them: id, title, extent, crs and links
const collection = capabilities.collections.find(c => c.id === collectionId);
```
Links that are relative are resolved against the document that has them.

All components accept `credentials` and `requestHeaders` for their requests, and `proxify`, a function that rewrites each
request, for instance to send it through a proxy:
```typescript
const proxify = (url: string, fetchOptions: RequestInit) => ({url: "https://proxy.example.com/?url=" + encodeURIComponent(url), fetchOptions});
const capabilities = await OgcOpenApiGetCapabilities.fromURL(serverUrl, {proxify});
```

The examples below share these imports and constants:
```typescript
import type {Map} from "@luciad/ria/view/Map.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {
    CollectionLinkType, OgcOpenApiCapabilitiesCollection, OgcOpenApiCapabilitiesObject, OgcOpenApiGetCapabilities,
    CollectionTileSet, CollectionTileSetInfo, TileSetData
} from "ogcopenapis/OgcOpenApiGetCapabilities";
import {OgcOpenApiCrsTools} from "ogcopenapis/OgcOpenApiCrsTools";

const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";
```

### Features
OgcOpenApiFeatureStore implements a LuciadRIA store, to use with FeatureModel and FeatureLayer:
```typescript
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {LoadSpatially} from "@luciad/ria/view/feature/loadingstrategy/LoadSpatially.js";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {OgcOpenApiFeatureStore} from "ogcopenapis/OgcOpenApiFeatureStore";

function createFeatureLayer(collection: OgcOpenApiCapabilitiesCollection) {
    const items = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Items);
    // GeoJSON, the encoding that GeoJsonCodec reads. Not JSON-FG, which some servers also type application/geo+json
    const geoJson = items.filter(l => !OgcOpenApiGetCapabilities.isJsonFgLink(l));
    const link = geoJson.find(l => l.type === "application/geo+json") || geoJson.find(l => l.type === "application/json");
    if (!link) throw new Error("Collection " + collection.id + " has no GeoJSON items");
    // CRS84: OGC API Features requires every server to support it
    const crs = CRS84;
    const store = new OgcOpenApiFeatureStore({
        dataUrl: link.href,
        outputFormat: link.type,
        // The ids of the server: get(id) requests items/{id} with them
        codec: new GeoJsonCodec({generateIDs: false}),
        crs,
        extent: collection.extent,
        useCrs84Bounds: true,
    });
    const model = new FeatureModel(store, {reference: getReference(OgcOpenApiCrsTools.getReferenceName(crs))});
    return new FeatureLayer(model, {label: collection.title || collection.id, loadingStrategy: new LoadSpatially()});
}
```
The store requests the features in view, a query does not follow the `next` links of a response yet (no paging). It
keeps the parameters of the items link, such as `profile` or an api key, and encodes the values of its own.

JSON-FG (OGC Features and Geometries JSON) needs a JSON-FG codec, which LuciadRIA does not have yet. Servers offer it as
`application/vnd.ogc.fg+json`, or as `application/geo+json` with the JSON-FG profile (ldproxy); `isJsonFgLink` tells them
apart, and `outputFormats` of a collection reports JSON-FG as `application/vnd.ogc.fg+json`. To read JSON-FG, pass a
JSON-FG codec of your own to the store with that link.

Keep the ids of the server: `generateIDs: false`. Each feature of an OGC API Features collection has an id, `get(id)` of
the store requests `items/{id}` with it, and LuciadRIA updates only the features that changed when the ids stay the same
between queries. `generateIDs: true` replaces them with ids of its own on every query.

### Maps
OgcOpenApiMapsModel extends WMSTileSetModel, use it with a RasterTileSetLayer. It requests the map as tiles, in the
reference of the map when the collection offers it, otherwise in CRS84, which every server supports, and LuciadRIA
reprojects it:
```typescript
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {OgcOpenApiMapsModel} from "ogcopenapis/OgcOpenApiMapsModel";

function createMapLayer(map: Map, collection: OgcOpenApiCapabilitiesCollection) {
    const mapLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Map);
    // PNG, with transparency, when the server types its links. The link carries the f value the server accepts
    const link = mapLinks.find(l => l.type === "image/png") || mapLinks[0];
    if (!link) throw new Error("Collection " + collection.id + " has no map");
    const crs = (collection.crs || []).find(c => OgcOpenApiCrsTools.getReferenceName(c) === map.reference.identifier) || CRS84;
    const model = new OgcOpenApiMapsModel({crs, baseURL: link.href, collection: collection.id});
    return new RasterTileSetLayer(model, {label: collection.title || collection.id});
}
```

### Tilesets
Map tiles and vector tiles start from the tilesets: of a collection, or of the dataset (`collection` null), all its
collections in each tile. Each tileset is in one tile matrix set. Servers give tile matrix sets their own ids (CubeWerx
calls WebMercatorQuad `smerc`), `fetchTileMatrixSetOfTileSet` matches them by URI.
```typescript
import {OgcOpenApiTileMatrixTools} from "ogcopenapis/OgcOpenApiTileMatrixTools";

interface UsableTileSet {
    tileSet: CollectionTileSetInfo;
    tileMatrix: TileSetData;
}

// The tilesets that LuciadRIA can use, each with its tile matrix set. Left out: tile matrix sets in a reference that is
// not registered (see References below), and for vector tiles those that LuciadRIA cannot address as a quad-tree
async function fetchUsableTileSets(capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection | null, linkType: CollectionLinkType) {
    // fetchTileSetsInFull leaves out definitions that cannot be read, it rejects only when none can
    const tileMatrixSets = await OgcOpenApiGetCapabilities.fetchTileSetsInFull(capabilities);
    const tileSets = collection ?
        await OgcOpenApiGetCapabilities.fetchCollectionTileSets(capabilities, collection, linkType) :
        await OgcOpenApiGetCapabilities.fetchDatasetTileSets(capabilities, linkType);
    const usable = await Promise.all(tileSets.map(async (tileSet): Promise<UsableTileSet | null> => {
        try {
            const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(capabilities, tileSet, tileMatrixSets);
            const grid = OgcOpenApiTileMatrixTools.createTileGrid(tileMatrix);
            return linkType === CollectionLinkType.VectorTiles && grid.levelCount <= 1 ? null : {tileSet, tileMatrix};
        } catch (e) {
            return null;
        }
    }));
    return usable.filter(t => t !== null);
}

// The tileset in the reference of the map, which needs no reprojection, otherwise the first one
function pickTileSet(map: Map, tileSets: UsableTileSet[]) {
    if (tileSets.length === 0) throw new Error("No tileset in a tile matrix set that LuciadRIA can use");
    return tileSets.find(t => OgcOpenApiCrsTools.getReferenceName(t.tileMatrix.crs) === map.reference.identifier) || tileSets[0];
}

// Where the data is, in CRS84 as [minX, minY, maxX, maxY]: the extent of the collection, or for the dataset the
// bounding box of the tileset, when the server gives them in CRS84
function getExtent(collection: OgcOpenApiCapabilitiesCollection | null, tileSet: CollectionTileSet): number[] | undefined {
    if (collection) {
        const spatial = collection.extent && collection.extent.spatial;
        return spatial && spatial.bbox && (!spatial.crs || /CRS84$/.test(spatial.crs)) ? spatial.bbox[0] : undefined;
    }
    const box = tileSet.boundingBox;
    return box && box.crs && /CRS84$/.test(box.crs) ? [...box.lowerLeft, ...box.upperRight] : undefined;
}
```

### Map tiles
OgcOpenApiTilesModel extends WMTSTileSetModel, use it with a RasterTileSetLayer. Create it with `createFromTileSet`: it
describes the tileset to LuciadRIA's WMTS support, which handles tile matrix sets that are quad-trees and tile matrix sets
that are not (such as GlobalCRS84Scale), and it does not request tiles outside the `tileMatrixSetLimits`:
```typescript
import {OgcOpenApiTilesModel} from "ogcopenapis/OgcOpenApiTilesModel";

async function createTileLayer(map: Map, capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection | null) {
    const {tileSet: tileSetInfo, tileMatrix} = pickTileSet(map, await fetchUsableTileSets(capabilities, collection, CollectionLinkType.Tiles));
    const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileSetInfo, {}, CollectionLinkType.Tiles);
    // PNG, with transparency, when the server types its links
    const link = tileSet.links.find(l => l.type === "image/png") || tileSet.links[0];
    const model = await OgcOpenApiTilesModel.createFromTileSet({
        tileMatrix,
        baseURL: link.href,
        collection: collection ? collection.id : "dataset",
        format: link.type && link.type.indexOf("image/") === 0 ? link.type : undefined,
        tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
        extent: getExtent(collection, tileSet),
    });
    return new RasterTileSetLayer(model, {label: collection ? collection.title || collection.id : "All collections"});
}
```
The constructor `new OgcOpenApiTilesModel(options)` still works, but is deprecated: it supports quad-tree tile matrix sets only.

### Vector tiles
OgcOpenApiVectorTilesModel extends LuciadRIA's MapboxVectorTileSetModel, use it with a MapboxVectorTileSetLayer and a
MapboxStyle. The style is one of the server (OGC API Styles) for the tile matrix set in use, or a style generated from
the layers in the tiles when the server has none:
```typescript
import {MapboxVectorTileSetLayer} from "@luciad/ria/view/mapbox/MapboxVectorTileSetLayer.js";
import {MapboxStyle} from "@luciad/ria/view/mapbox/MapboxStyle.js";
import {OgcOpenApiVectorTilesModel} from "ogcopenapis/OgcOpenApiVectorTilesModel";
import {OgcOpenApiStyleTools} from "ogcopenapis/OgcOpenApiStyleTools";

async function createVectorTileLayer(map: Map, capabilities: OgcOpenApiCapabilitiesObject, collection: OgcOpenApiCapabilitiesCollection | null) {
    const tileSets = await fetchUsableTileSets(capabilities, collection, CollectionLinkType.VectorTiles);
    const {tileSet: tileSetInfo, tileMatrix} = pickTileSet(map, tileSets);
    const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileSetInfo, {}, CollectionLinkType.VectorTiles);
    // Mapbox Vector Tiles, the vector tile encoding LuciadRIA reads
    const link = tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile") || tileSet.links.find(l => !l.type);
    if (!link) throw new Error("The tileset has no Mapbox Vector Tiles");
    const label = collection ? collection.title || collection.id : "All collections";
    const model = new OgcOpenApiVectorTilesModel({
        tileMatrix,
        baseURL: link.href,
        collection: collection ? collection.id : "dataset",
        tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
    });
    // The styles of the collection, or of the dataset, for this tile matrix set. An application can let the user pick one
    const styles = OgcOpenApiStyleTools.getStylesForTileMatrixSet(
        await OgcOpenApiStyleTools.fetchStyles(capabilities, collection), tileMatrix.id, tileSets.map(t => t.tileMatrix.id));
    let styleJson;
    if (styles.length > 0) {
        styleJson = await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, OgcOpenApiStyleTools.pickStylesheet(styles[0], tileMatrix.id));
    } else {
        // The layers in the tiles: from the tileset, or read from a few tiles where the data is
        const layers = tileSet.layers.length > 0 ? tileSet.layers : await model.discoverLayers({extent: getExtent(collection, tileSet)});
        styleJson = OgcOpenApiStyleTools.createDefaultStyle(layers, label);
    }
    return new MapboxVectorTileSetLayer(model, {label, style: MapboxStyle.createFromObject(styleJson)});
}
```

### Tiles of the dataset
Some servers tile the dataset as a whole, with all its collections in each tile, and some only the dataset (PDOK).
The tilesets and styles of the dataset are linked from the landing page. The functions above take `null` for them:
```typescript
if (OgcOpenApiGetCapabilities.hasDatasetTileSets(capabilities, CollectionLinkType.VectorTiles)) {
    map.layerTree.addChild(await createVectorTileLayer(map, capabilities, null));
}
```

The tiles of the dataset can hold only some of its collections, when the server supports the `collections` parameter
(OGC API Tiles, collections selection). Both tiles models take them as `collections`:
```typescript
if (OgcOpenApiGetCapabilities.supportsCollectionSelection(capabilities)) {
    const model = new OgcOpenApiVectorTilesModel({
        tileMatrix,
        baseURL: link.href,
        collection: "dataset",
        tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
        // The ids of the collections, as capabilities.collections lists them
        collections: ["abschnitteaeste"],
    });
}
```
* `supportsCollectionSelection` reads the conformance classes of the server (`capabilities.conformsTo`): the class of the
  standard, `http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collections-selection` (OGC 20-057, Table 7).
* It also accepts `http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/collection-selection`, a name that is not in the
  standard: ldproxy declares the class so, and supports the parameter as the standard requires.
  `COLLECTIONS_SELECTION_CONFORMANCE_VARIANTS` lists it, to be removed once ldproxy declares the class of the standard.
* The models do not check the conformance classes: they request the collections they are given. Use `collections` for
  tilesets of the dataset only, the tiles of a collection hold that collection.
* A comma inside a collection id is encoded, the commas between ids are not. A `collections` parameter in the tile URL
  template is replaced.

### Styles
* LuciadRIA reads the Mapbox GL encoding of OGC API Styles only, not SLD or other encodings.
* A server can publish a stylesheet per tile matrix set, because zoom levels depend on it. `pickStylesheet` picks the one for the tile matrix set in use.
* A server can also publish a style per tile matrix set, named after it (PDOK: `bgt_standaardvisualisatie__netherlandsrdnewquad`).
  `getStylesForTileMatrixSet` leaves out the styles named after another tile matrix set.
* `fetchMapboxStyle` removes properties without a value (`"filter" : ,`), so that styles that are not valid JSON can still be used.
* `createDefaultStyle` paints points, lines and surfaces by the `geometryDimension` of the layers, without labels.
* Not all servers list the layers of a tileset (CubeWerx, pygeoapi and PDOK do not), and the names of the layers in the tiles
  differ per server: ldproxy and CubeWerx name the layer of a collection after it, pygeoapi after its source data.
  `discoverLayers` of the vector tiles model reads them from a few tiles where the data is.

### References
LuciadRIA reprojects tiles and features to the reference of the map, but it knows only some EPSG references by default.
LuciadRIA 2026.1.1 does not know the references of five of the tile matrix sets of the OGC standard (UTM31WGS84Quad EPSG:32631,
UPSArcticWGS84Quad EPSG:5041, UPSAntarcticWGS84Quad EPSG:5042, EuropeanETRS89_LAEAQuad EPSG:3035 and CanadianNAD83_LCC EPSG:3978),
nor of PDOK's NetherlandsRDNewQuad (EPSG:28992). The library does not register references itself: register the ones your
servers use before creating a model, as the demo does in [demo/src/references.ts](demo/src/references.ts):

```typescript
import {addReference, parseWellKnownText} from "@luciad/ria/reference/ReferenceProvider.js";

addReference(parseWellKnownText('PROJCS["RD",GEOGCS["Amersfoort", ...]]'), "EPSG:28992");
```

Applications that load references on demand, such as MapEvolution with `requireReference` and `retryOnUnknownReference`,
need nothing more. When a reference is unknown, the models throw LuciadRIA's own `UnknownIdentifierError` with its
identifier (`EPSG:3035`), so the reference can be loaded and the model created again:
```typescript
import {OgcOpenApiCrsTools} from "ogcopenapis/OgcOpenApiCrsTools";

// Before listing tile matrix sets: load their references, so that none is left out because its reference is not loaded yet
await Promise.all(tileMatrixSets.map(t => requireReference(OgcOpenApiCrsTools.getReferenceName(t.crs)).catch(() => undefined)));
// When creating a model: a tile matrix set fetched later can bring another reference
const model = await retryOnUnknownReference(() => OgcOpenApiTilesModel.createFromTileSet(options));
// The vector tiles model is created synchronously, an async wrapper lets the same retry apply
const vectorModel = await retryOnUnknownReference(async () => new OgcOpenApiVectorTilesModel(vectorOptions));
```
`getReferenceName` turns `http://www.opengis.net/def/crs/EPSG/0/28992` into `EPSG:28992`, the identifier to load.
It does not convert the `https://` form of those URIs, nor a CRS given as an object (`{uri}` or `{wkt}`, allowed by
OGC 2D Tile Matrix Set 2.0): none of the test servers uses them in a tile matrix set.

The axis order of a reference matters for raster tiles: EPSG:3035 is northing first. Its WKT should declare that with
`AXIS["Northing",NORTH],AXIS["Easting",EAST]`, as the EPSG definitions in LuciadRIA's sample data (`epsg_coord_ref.txt`,
which MapEvolution uses) do. The WKT of epsg.io that the demo uses has no `AXIS`, which is enough for vector tiles only.

### Notes
* Map tiles support any tile matrix set of LuciadRIA's WMTS support. Vector tiles support only tile matrix sets that
  LuciadRIA can address as a quad-tree, LuciadRIA's vector tile structure is a quad-tree.
* Tile matrix sets with a bottomLeft corner of origin are not in WMTS 1.0, `createFromTileSet` supports them as quad-trees only.
* `variableMatrixWidths` (coalesced tile matrices) is not supported.
* A tileset can include its tile matrix set instead of linking it, `fetchTileMatrixSetOfTileSet` uses it then.
* Levels that are not in the `tileMatrixSetLimits` of a tileset have no tiles. PDOK tiles BGT at one level only,
  RD level 12: nothing shows until the map is zoomed in to about 1 m per pixel, and LuciadRIA over-zooms beyond it.
* LuciadRIA 2026.1.1 paints nothing for a vector tiles model with `minLevel > 0`. OgcOpenApiVectorTilesModel therefore starts at
  level 0, and does not request tiles outside the `tileMatrixSetLimits` of the tileset.
* LuciadRIA 2026.1.1 does not paint Mapbox `circle` layers. The default style draws points as a text symbol for that reason.

## Changes
See [CHANGELOG.md](CHANGELOG.md) for the changes of each version.

## Requirements
* LuciadRIA 2026.1 or higher, a peer dependency that the application installs (place it on a local npm repository,
  for instance verdaccio)
* A bundler or runtime for ES modules and ES2020, such as Vite or webpack. TypeScript projects need
  `moduleResolution` `bundler`, `node16` or `nodenext`, which read the `exports` of the package.

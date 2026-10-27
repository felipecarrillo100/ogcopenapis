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
This is the source code that produces a library delivered as a npm package, in the `lib` folder.
To build the source code use the npm scripts:
```
npm install
npm run build
```
Then you can publish the package to npm or other repository.

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

Simply import the NPM package into your project

```
npm install ogcopenapis
```

### Capabilities
`fromURL` reads the landing page of a server and its collections, optionally only those with links of one type:
```typescript
import {CollectionLinkType, OgcOpenApiGetCapabilities} from "ogcopenapis/lib/OgcOpenApiGetCapabilities";

const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://demo.pygeoapi.io/master/", {filterCollectionsByLinkType: CollectionLinkType.Items});
const collection = capabilities.collections.find(c => c.id === "lakes");
```
Links that are relative are resolved against the document that has them.

All components accept `credentials` and `requestHeaders` for their requests, and `proxify`, a function that rewrites each
request, for instance to send it through a proxy:
```typescript
const proxify = (url: string, fetchOptions: RequestInit) => ({url: "https://proxy.example.com/?url=" + encodeURIComponent(url), fetchOptions});
const capabilities = await OgcOpenApiGetCapabilities.fromURL(serverUrl, {proxify});
```

### Features
OgcOpenApiFeatureStore implements a LuciadRIA store, to use with FeatureModel and FeatureLayer:
```typescript
import {FeatureModel} from "@luciad/ria/model/feature/FeatureModel.js";
import {FeatureLayer} from "@luciad/ria/view/feature/FeatureLayer.js";
import {LoadSpatially} from "@luciad/ria/view/feature/loadingstrategy/LoadSpatially.js";
import {GeoJsonCodec} from "@luciad/ria/model/codec/GeoJsonCodec.js";
import {getReference} from "@luciad/ria/reference/ReferenceProvider.js";
import {OgcOpenApiFeatureStore} from "ogcopenapis/lib/OgcOpenApiFeatureStore";

const items = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Items);
const store = new OgcOpenApiFeatureStore({
    dataUrl: items.find(l => l.type === "application/geo+json").href,
    outputFormat: "application/geo+json",
    codec: new GeoJsonCodec({generateIDs: true}),
    crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
    extent: collection.extent,
    useCrs84Bounds: true,
});
const model = new FeatureModel(store, {reference: getReference("CRS:84")});
map.layerTree.addChild(new FeatureLayer(model, {label: collection.title, loadingStrategy: new LoadSpatially()}));
```
The store requests the features in view, a query does not follow the `next` links of a response yet (no paging).

### Maps and map tiles
For maps and map tiles use OgcOpenApiMapsModel and OgcOpenApiTilesModel. OgcOpenApiMapsModel extends WMSTileSetModel
and OgcOpenApiTilesModel extends WMTSTileSetModel, so you use them in combination with RasterTileSetLayer.

OgcOpenApiMapsModel requests the map as tiles. The map link carries the `f` value the server accepts, such as `f=png`:
```typescript
import {RasterTileSetLayer} from "@luciad/ria/view/tileset/RasterTileSetLayer.js";
import {OgcOpenApiMapsModel} from "ogcopenapis/lib/OgcOpenApiMapsModel";

const mapLinks = OgcOpenApiGetCapabilities.filterCollectionLinks(collection.links, CollectionLinkType.Map);
const mapsModel = new OgcOpenApiMapsModel({
    crs: "http://www.opengis.net/def/crs/EPSG/0/3857",
    baseURL: (mapLinks.find(l => l.type === "image/png") || mapLinks[0]).href,
    collection: collection.id,
});
map.layerTree.addChild(new RasterTileSetLayer(mapsModel, {label: collection.title}));
```

Create OgcOpenApiTilesModel with `createFromTileSet`. It describes the tileset to LuciadRIA's WMTS support, which handles
tile matrix sets that are quad-trees and tile matrix sets that are not (such as GlobalCRS84Scale), and it does not request
tiles outside the `tileMatrixSetLimits`. The tilesets and tile matrix sets are found as for vector tiles, below:
```typescript
import {OgcOpenApiTilesModel} from "ogcopenapis/lib/OgcOpenApiTilesModel";

const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileSetInfo, {}, CollectionLinkType.Tiles);
const model = await OgcOpenApiTilesModel.createFromTileSet({
    tileMatrix,
    baseURL: tileSet.links.find(l => l.type === "image/png").href,
    collection: collection.id,
    tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
    extent: collection.extent.spatial.bbox[0],
});
map.layerTree.addChild(new RasterTileSetLayer(model, {label: collection.title}));
```
The constructor `new OgcOpenApiTilesModel(options)` still works, but is deprecated: it supports quad-tree tile matrix sets only.
Look at the LuciadRIA documentation if you need further information on using RasterTileSetLayer.

### Vector tiles
For vector tiles use OgcOpenApiVectorTilesModel. It extends LuciadRIA's MapboxVectorTileSetModel, so you use it in combination with
MapboxVectorTileSetLayer and a MapboxStyle:
```typescript
import {MapboxVectorTileSetLayer} from "@luciad/ria/view/mapbox/MapboxVectorTileSetLayer.js";
import {MapboxStyle} from "@luciad/ria/view/mapbox/MapboxStyle.js";
import {CollectionLinkType, OgcOpenApiGetCapabilities} from "ogcopenapis/lib/OgcOpenApiGetCapabilities";
import {OgcOpenApiVectorTilesModel} from "ogcopenapis/lib/OgcOpenApiVectorTilesModel";
import {OgcOpenApiStyleTools} from "ogcopenapis/lib/OgcOpenApiStyleTools";

const capabilities = await OgcOpenApiGetCapabilities.fromURL("https://demo.ldproxy.net/daraa/", {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
const collection = capabilities.collections.find(c => c.id === "TransportationGroundCrv");

// The tilesets of the collection: the tile matrix sets it is tiled in, which can be fewer than the ones of the server.
// Servers give tile matrix sets their own ids (CubeWerx calls WebMercatorQuad smerc), they are matched by URI.
// fetchTileSetsInFull leaves out definitions that cannot be read, it rejects only when none can
const tileMatrixSets = await OgcOpenApiGetCapabilities.fetchTileSetsInFull(capabilities);
const tileSets = await OgcOpenApiGetCapabilities.fetchCollectionTileSets(capabilities, collection, CollectionLinkType.VectorTiles);
const webMercator = tileSets.find(t => /WebMercatorQuad\/?$/.test(t.tileMatrixSetURI));
const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(capabilities, webMercator, tileMatrixSets);
const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, webMercator, {}, CollectionLinkType.VectorTiles);

const model = new OgcOpenApiVectorTilesModel({
    tileMatrix,
    baseURL: tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile").href,
    collection: collection.id,
    tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
});

// A style of the server (OGC API Styles), or a default style when the server has none.
// The default style needs the layers in the tiles: from the tileset, or read from a few tiles when the tileset does not list them
const styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, collection);
const layers = tileSet.layers.length > 0 ? tileSet.layers : await model.discoverLayers({extent: collection.extent.spatial.bbox[0]});
const styleJson = styles.length > 0 ?
    await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, OgcOpenApiStyleTools.pickStylesheet(styles[0], tileMatrix.id)) :
    OgcOpenApiStyleTools.createDefaultStyle(layers);

map.layerTree.addChild(new MapboxVectorTileSetLayer(model, {label: collection.title, style: MapboxStyle.createFromObject(styleJson)}));
```

### Tiles of the dataset
Some servers tile the dataset as a whole, with all its collections in each tile, and some only the dataset (PDOK).
The tilesets and styles of the dataset are linked from the landing page:

```typescript
if (OgcOpenApiGetCapabilities.hasDatasetTileSets(capabilities, CollectionLinkType.VectorTiles)) {
    const datasetTileSets = await OgcOpenApiGetCapabilities.fetchDatasetTileSets(capabilities, CollectionLinkType.VectorTiles);
    const tileMatrix = await OgcOpenApiGetCapabilities.fetchTileMatrixSetOfTileSet(capabilities, datasetTileSets[0], tileMatrixSets);
    // null instead of a collection: the tileset of the dataset
    const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, null, datasetTileSets[0], {}, CollectionLinkType.VectorTiles);
    // The styles of the dataset, only those for the tile matrix set in use
    const datasetStyles = OgcOpenApiStyleTools.getStylesForTileMatrixSet(
        await OgcOpenApiStyleTools.fetchStyles(capabilities, null), tileMatrix.id, [tileMatrix.id /* and the ids of the other tilesets */]);
}
```
A tileset of the dataset can have a `boundingBox`, where its data is. A collection has its `extent` instead.

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
import {OgcOpenApiCrsTools} from "ogcopenapis/lib/OgcOpenApiCrsTools";

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

## Changes in 1.0.0
Version 1.0.0 is a breaking change from 0.0.12:
* It requires LuciadRIA 2026.1 or higher.
* New: vector tiles (OgcOpenApiVectorTilesModel), OGC API Styles (OgcOpenApiStyleTools), the tilesets of a collection
  (`fetchCollectionTileSets`) and of the dataset (`fetchDatasetTileSets`).
* OgcOpenApiTilesModel uses LuciadRIA's WMTS support, create it with `createFromTileSet`. The constructor is deprecated.
* OgcOpenApiFeatureStore extends LuciadRIA's `Store`.
* `fetchTileSetsInFull` leaves out tile matrix sets whose definition cannot be read, instead of failing.
* Relative links are resolved against the document that has them, instead of the host of the server.

## Requirements
* LuciadRIA 2026.1 or higher (place it on a local npm repository, for instance verdaccio)
* An ES6 or TypeScript capable transpiler.

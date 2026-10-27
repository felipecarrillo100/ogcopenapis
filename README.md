# OGC OPEN API's prototype for LuciadRIA 

## Description
The ogcopenapis package provides OGC API functionalities to LuciadRIA Application.

Implements
* __Open API Features__ 
* __Open API Maps__ 
* __Open API Tiles__, map (raster) tiles and vector tiles
* __Open API Styles__, for vector tiles

The Main Components are:

* __OgcOpenApiFeatureStore__: a ready to use LuciadRIA Feature store capable to retrieve features from an OGC API Feature Service
* __OgcOpenApiMapsModel__:  a ready to use model capable to retrieve images from from an OGC API Maps Service
* __OgcOpenApiTilesModel__:  a ready to use model capable to retrieve map tiles from an OGC API Tiles Service
* __OgcOpenApiVectorTilesModel__:  a ready to use model capable to retrieve vector tiles (Mapbox Vector Tiles) from an OGC API Tiles Service
* __OgcOpenApiStyleTools__: a helper to retrieve the OGC API Styles of a collection as Mapbox GL styles, or to generate a default style
* __OgcOpenApiGetCapabilities__: a helper to retrieve the capabilities of a server such as available Collections, available Formats, tilesets and tile matrix sets
* __OgcOpenApiTileMatrixTools__: maps an OGC TileMatrixSet onto a LuciadRIA tile structure, shared by both tiles models



## To build
This is the source code that produces a library delivered as a npm package. 
To build the source code use the npm scripts:
```
npm install
npm run build
```
Then you can publish the package to npm or other repository

## To test
The tests run in nodejs using Vitest, with jsdom as environment.

The default tests run offline, on fixtures in `src/fixtures` and with a mocked `fetch`:
```
npm run test
```

The live tests (`*.live.test.ts`) use the sever-side implementations of OGC Open API from "https://demo.pygeoapi.io/master/", "https://demo.ldproxy.net/",
"https://test.cubewerx.com/cubewerx/cubeserv/demo/ogcapi/", "https://maps.gnosis.earth/ogcapi/" and "https://api.pdok.nl/":
```
npm run test:live
```
The servers are reliable and stable,  but take in t account that changes at the server may brake some of these tests.

The servers the tests use are listed in `test/servers.ts`, with an example of each kind of data they serve (features, maps,
map tiles, vector tiles and styles). `npm run test` replays their recorded responses in `test/fixtures/servers`, and
`npm run test:live` checks that the servers still answer as recorded. When a server changed, record its responses again:
```
npm run test:record
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
The `demo` folder contains a minimal page to open Features, Maps, Tiles and Vector Tiles collections in a LuciadRIA map.
It needs a LuciadRIA development license in `demo/license/luciadria_development.txt`, see [demo/README.md](demo/README.md).
```
npm run demo
```

## To use in your project

Simply import the NPM package into your project

```
npm install ogcopenapis
``` 

If you require the GetCapabilities functionality then import: 
```typescript
import {
    CollectionLinkType, OgcOpenApiCapabilitiesCollection,
    OgcOpenApiCapabilitiesCollectionServiceLinkType,
    OgcOpenApiGetCapabilities
} from "ogcopenapis/lib/OgcOpenApiGetCapabilities";
```
For Open Api Feature you can use the OgcOpenApiFeatureStore, this implements a store that can be used with LuciadRIA FeatureModel and FeatureLayer
```typescript
import {
    OgcOpenApiFeatureStore
} from "ogcopenapis/lib/OgcOpenApiFeatureStore";
```

For Maps and Tiles use OgcOpenApiMapsModel and OgcOpenApiTilesModel:
```typescript
import {OgcOpenApiMapsModel} from "ogcopenapis/lib/OgcOpenApiMapsModel";
import {OgcOpenApiTilesModel} from "ogcopenapis/lib/OgcOpenApiTilesModel";
```
OgcOpenApiMapsModel extends WMSTileSetModel and OgcOpenApiTilesModel extends UrlTileSetModel, so you can use them in combination with RasterTileSetLayer. 
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

// The tile matrix set definition and the tileset of the collection for it
const tileMatrix = (await OgcOpenApiGetCapabilities.fetchTileSetsInFull(capabilities)).find(t => t.id === "WebMercatorQuad");
const tileSet = await OgcOpenApiGetCapabilities.fetchCollectionTileSet(capabilities, collection, tileMatrix.id, {}, CollectionLinkType.VectorTiles);

const model = new OgcOpenApiVectorTilesModel({
    tileMatrix,
    baseURL: tileSet.links.find(l => l.type === "application/vnd.mapbox-vector-tile").href,
    collection: collection.id,
    tileMatrixSetLimits: tileSet.tileMatrixSetLimits,
});

// A style of the server (OGC API Styles), or a default style when the server has none
const styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, collection);
const styleJson = styles.length > 0 ?
    await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, OgcOpenApiStyleTools.pickStylesheet(styles[0], tileMatrix.id)) :
    OgcOpenApiStyleTools.createDefaultStyle(tileSet.layers);

map.layerTree.addChild(new MapboxVectorTileSetLayer(model, {label: collection.title, style: MapboxStyle.createFromObject(styleJson)}));
```

About styles:
* LuciadRIA reads the Mapbox GL encoding of OGC API Styles only, not SLD or other encodings.
* A server can publish a stylesheet per tile matrix set, because zoom levels depend on it. `pickStylesheet` picks the one for the tile matrix set in use.
* `fetchMapboxStyle` removes properties without a value (`"filter" : ,`), so that styles that are not valid JSON can still be used.
* `createDefaultStyle` paints points, lines and surfaces by the `geometryDimension` of the tileset layers, without labels.

Notes:
* Only tile matrix sets that LuciadRIA can address as a quad-tree are supported, both for map tiles and vector tiles.
* LuciadRIA 2026.1.1 paints nothing for a vector tiles model with `minLevel > 0`. OgcOpenApiVectorTilesModel therefore starts at
  level 0, and does not request tiles outside the `tileMatrixSetLimits` of the tileset.
* LuciadRIA 2026.1.1 does not paint Mapbox `circle` layers. The default style draws points as a text symbol for that reason.


## Requirements
* LuciadRIA 2026.1 or higher (place it on a local npm repository for instance verdaccio )
* A ES6 or Typescript capable transpiler. 

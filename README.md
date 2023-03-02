# OGC OPEN API's prototype for LuciadRIA 

## Description
The ogcopenapis package provides OGC API functionalities to LuciadRIA Application.

Implements
* __Open API Features__ 
* __Open API Tiles__ 
* __Open API Maps__ 

The Main Components are:

* __OgcOpenApiFeatureStore__: a ready to use LuciadRIA Feature store capable to retrieve features from an OGC API Feature Service
* __OgcOpenApiMapsModel__:  a ready to use model capable to retrieve images from from an OGC API Maps Service
* __OgcOpenApiTilesModel__:  a ready to use model capable to retrieve tiles from an OGC API Tiles Service
* __OgcOpenApiGetCapabilities__: a helper to retrieve the capabilities of a server such as available Collections and available Formats



## To build
This is the source code that produces a library delivered as a npm package. 
To build the source code use the npm scripts:
```
npm install
npm run build
```
Then you can publish the package to npm or other repository

## To test
Some test have been added that runs using nodejs using Jest. No browser test is available at the moment.
The test uses isomorphic-fetch to provide fetch in node testing with jest.
```
npm run test
```
Test use the sever-side implementations of OGC Open API from "https://demo.pygeoapi.io/master/" and "https://maps.gnosis.earth/ogcapi/"
The servers are reliable and stable,  but take in t account that changes at the server may brake some tests of this client.

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
Both models extend from UrlTileSetModel so you can use them in combination with RasterTileSetLayer. 
Look at the LuciadRIA documentation if you need further information on using RasterTileSetLayer. 


## Requirements
* LuciadRIA 2020.0 or higher (place it on a local npm repository for instance verdaccio )
* A ES6 or Typescript capable transpiler. 

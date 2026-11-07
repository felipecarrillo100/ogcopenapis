# Changelog

All notable changes to ogcopenapis are in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each pull request adds its changes under Unreleased. A release renames Unreleased to its version and date.

## [Unreleased]

## [1.3.0] - 2026-11-05

### Added
- Maps of a collection that offers its map only per style (OGC API Maps, Styled Map class, OGC 20-058 clause 21), as
  GeoServer 2.28 does: the collection has no map link, each of its styles has map links, at `…/styles/{styleId}/map`.
  `OgcOpenApiGetCapabilities.mayOfferStyledMap` tells such a collection without a request: no map link, a styles link,
  and a conformance class of OGC API Maps Part 1 declared.
  `OgcOpenApiStyleTools.fetchMapStyles` lists the styles that have a map, the default one first, with their map links;
  a map link of a style is the `baseURL` of `OgcOpenApiMapsModel`. A collection with a map link is read as before.
  Requested by a user of 1.2.2.

### Fixed
- OGC URIs (`www.opengis.net`) are read with `http` or `https`: conformance classes, link relations and the JSON-FG
  profile. OGC standards write them both ways, OGC API Tiles (OGC 20-057) and Features with `http`, OGC API Maps
  (OGC 20-058) with `https`, and servers follow either. Only `http` was read, so the map of a GeoServer 3.0 collection,
  linked with `https://www.opengis.net/def/rel/ogc/1.0/map`, was not found. Only the scheme may differ: the `/0`
  version alias and CURIEs (`[ogcapi-maps-1:core]`) are not taken as the same URI. `isSameOgcUri` compares two OGC
  URIs so. `MAPS_CONFORMANCE_PREFIXES`, new in this release, is `MAPS_CONFORMANCE_PREFIX`.
- `fromURL` reads a landing page whose collections link has the relation in full,
  `http://www.opengis.net/def/rel/ogc/1.0/data`, as GeoServer's OGC API Tiles and Maps give it. It rejected it with
  "no links with rel=data": only the short `data` was read, while the other relations of the landing page were read in
  both forms. Reported by a user of 1.2.2.
- The definition of a tile matrix set is checked against OGC 2D TMS 2.0 (OGC 17-083r4), the version OGC API Tiles
  1.0 uses, and a definition that fails says what it lacks, for example
  `Tile matrix set EPSG:900913 has no crs (supportedCRS is OGC 2D TMS 1.0, not read)`. It said only
  `TileSet has invalid data`.
  - Each tile matrix must have the properties TMS 2.0 requires: `id`, `scaleDenominator`, `cellSize`,
    `pointOfOrigin`, `tileWidth`, `tileHeight`, `matrixWidth` and `matrixHeight`. A tile matrix without `cellSize` was
    accepted, and gave wrong bounds.
  - The `id` of the tile matrix set is optional, as in TMS 2.0. It was required. Without it, the id of the server's
    list of tile matrix sets is used, otherwise the `uri` of the definition.
  - A definition included in a tileset is checked the same way.
  - The OGC 2D TMS 1.0 encoding (`supportedCRS`, no `cellSize`), which GeoServer 2.28 serves, is still not read. It is
    named in the message. OpenLayers and GDAL don't read it either.
  Reported by a user of 1.3.0 (pre-release).

## [1.2.2] - 2026-11-03

### Fixed
- `OgcOpenApiVectorTilesModel` asks for Mapbox Vector Tiles with the `Accept` header (`MVT_MEDIA_TYPE`). A tile link
  may have no media type, as on CubeWerx: OGC API Tiles (OGC 20-057, 7.1.1) has the client select the encoding by
  content negotiation, and the model sent no `Accept`, so the format was left to the server. An `Accept` in
  `requestHeaders` is kept.
- Demo: a vector tileset without an MVT link uses its tile link without a media type before its first link.

## [1.2.1] - 2026-10-30

### Fixed
- The `keywords` of a collection are always strings, as declared (`string[]`) and as OGC API Common Part 2 defines
  them. `fromURL` passed the value of the server as it was: PDOK sends each keyword as an object, `{"keyword": "bak"}`,
  which an application showed as `[object Object]`, the demo too. Strings are kept as they are; a keyword object of OGC
  Web Services Common is read as its `keyword`, a shape that is not in the standard; anything else is left out.
  Reported by a user of 1.2.0.

## [1.2.0] - 2026-10-30

### Added
- `getFilterSupport(capabilities)`: whether, and how, the server filters features, as its conformance classes declare.
  `filter` for the Features Filter class of OGC API Features Part 3 (`FEATURES_FILTER_CONFORMANCE`), and the CQL2 1.0
  `encodings` (`cql2-text`, `cql2-json`) and `levels` (`basic-cql2`, `advanced-comparison-operators`, …) by their
  names. Each as declared: a CQL2 encoding without the Features Filter class gives `filter` false (pygeoapi).
  Requested by a user of 1.1.1.
- `fetchQueryables(capabilities, collection, options?)`: the queryables of a collection (OGC API Features Part 3), the
  JSON Schema of the properties a filter can use, as the server sends it (`OgcOpenApiQueryables`). It requests the
  queryables link of the collection, or the path of the standard when `/collections` lists none (ldproxy, PDOK).
  Resolves `null` for a collection without features and for a 404, rejects with an `Error` otherwise. Requested by a
  user of 1.1.1.
- `onQueryResult` option of OgcOpenApiFeatureStore: called once for each query with what its response says about its
  size, `numberMatched` (left out when the server gives none), `numberReturned` and `hasNext` (a next link, in the
  response or its `Link` header), with the `url` and `query` of the request. From JSON and from the root element of
  GML. Not called for `get`, a failed query or an aborted one. Requested by a user of 1.1.1.
- Demo: a URL that is not the landing page of an OGC API gets a message in plain words: an HTML page ("the server did
  not answer JSON") or JSON without its links ("not the landing page of an OGC API").

## [1.1.1] - 2026-10-29

### Fixed
- `fromURL` settles in every case: it stayed pending forever when the collections request failed (an HTTP error, a
  response that is not JSON, a network error, an abort), and when a `service-desc` link had no type. Cancelling
  through an abort signal added by `proxify` now works during the collections request too. Reported by a user of 1.1.0.
- `fromURL` asks for JSON: `Accept: application/json` for the landing page, the collections and the conformance
  classes, and the media type of its link for the API document. `requestHeaders` can replace it. Reported by a user of
  1.1.0.
- The `format` of OgcOpenApiMapsModel is documented as what it is: the `f` value of the requests, as the server names
  its formats (`png`), not a media type, unlike the `format` of OgcOpenApiTilesModel. Best left out, the map link
  carries the `f` value; a media type gave HTTP 400 on pygeoapi. Reported by a user of 1.1.0.

### Changed
- `fromURL` rejects with an `Error` whose message says what failed and where, instead of a status number or a string.
  A failed request rejects with the error of `fetch` as it is, such as a `TypeError` or an `AbortError`. The API
  document and the conformance classes stay optional.
- The requests for tilesets and tile matrix sets reject with the error of `fetch` as it is when the request fails,
  instead of an `{error, message}` object.

### Added
- Demo: a feature limit per view, 1000 by default and editable: without it, servers answered their own default page
  of features, often only 10. Servers cap it at their own maximum. Feature layers use MapEvolution's scale levels, so
  that zooming in requests the features of the new view again.
- Demo: a balloon with the id and properties of a clicked feature, a line of details of the selected collection
  (description, extent, keywords, what it offers), and errors in plain words (an HTTP status, a server that cannot be
  reached).

## [1.1.0] - 2026-10-27

### Added
- The tiles of the dataset limited to some of its collections (OGC API Tiles, collections selection): the option
  `collections` of OgcOpenApiTilesModel and OgcOpenApiVectorTilesModel, which request `collections=a,b`.
- `fromURL` reads the conformance classes of the server, in `capabilities.conformsTo`.
- `supportsCollectionSelection(capabilities)`: whether the server declares collections selection, by the conformance
  class of the standard (`COLLECTIONS_SELECTION_CONFORMANCE`), or by the name ldproxy declares it under, which is not in
  the standard (`COLLECTIONS_SELECTION_CONFORMANCE_VARIANTS`).
- Demo: the collections in the tiles of the dataset, when the server supports collections selection.

## [1.0.3] - 2026-10-27

### Fixed
- OgcOpenApiFeatureStore keeps every parameter of the items link, such as `profile` or an api key, instead of only
  `f`. A parameter of a request replaces the one of the link with the same name.
- OgcOpenApiFeatureStore encodes the values of its queries: a CQL `filter` with spaces, `&` or `#`, or a `datetime`
  interval, no longer gives a malformed URL. `get(id)` encodes the id.
- `fromURL` requests the landing page with the query of the URL it is given.
- The tileset URL built from a tile matrix set id, and the styles URL built from the self link of a collection, keep
  the query of the link they start from.

### Added
- `isJsonFgLink`, `JSON_FG_MEDIA_TYPE` and `JSON_FG_PROFILE`: JSON-FG links, by their media type or by the JSON-FG
  profile of an `application/geo+json` link. `outputFormats` of a collection reports JSON-FG as
  `application/vnd.ogc.fg+json`. Reading JSON-FG needs a JSON-FG codec, which the application provides.
- Demo: a format for features. JSON-FG is listed, but cannot be selected yet.

## [1.0.2] - 2026-10-27

### Fixed
- The README examples take every value from the capabilities: the formats of the links, the CRS of a map (the
  reference of the map when the collection offers it, otherwise CRS84), the tileset in the reference of the map, the
  styles for its tile matrix set, and the extents. The examples are functions that run as written; two of them failed on
  servers whose links have no type or whose tilesets list no URI.
- Demo: the CRS of a map and the encoding of features come from the capabilities, and a tileset bounding box without a
  CRS is not taken as CRS84.

## [1.0.1] - 2026-10-27

### Fixed
- The Features example of the README keeps the feature ids of the server, `new GeoJsonCodec({generateIDs: false})`.
  `generateIDs: true` replaced them with ids of its own on every query: `get(id)` of the store then requested ids that
  do not exist, and LuciadRIA re-added every feature on every query. The library is unchanged, the application passes
  the codec.

## [1.0.0] - 2026-10-27

### Changed
- **BREAKING:** requires LuciadRIA 2026.1 or higher, as a peer dependency: the application installs its single copy,
  the package never bundles it.
- **BREAKING:** the package is native ES modules (`"type": "module"`) with an `exports` map. Import components as
  `ogcopenapis/OgcOpenApiFeatureStore`, the paths of 0.0.12 with `lib/` still work. TypeScript projects need
  `moduleResolution` `bundler`, `node16` or `nodenext` for the paths without `lib/`.
- OgcOpenApiTilesModel uses LuciadRIA's WMTS support: create it with `createFromTileSet`, which handles tile matrix
  sets that are not quad-trees and `tileMatrixSetLimits`.
- OgcOpenApiFeatureStore extends LuciadRIA's `Store`. Its requests always settle, and it supports `abortSignal`.
- `fetchTileSetsInFull` leaves out tile matrix sets whose definition cannot be read, instead of failing, and rejects
  only when none can be read.
- OgcOpenApiMapsModel keeps the `f` value of the map link, such as `f=png`, and encodes its query.
- Tile matrix set definitions are requested by their link as the server gives it, with an `Accept: application/json`
  header.

### Added
- Vector tiles (Mapbox Vector Tiles): OgcOpenApiVectorTilesModel, on LuciadRIA's MapboxVectorTileSetModel. It reads
  the layers from a few tiles when a tileset does not list them (`discoverLayers`).
- OGC API Styles in the Mapbox GL encoding: OgcOpenApiStyleTools, with a stylesheet or a style per tile matrix set
  (`pickStylesheet`, `getStylesForTileMatrixSet`) and a generated default style (`createDefaultStyle`).
- The tilesets of a collection, only the tile matrix sets it is tiled in: `fetchCollectionTileSets`, matched to the
  tile matrix sets of the server by URI (`matchTileMatrixSet`, `fetchTileMatrixSetOfTileSet`).
- The tilesets of the dataset, all collections in each tile: `hasDatasetTileSets`, `fetchDatasetTileSets`, and
  `fetchCollectionTileSet` with collection `null`.
- A tile matrix set included in a tileset is used as is.
- A demo, test servers with recorded, live and browser tests, and a check of the package as published.

### Deprecated
- The constructor `new OgcOpenApiTilesModel(options)`: it supports quad-tree tile matrix sets only.

### Fixed
- Relative links are resolved against the URL of their document, instead of the host of the server.
- Tile matrix set URIs match regardless of `http`/`https`, the case of the host and a trailing slash.
- `orderedAxes` `Y, X` (EPSG:3035) is northing first: `pointOfOrigin` is read in that order.
- `fromURL` without options no longer hangs.

## 0.0.12 and earlier

See the [git history](https://github.com/felipecarrillo100/ogcopenapis/commits/main).

[Unreleased]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/felipecarrillo100/ogcopenapis/releases/tag/v1.0.0

# Changelog

All notable changes to ogcopenapis are in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each pull request adds its changes under Unreleased. A release renames Unreleased to its version and date.

## [Unreleased]

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

[Unreleased]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/felipecarrillo100/ogcopenapis/releases/tag/v1.0.0

# Changelog

All notable changes to ogcopenapis are in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each pull request adds its changes under Unreleased. A release renames Unreleased to its version and date.

## [Unreleased]

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

[Unreleased]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/felipecarrillo100/ogcopenapis/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/felipecarrillo100/ogcopenapis/releases/tag/v1.0.0

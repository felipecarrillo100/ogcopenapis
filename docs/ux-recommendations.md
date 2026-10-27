# UX recommendations for an OGC API application

Ideas for a LuciadRIA application on top of ogcopenapis, collected by comparing how other clients and the servers' own
web pages present OGC API data. The demo in `demo/` stays basic; this document is for the application.

Reviewed on 2026-10-27. Server pages were opened and inspected; QGIS and ArcGIS Pro from their documentation.

## What was reviewed

| Client | What it covers | Notes |
|---|---|---|
| ldproxy web pages (demo.ldproxy.net) | Features, tiles, styles of its own server | Opened; the tileset page has no HTML view |
| PDOK web pages (api.pdok.nl) | Features, tiles, styles of its own server | Opened |
| pygeoapi web pages (demo.pygeoapi.io) | Features, maps, tiles of its own server | Opened |
| CubeWerx web pages (test.cubewerx.com) | Its own server | Landing page opened only |
| QGIS 3.44 | OGC API Features (WFS provider); no OGC API Tiles | From the user manual |
| ArcGIS Pro 3.5 | OGC API Features and map tiles | From the documentation |
| ArcGIS Online | OGC API Features, by URL | From the documentation |
| TerriaJS, MapStore | No OGC API support listed | |
| ogc-client (camptocamp) | A library; its site is documentation | Its "Try it!" app not reviewed |

## Scores

For exploring OGC API data, 1 to 5. The server pages each show only their own server.

| | Discovery | Showing the data | Inspecting features | Filter, sort, paging | Styles and legend | Metadata | Scope |
|---|---|---|---|---|---|---|---|
| ldproxy pages | 4 | 4 | 5 | 5 | 5 | 4 | own server |
| PDOK pages | 4 | 2 | 3 | 3 | – | 5 | own server |
| pygeoapi pages | 3 | 3 | 4 | 3 | – | 3 | own server |
| QGIS | 4 | 4 | 4 | 4 | 2 | 3 | Features only |
| ArcGIS Pro | 4 | 4 | 3 | 2 | 1 | 3 | Features and map tiles |
| ogcopenapis demo | 2 | 5 | 0 | 0 | 2 | 0 | any server, every type |

The demo is ahead in one thing: it shows Features, Maps, raster tiles, vector tiles with server or generated styles,
dataset tiles and collections selection, reprojected, from any server, on one map. It is behind in everything around
the map: browsing, inspecting, querying and metadata.

## What the others do well

**ldproxy**
- Items page: the properties of each feature under the titles of the collection schema, next to a map. Pagination,
  and editors for Filter, Sorting, Coordinate reference system and Items per page. Links to each format: CSV,
  FlatGeobuf, GeoJSON, JSON-FG.
- Collection page: "Links to the main resources" (features, web map, vector tiles, styles), the number of features,
  and the spatial extent drawn on a map.
- Style viewer: a layer tree built from the Mapbox style, grouped by collection, with sub-layers (National Road,
  Secondary Road, Bridge, Railway, Name), each with its legend symbol and a checkbox. A basemap switch and a scale bar.

**PDOK**
- Collection page: description, keywords, last updated, geographic and temporal extent, an illustration.
- A CRS choice per format ("CRS84 as GeoJSON", "CRS84 as JSON-FG"), and a short explanation of what each format is
  for.

**pygeoapi**
- A map and a table of the features side by side. A limit choice with a warning ("Higher limits not recommended!"),
  and Next.

**QGIS**
- Saved, named server connections, with export and import. Authentication kept apart from the connection.
- Per layer: only request the features in the view, a CRS choice, a page size, and an SQL query composer for filters.
- Editing on servers that support OGC API Features Part 4.

**ArcGIS Pro**
- Server connections in a catalog tree, with custom request parameters (an API key) and OAuth.
- Several layers added at once, or dragged onto the map, with a progress dialog and Cancel.

## Recommendations

Most valuable first. Each names where the idea comes from and what the library needs for it.

1. **Start from the collection, not the type.** A searchable catalog of servers and collections. Each collection shows
   what it offers (features, map, map tiles, vector tiles, styles, dataset tiles) as choices, instead of a type chosen
   first. *From:* ldproxy, ArcGIS Pro. *Library:* available; the links of a collection tell what it offers
   (`filterCollectionLinks`, `outputFormats`).
2. **Collection details.** Description, keywords, number of features, spatial extent drawn on a small map, temporal
   extent, last updated, a link to the schema. *From:* PDOK, ldproxy. *Library:* mostly available in the capabilities
   (`extent`, `keywords`, `description`); the number of features needs `numberMatched` of an items request.
3. **Inspecting features.** Click a feature for its properties, with the titles of the collection schema; a table of
   the features linked to the map. *From:* ldproxy, pygeoapi. *Library:* the features are available; the schema
   (`/collections/{id}/schema`) is not read yet.
4. **Querying features.** A filter editor built from the queryables, sorting, a page size with a warning, paging,
   "only what is in view", and a CRS choice. *From:* ldproxy, QGIS, pygeoapi. *Library:* needs paging (`next` links)
   and the queryables (`/collections/{id}/queryables`); filters can already be passed to `query`.
5. **A layer tree from the style.** The layers of a Mapbox style as a tree, grouped, with legend symbols and
   checkboxes. *From:* ldproxy's style viewer. *Library:* the style JSON is available (`fetchMapboxStyle`); the tree
   and the legend symbols are application work.
6. **Formats explained.** Every format the server offers, a one-line explanation of each, and the ones that cannot be
   read yet shown disabled, as the demo does for JSON-FG. *From:* PDOK. *Library:* available (`isJsonFgLink`,
   `outputFormats`).
7. **Server connections.** Saved and named, with export and import, custom request parameters (an API key) and
   authentication, OAuth included. *From:* QGIS, ArcGIS Pro. *Library:* `requestHeaders`, `credentials` and `proxify`
   are available; query parameters of the server URL are kept.
8. **Map basics.** A basemap switch, a scale bar, a north arrow, and a time slider for collections with a temporal
   extent. *From:* ldproxy, PDOK. *Library:* `datetime` can be passed to the features store and the maps model.
9. **Feedback.** Progress per layer with Cancel, and errors in plain words: "this server does not support collections
   selection" rather than an HTTP status. *From:* ArcGIS Pro. *Library:* requests reject with messages; LuciadRIA
   aborts requests through `abortSignal`.
10. **Later.** Several layers added at once, and dragged onto the map (ArcGIS Pro); editing for OGC API Features Part 4
    (QGIS).

## Library work these depend on

- Paging of features: follow the `next` links of a response.
- Queryables and schema of a collection: `/collections/{id}/queryables` and `/collections/{id}/schema`.
- The number of features: `numberMatched` of an items response.

## For the demo

The demo stays basic. Only ideas that are cheap, or that show the library much better, belong there:

| Idea | Value | Cost | Why | Status |
|---|---|---|---|---|
| Click a feature for its properties | High | Low | Feature layers are already selectable; LuciadRIA shows a balloon for a selected feature | Done |
| A line of collection details under the collection: description, extent, keywords | Medium | Low | All in the capabilities already | Done |
| Errors in plain words | Medium | Low | A few messages in the status line | Done |

Not for the demo: the catalog, filters and paging, the feature table, the layer tree from the style, server
connections. They are application work.

## Features for the application

The features recommended for the application, most valuable first. Value is rated from 1 to 5 stars. Cost is the
work still to do: **S** is days, **M** is one to three weeks, **L** is more, and it names what the library and the
application each need.

The application starts from what the library and the demo already do: Features, Maps, raster tiles and vector tiles
from any server on one map, with server or generated styles, dataset tiles with collections selection, and
reprojection. No other client does that; the features below build on it.

| # | Feature | Value | What it brings | Cost | Why it is a killer feature |
|---|---|---|---|---|---|
| 1 | **Catalog that starts from the collection** | ★★★★★ | A searchable list of servers and collections. Each collection shows what it offers (features, map, map tiles, vector tiles, styles, dataset tiles), and one click adds the best representation for the map. | **M**. Library: ready (`filterCollectionLinks`, `outputFormats`, `hasDatasetTileSets`). Application: the catalog UI and the choice of representation. | Users find data without knowing the parts of OGC API. QGIS and ArcGIS Pro split the same data over different dialogs per type; no client presents every part of a collection in one place. |
| 2 | **Query builder: filters, sorting, time and paging** | ★★★★★ | Filters built from the queryables of a collection (CQL2), sorting, a datetime range, a page size and paging, applied on the server. | **L**. Library: queryables, paging (`next` links), `numberMatched`, a CQL2 text builder. Application: the editor. | Large datasets become explorable without downloading them: the server does the work. ldproxy offers it only on its own pages and QGIS only for Features; no web map client offers it. |
| 3 | **Feature inspection and attribute table** | ★★★★★ | Click a feature for its properties under the titles of the collection schema; a table of the features in view, linked to the map: select a row to highlight the feature and the other way round. | **M**. Library: read the schema (`/collections/{id}/schema`), **S**. Application: the table and its link to the selection. | The basic tool of every GIS. The server pages and the desktop clients have it, the web map clients do not. The demo's balloon is the first step. |
| 4 | **Layer tree and legend from the style** | ★★★★★ | The layers of an OGC API style as a tree, grouped as the style groups them, each with its legend symbol and a checkbox to show or hide it. | **M**. Library: ready (`fetchMapboxStyle`). Application: the tree, legend symbols from the paint properties, and hiding layers by restyling. | It makes server styles understandable and controllable: one checkbox for "Railway" instead of a whole layer. Only ldproxy's own pages do it, and only for its own server. |
| 5 | **3D view** | ★★★★ | The same layers on a 3D globe, with terrain: features, raster and vector tiles draped on it. | **M**. Library: test the models on a 3D map. Application: a 2D/3D switch. | LuciadRIA's strength. OGC API clients on the web are 2D; QGIS and ArcGIS Pro need a separate 3D view. It also prepares for 3D OGC APIs (3D GeoVolumes). |
| 6 | **Server inspector** | ★★★★ | For a server: its conformance classes, what it offers, and what it does differently from the standard (such as ldproxy's conformance class name, or a tileset without an identity), in plain words. | **S**. Library: mostly ready (`conformsTo`, the checks in the capabilities); report what was tolerated. Application: a panel. | For integrators, the fastest way to tell why a server does not work: no client explains a server like this. It also builds the reports to server maintainers. |
| 7 | **Server connections with authentication** | ★★★★ | Saved, named servers with export and import, custom request parameters (an API key), and authentication, OAuth included. | **M**. Library: ready (`requestHeaders`, `credentials`, `proxify`, the query of the server URL). Application: storage, the dialogs and OAuth. | Most production servers need a key or a login. QGIS and ArcGIS Pro have it; web clients rarely do, which keeps them to demo servers. |
| 8 | **National grids and any map reference** | ★★★★ | A map in the reference of the user (RD, ETRS89-LAEA, UTM), the tileset in that reference picked automatically, and the references loaded on demand. | **S**. Library: ready (`pickTileSet` in the README, `retryOnUnknownReference` as in MapEvolution). Application: a reference choice and a reference loader. | National mapping agencies serve their data in national grids (PDOK). Clients that show Web Mercator only distort it or cannot use it. |
| 9 | **Time slider** | ★★★★ | For collections with a temporal extent: a slider that filters features and maps by time, and plays them as an animation. | **M**. Library: ready (`datetime` of the features store and the maps model). Application: the slider and the animation. | OGC API collections advertise their temporal extent, but no web client lets users move through it. |
| 10 | **Dataset tiles with a collection picker** | ★★★ | The tiles of a whole dataset, with the collections to include picked from a list. | **S**. Library: ready (`fetchDatasetTileSets`, `supportsCollectionSelection`, `collections`). Application: the picker, as in the demo. | One layer for a whole national dataset (PDOK) instead of dozens. OpenLayers can request it, but no client offers the choice. |
| 11 | **Formats and CRSs explained** | ★★★ | Every format and CRS the server offers, a one-line explanation of each, and the ones that cannot be read yet shown disabled (JSON-FG until a codec exists). | **S**. Library: ready (`outputFormats`, `isJsonFgLink`). Application: the texts. | Users see what the server can do and why something is not available, instead of a failure. PDOK explains its formats; no client does. |
| 12 | **Share and bookmark a view** | ★★★ | The map view, the layers and their options in a link or a bookmark, to reopen or send. | **S** to **M**. Application only. | Turns an exploration into something to share. MapEvolution has bookmarks; OGC API clients do not. |
| 13 | **Progress, Cancel and plain errors** | ★★★ | Progress per layer with Cancel, and every error in plain words with its cause. | **S**. Library: ready (`abortSignal`, messages). Application: the indicators, as the demo started. | Slow servers and large requests are common; users need to see what is happening and to stop it. |
| 14 | **Editing** | ★★★ | Create, change and delete features on servers that support OGC API Features Part 4. | **L**. Library: transactions in the features store. Application: the editing tools. | Valuable where servers support it, which few do yet. QGIS has it. |
| 15 | **Several layers at once, and drag onto the map** | ★★ | Select several collections and add them in one go, or drag them from the catalog onto the map. | **S**. Application only. | Comfort, as in ArcGIS Pro; worth it once the catalog exists. |


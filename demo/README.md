# ogcopenapis demo

A minimal page to open OGC API Features, Maps, Tiles and Vector Tiles collections in LuciadRIA,
using the library straight from `../src`.

## Requirements

* LuciadRIA 2026.1 or higher, installed in the root `node_modules`
* A LuciadRIA development license in `license/luciadria_development.txt`.
  The file is gitignored, see `license/readme.txt`.

## Run

From the repository root:

```
npm install
npm run demo
```

Then open http://localhost:5180/.

1. Pick a server, or type the URL of an OGC API landing page.
2. Pick the type of data. Changing it reconnects to the server.
3. Pick a collection, and for tiles a tile matrix set. Vector tiles can use one of the server's
   OGC API Styles (Mapbox GL) or a style generated from the tileset layers.
4. Add layer. The map zooms to the collection extent.

The basemap is OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{-y}.png`), see the
[OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

## Notes

* `window.map` and `window.demo` are available in the browser console for experiments.

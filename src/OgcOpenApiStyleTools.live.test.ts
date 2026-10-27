import {describe, expect, it} from 'vitest';

import {CollectionLinkType, OgcOpenApiGetCapabilities} from "./OgcOpenApiGetCapabilities";
import {OgcOpenApiStyleTools} from "./OgcOpenApiStyleTools";

const DARAA = "https://demo.ldproxy.net/daraa/";
const GNOSIS = "https://maps.gnosis.earth/ogcapi/";

describe('OgcOpenApiStyleTools with OGC API Styles', () => {

    it('daraa styles, one stylesheet per tile matrix set', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(DARAA, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        const collection = capabilities.collections.find(c => c.id === "AgricultureSrf");
        const styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, collection);
        expect(styles.length).toBeGreaterThan(0);
        const stylesheet = OgcOpenApiStyleTools.pickStylesheet(styles[0], "WebMercatorQuad");
        const style = await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, stylesheet);
        expect(style.version).toBe(8);
        expect(style.layers.some(l => l["source-layer"] === "AgricultureSrf")).toBe(true);
    });

    it('gnosis osm:dc osmDefault is repaired', async () => {
        const capabilities = await OgcOpenApiGetCapabilities.fromURL(GNOSIS, {filterCollectionsByLinkType: CollectionLinkType.VectorTiles});
        const collection = capabilities.collections.find(c => c.id === "osm:dc");
        const styles = await OgcOpenApiStyleTools.fetchStyles(capabilities, collection);
        const osmDefault = styles.find(s => s.id === "osmDefault");
        const style = await OgcOpenApiStyleTools.fetchMapboxStyle(capabilities, OgcOpenApiStyleTools.pickStylesheet(osmDefault, "WebMercatorQuad"));
        expect(style.layers.length).toBeGreaterThan(10);
        expect(style.layers.some(l => l["source-layer"] === "roads")).toBe(true);
    });
});

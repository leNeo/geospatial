/** @odoo-module */

/* global ol, proj4 */

import {GeoengineRenderer} from "@base_geoengine/js/views/geoengine/geoengine_renderer/geoengine_renderer.esm";
import {patch} from "@web/core/utils/patch";
import {
    SWISSTOPO_EXTENT_2056,
    SWISSTOPO_RESOLUTIONS,
} from "@geoengine_swisstopo/js/swisstopo_raster.esm";

/**
 * Ensure proj4 projections are registered with OpenLayers.
 *
 * This is needed BEFORE creating XYZ tile layers so that OpenLayers can
 * reproject tiles (e.g. EPSG:3857 → EPSG:2056) when the map view uses
 * a non-standard projection.
 *
 * If geoengine_swisstopo is installed, its ensureProjectionsRegistered()
 * will have already done this — the proj4.defs() calls are idempotent.
 * If swisstopo is NOT installed, we register EPSG:2056 ourselves as a
 * minimal fallback.
 */
let _projRegistered = false;
const SWISS_TILE_ORIGIN = [2420000, 1350000];
function _ensureProj4() {
    if (_projRegistered) {
        return;
    }
    if (typeof proj4 === "undefined" || typeof ol === "undefined") {
        return;
    }
    // Register EPSG:2056 (Swiss LV95) if not already known
    if (!proj4.defs("EPSG:2056")) {
        proj4.defs(
            "EPSG:2056",
            "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 " +
                "+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel " +
                "+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs"
        );
    }
    ol.proj.proj4.register(proj4);
    _projRegistered = true;
}

patch(GeoengineRenderer.prototype, {
    /**
     * Override createBackgroundLayers to handle the "xyz_tiles" raster type.
     *
     * Uses a filter-before-delegate pattern:
     * 1. Extract xyz_tiles backgrounds from the input array
     * 2. Delegate remaining backgrounds to super (compatible with swisstopo if installed)
     * 3. Store xyz_tiles configs for deferred layer creation in renderMap
     * 4. Return other layers only (xyz layers added after view projection is set)
     *
     * @param {Array} backgrounds - raster layer records from the server
     * @returns {Array<ol.layer.Tile>}
     */
    createBackgroundLayers(backgrounds) {
        // Register projections early so OL can reproject XYZ tiles
        _ensureProj4();

        const xyzBackgrounds = backgrounds.filter(
            (bg) => bg.raster_type === "xyz_tiles"
        );
        const otherBackgrounds = backgrounds.filter(
            (bg) => bg.raster_type !== "xyz_tiles"
        );

        // Store XYZ configs for deferred creation (after view is set)
        this._xyzTileConfigs = xyzBackgrounds;

        // Delegate non-XYZ backgrounds to parent (base or swisstopo-patched)
        return super.createBackgroundLayers(otherBackgrounds);
    },

    /**
     * After the map is rendered and the view projection is established,
     * create the XYZ tile layers with proper reprojection support.
     */
    renderMap() {
        super.renderMap(...arguments);

        if (this.map && this._xyzTileConfigs && this._xyzTileConfigs.length > 0) {
            _ensureProj4();
            this._addXyzTileLayers();
        }
    },

    /**
     * Build and add XYZ tile layers to the map.
     *
     * Called AFTER the view projection is established (e.g. EPSG:2056),
     * so OpenLayers can properly set up tile reprojection from the
     * source projection (typically EPSG:3857) to the view projection.
     *
     * KEY: we must explicitly create a WebMercator tile grid for the source.
     * Without it, ol.source.XYZ builds its internal grid from the VIEW
     * projection (EPSG:2056 + Swisstopo resolutions), which produces
     * completely wrong tile coordinates in the {z}/{x}/{y} URL template.
     */
    _addXyzTileLayers() {
        const layers = this.map.getLayers();

        for (const background of this._xyzTileConfigs) {
            // Source projection (WebMercator by default for standard XYZ/TMS tiles)
            const srcProjCode = background.xyz_tile_projection || "EPSG:3857";
            const srcProj = ol.proj.get(srcProjCode);

            const minZoom = background.xyz_min_zoom || 0;
            const maxZoom = background.xyz_max_zoom || 22;

            let tileGrid;
            if (srcProjCode === "EPSG:2056") {
                tileGrid = new ol.tilegrid.TileGrid({
                    extent: SWISSTOPO_EXTENT_2056,
                    origin: SWISS_TILE_ORIGIN,
                    resolutions: SWISSTOPO_RESOLUTIONS,
                    tileSize: 256,
                });
            } else {
                // Explicitly build a tile grid in the SOURCE projection.
                // This ensures OL requests tiles with correct z/x/y coordinates
                // from the tile server, even when the view uses a different
                // projection with custom resolutions (e.g. Swisstopo in EPSG:2056).
                tileGrid = ol.tilegrid.createXYZ({
                    extent: srcProj ? srcProj.getExtent() : undefined,
                    minZoom: minZoom,
                    maxZoom: maxZoom,
                    tileSize: 256,
                });
            }

            const sourceOpts = {
                url: background.url,
                crossOrigin: background.xyz_cross_origin || "anonymous",
                projection: srcProj,
                tileGrid: tileGrid,
            };

            const layerOpts = {
                title: background.name,
                visible: !background.overlay,
                opacity: background.opacity ?? 1.0,
                source: new ol.source.XYZ(sourceOpts),
            };

            // Restrict tile loading to a bounding box if specified.
            // The extent must be in the VIEW projection (e.g. EPSG:2056).
            if (background.xyz_tile_extent) {
                const extent = background.xyz_tile_extent.split(",").map(Number);
                if (extent.length === 4 && extent.every((n) => !isNaN(n))) {
                    layerOpts.extent = extent;
                }
            }

            const tileLayer = new ol.layer.Tile(layerOpts);

            // Insert above swisstopo base layer but below vector data
            const insertPos = Math.min(layers.getLength(), 1);
            layers.insertAt(insertPos, tileLayer);
        }

        // Clear configs to prevent re-adding on subsequent renderMap calls
        this._xyzTileConfigs = [];
    },
});

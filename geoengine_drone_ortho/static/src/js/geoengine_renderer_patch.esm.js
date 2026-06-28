/** @odoo-module */

/* global ol, proj4 */

import {GeoengineRenderer} from "@base_geoengine/js/views/geoengine/geoengine_renderer/geoengine_renderer.esm";
import {patch} from "@web/core/utils/patch";

/**
 * Ensure proj4 projections are registered with OpenLayers.
 *
 * Needed BEFORE creating XYZ tile layers so that OpenLayers can reproject
 * tiles (e.g. EPSG:3857 → EPSG:2056) when the map view uses a non-standard
 * projection.
 *
 * Companion modules (e.g. geoengine_swisstopo) register their own SRIDs;
 * proj4.defs() calls are idempotent.
 */
let _projRegistered = false;
function _ensureProj4() {
    if (_projRegistered) {
        return;
    }
    if (typeof proj4 === "undefined" || typeof ol === "undefined") {
        return;
    }
    ol.proj.proj4.register(proj4);
    _projRegistered = true;
}

patch(GeoengineRenderer.prototype, {
    /**
     * Override createBackgroundLayers to handle the "xyz_tiles" raster type.
     *
     * Filter-before-delegate pattern: extract xyz_tiles, defer their creation
     * until after the view projection is established, and let super handle
     * the rest (compatible with swisstopo if installed).
     *
     * @param {Array} backgrounds - raster layer records from the server
     * @returns {Array<ol.layer.Tile>}
     */
    createBackgroundLayers(backgrounds) {
        _ensureProj4();

        const xyzBackgrounds = backgrounds.filter(
            (bg) => bg.raster_type === "xyz_tiles"
        );
        const otherBackgrounds = backgrounds.filter(
            (bg) => bg.raster_type !== "xyz_tiles"
        );

        this._xyzTileConfigs = xyzBackgrounds;

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
            if (!this._xyzViewHooked) {
                this._xyzViewHooked = true;
                // Companion modules (e.g. geoengine_swisstopo) replace the map
                // view to switch projection AFTER this point, which drops the
                // XYZ layers added beforehand. Re-add them once the new view is
                // in place. The re-add is idempotent.
                this.map.on("change:view", () => this._addXyzTileLayers());
            }
        }
    },

    /**
     * Build a tile grid for the given source projection.
     *
     * Extension point: companion modules can patch this method to provide
     * custom tile grids for specific projections (e.g. Swiss LV95 with
     * Swisstopo resolutions). Return null to fall back to the default grid.
     *
     * @param {String} srcProjCode  e.g. "EPSG:3857"
     * @param {ol.proj.Projection|null} srcProj  resolved projection or null
     * @param {Object} background  raster layer record
     * @returns {ol.tilegrid.TileGrid|null}
     */
    _buildXyzTileGrid(srcProjCode, srcProj, background) {
        const minZoom = background.xyz_min_zoom || 0;
        const maxZoom = background.xyz_max_zoom || 22;
        // Build the grid in the SOURCE projection so OL requests tiles with
        // correct z/x/y coordinates even when the view uses a different
        // projection with custom resolutions.
        return ol.tilegrid.createXYZ({
            extent: srcProj ? srcProj.getExtent() : undefined,
            minZoom: minZoom,
            maxZoom: maxZoom,
            tileSize: 256,
        });
    },

    /**
     * Build and add XYZ tile layers to the map.
     *
     * Called AFTER the view projection is established, so OpenLayers can
     * properly set up tile reprojection from the source projection
     * (typically EPSG:3857) to the view projection.
     */
    _addXyzTileLayers() {
        if (!this.map || !this._xyzTileConfigs || this._xyzTileConfigs.length === 0) {
            return;
        }
        _ensureProj4();
        const layers = this.map.getLayers();

        // Idempotent: drop XYZ ortho layers added by a previous call so a
        // re-add (e.g. after a projection switch) does not create duplicates.
        layers
            .getArray()
            .slice()
            .forEach((layer) => {
                if (layer.get("_xyzOrtho")) {
                    layers.remove(layer);
                }
            });

        for (const background of this._xyzTileConfigs) {
            const srcProjCode = background.xyz_tile_projection || "EPSG:3857";
            const srcProj = ol.proj.get(srcProjCode);

            const tileGrid = this._buildXyzTileGrid(
                srcProjCode,
                srcProj,
                background
            );

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
            // The extent must be in the VIEW projection.
            if (background.xyz_tile_extent) {
                const extent = background.xyz_tile_extent.split(",").map(Number);
                if (extent.length === 4 && extent.every((n) => !isNaN(n))) {
                    layerOpts.extent = extent;
                }
            }

            const tileLayer = new ol.layer.Tile(layerOpts);
            tileLayer.set("_xyzOrtho", true);

            const insertPos = Math.min(layers.getLength(), 1);
            layers.insertAt(insertPos, tileLayer);
        }
        // Keep this._xyzTileConfigs so the layers can be re-added after a later
        // view/projection switch (see the change:view hook in renderMap).
    },
});

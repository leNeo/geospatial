/** @odoo-module */

/* global ol */

import {GeoengineRenderer} from "@base_geoengine/js/views/geoengine/geoengine_renderer/geoengine_renderer.esm";
import {patch} from "@web/core/utils/patch";

patch(GeoengineRenderer.prototype, {
    /**
     * Override createBackgroundLayers to handle the "xyz_tiles" raster type.
     *
     * Uses a filter-before-delegate pattern:
     * 1. Extract xyz_tiles backgrounds from the input array
     * 2. Delegate remaining backgrounds to super (compatible with swisstopo if installed)
     * 3. Build ol.source.XYZ layers for each xyz_tiles background
     * 4. Return all layers concatenated
     *
     * @param {Array} backgrounds - raster layer records from the server
     * @returns {Array<ol.layer.Tile>}
     */
    createBackgroundLayers(backgrounds) {
        const xyzBackgrounds = backgrounds.filter(
            (bg) => bg.raster_type === "xyz_tiles"
        );
        const otherBackgrounds = backgrounds.filter(
            (bg) => bg.raster_type !== "xyz_tiles"
        );

        // Delegate non-XYZ backgrounds to parent (base or swisstopo-patched)
        const otherLayers = super.createBackgroundLayers(otherBackgrounds);

        // Build XYZ tile layers
        const xyzLayers = xyzBackgrounds
            .map((background) => {
                const sourceOpts = {
                    url: background.url,
                    crossOrigin: background.xyz_cross_origin || "anonymous",
                };

                if (background.xyz_min_zoom) {
                    sourceOpts.minZoom = background.xyz_min_zoom;
                }
                if (background.xyz_max_zoom) {
                    sourceOpts.maxZoom = background.xyz_max_zoom;
                }

                // Handle tile projection for on-the-fly reprojection
                if (background.xyz_tile_projection) {
                    const tileProj = ol.proj.get(background.xyz_tile_projection);
                    if (tileProj) {
                        sourceOpts.projection = tileProj;
                    }
                }

                const layerOpts = {
                    title: background.name,
                    visible: !background.overlay,
                    type: "base",
                    opacity: background.opacity || 1.0,
                    source: new ol.source.XYZ(sourceOpts),
                };

                // Restrict tile loading to a bounding box if specified
                if (background.xyz_tile_extent) {
                    const extent = background.xyz_tile_extent.split(",").map(Number);
                    if (extent.length === 4 && extent.every((n) => !isNaN(n))) {
                        layerOpts.extent = extent;
                    }
                }

                return new ol.layer.Tile(layerOpts);
            })
            .filter(Boolean);

        return (otherLayers || []).concat(xyzLayers);
    },
});

/** @odoo-module */

/* global ol */

/**
 * Bridge between geoengine_drone_ortho and geoengine_swisstopo.
 *
 * Patches the XYZ tile grid extension point (_buildXyzTileGrid) to use
 * Swisstopo's official LV95 grid (origin + resolutions) when an XYZ tile
 * layer is configured with source projection EPSG:2056. All other
 * projections fall back to the default WebMercator XYZ grid built by
 * geoengine_drone_ortho.
 */
import {GeoengineRenderer} from "@base_geoengine/js/views/geoengine/geoengine_renderer/geoengine_renderer.esm";
import {patch} from "@web/core/utils/patch";
import {
    SWISSTOPO_EXTENT_2056,
    SWISSTOPO_RESOLUTIONS,
} from "@geoengine_swisstopo/js/swisstopo_raster.esm";

// LV95 tile origin = top-left corner of the national extent
// extent = [minx, miny, maxx, maxy] → origin = [minx, maxy]
const SWISSTOPO_TILE_ORIGIN = [SWISSTOPO_EXTENT_2056[0], SWISSTOPO_EXTENT_2056[3]];

patch(GeoengineRenderer.prototype, {
    _buildXyzTileGrid(srcProjCode, srcProj, background) {
        if (srcProjCode === "EPSG:2056") {
            return new ol.tilegrid.TileGrid({
                extent: SWISSTOPO_EXTENT_2056,
                origin: SWISSTOPO_TILE_ORIGIN,
                resolutions: SWISSTOPO_RESOLUTIONS,
                tileSize: 256,
            });
        }
        return super._buildXyzTileGrid(srcProjCode, srcProj, background);
    },
});

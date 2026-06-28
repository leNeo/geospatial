/** @odoo-module */

/* global ol, console */

/**
 * Patch the GeoengineRenderer to handle multi-SRID projection correctly.
 *
 * The base OCA renderer assumes all geometry data is in EPSG:3857.
 * When geo fields use a different SRID (e.g. 2056 for Swiss LV95),
 * features display at the wrong location.
 *
 * This patch:
 * 1. Registers proj4 projections on first map render
 * 2. Reads/writes geometries with explicit projection options (via this.format)
 * 3. Switches the map view to EPSG:2056 and adds Swisstopo tile layers
 *
 * Generic geometry/SRID helpers and the draw control live in geoengine_tools.
 */

import {GeoengineRenderer} from "@base_geoengine/js/views/geoengine/geoengine_renderer/geoengine_renderer.esm";
import {onWillStart} from "@odoo/owl";
import {patch} from "@web/core/utils/patch";
import {
    ensureProjectionsRegistered,
    readGeometryWithProjection,
    writeGeometryWithProjection,
} from "@geoengine_swisstopo/js/proj4_setup.esm";
import {
    SWISSTOPO_EXTENT_2056,
    SWISSTOPO_VIEW_RESOLUTIONS,
    buildSwisstopoTileLayer,
} from "@geoengine_swisstopo/js/swisstopo_raster.esm";
import {
    getLayerSrid,
    getMainGeoFieldSrid,
    normalizeGeometryPayload,
} from "@geoengine_tools/js/geo_utils.esm";

// ---- Patch ----

patch(GeoengineRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        onWillStart(() => ensureProjectionsRegistered());
    },

    _usesSrid2056Layer() {
        const vectorLayers = this.vectorLayersStore?.vectorsLayers || [];
        return vectorLayers.some((layer) => getLayerSrid(layer, this) === 2056);
    },

    _setProjectionAwareFormat() {
        this._mapProj = this.map.getView().getProjection();

        // Replace this.format with a projection-aware wrapper
        // that the existing modifyend handler (createEditControl) and the
        // geoengine_tools draw controls will use.
        const dataSrid = this._dataSrid;
        const mapProj = this._mapProj;
        this.format = {
            readGeometry(geojson) {
                return readGeometryWithProjection(geojson, dataSrid, mapProj);
            },
            writeGeometry(geometry) {
                return writeGeometryWithProjection(geometry, dataSrid, mapProj);
            },
        };
    },

    async _ensureProjectionAwareMapView() {
        await ensureProjectionsRegistered();
        if (!this.map) {
            return;
        }

        this._dataSrid = getMainGeoFieldSrid(this);
        const shouldUse2056View =
            this._dataSrid === 2056 || this._usesSrid2056Layer();

        if (shouldUse2056View) {
            const proj2056 = ol.proj.get("EPSG:2056");
            if (!proj2056) {
                console.warn(
                    "geoengine_swisstopo: EPSG:2056 projection is not registered"
                );
                this._setProjectionAwareFormat();
                return;
            }
            proj2056.setExtent(SWISSTOPO_EXTENT_2056);

            const currentProjection = this.map
                .getView()
                ?.getProjection?.()
                ?.getCode?.();
            if (currentProjection !== "EPSG:2056") {
                this.map.setView(
                    new ol.View({
                        projection: proj2056,
                        resolutions: SWISSTOPO_VIEW_RESOLUTIONS,
                        // maxZoom is NOT derived from resolutions.length in OL;
                        // without this it stays at the default (28) and the
                        // finest resolution levels are unreachable.
                        maxZoom: SWISSTOPO_VIEW_RESOLUTIONS.length - 1,
                        center: ol.extent.getCenter(SWISSTOPO_EXTENT_2056),
                        zoom: 16,
                        extent: SWISSTOPO_EXTENT_2056,
                    })
                );
            }

            // Add Swisstopo tile layers AFTER the view is in 2056.
            // They can't be created in createBackgroundLayers because
            // the view is still in 3857 at that point.
            this._addSwisstopoRasterLayers();
        }

        this._setProjectionAwareFormat();
    },

    renderMap() {
        const result = super.renderMap(...arguments);
        if (this.map) {
            this._ensureProjectionAwareMapView().catch((error) => {
                console.warn(
                    "geoengine_swisstopo: failed to initialize map projection",
                    error
                );
            });
        }
        return result;
    },

    async renderVectorLayers() {
        await ensureProjectionsRegistered();
        if (!this.map) {
            await this.renderMap();
        }
        if (this.map) {
            await this._ensureProjectionAwareMapView();
        }
        return await super.renderVectorLayers(...arguments);
    },

    /**
     * Swisstopo rasters are added later in EPSG:2056 (see
     * _addSwisstopoRasterLayers). Everything else is delegated to super so the
     * patch chain keeps working — in particular the xyz_tiles handling added by
     * geoengine_drone_ortho. base_geoengine already handles osm/wmts/d_wms, so
     * there is no need to re-implement them here (doing so without calling
     * super would shadow downstream patches depending on the patch order).
     */
    createBackgroundLayers(backgrounds) {
        const nonSwisstopo = backgrounds.filter(
            (bg) => bg.raster_type !== "swisstopo"
        );
        return super.createBackgroundLayers(nonSwisstopo);
    },

    /**
     * Add Swisstopo tile layers from raster store records.
     * Called AFTER the view is switched to EPSG:2056 so that
     * the tile grid and extent are correctly resolved.
     */
    _addSwisstopoRasterLayers() {
        if (this._swisstopoLayersAdded) {
            return;
        }
        this._swisstopoLayersAdded = true;

        const rasters = this.rasterLayersStore?.rastersLayers || [];
        const swisstopoRasters = rasters.filter((r) => r.raster_type === "swisstopo");

        if (swisstopoRasters.length === 0) {
            return;
        }

        const layers = this.map.getLayers();
        for (const raster of swisstopoRasters) {
            const tileLayer = buildSwisstopoTileLayer(
                raster.swisstopo_layer_name || "ch.swisstopo.pixelkarte-farbe",
                "jpeg"
            );
            tileLayer.set("title", raster.name);
            tileLayer.setVisible(!raster.overlay);
            tileLayer.setOpacity(raster.opacity ?? 1.0);
            // Insert at position 0 (below all other layers)
            layers.insertAt(0, tileLayer);
        }
    },

    /**
     * Read geometry features with the correct data projection.
     * Also normalizes Polygon → MultiPolygon when the field expects it.
     */
    addFeatureToSource(data, cfg, vectorSource) {
        ensureProjectionsRegistered();
        const srid = getLayerSrid(cfg, this);
        const mapProj = this.map.getView().getProjection();

        // Determine expected geo_type for normalization
        const fieldName = cfg.geo_field_id?.[1];
        const expectedGeoType =
            this.props?.data?.fields?.[fieldName]?.geo_type?.geo_type;

        data.forEach((item) => {
            const sourceValues =
                item._values === undefined
                    ? Object.assign({}, item || {})
                    : Object.assign({}, item._values || {});
            const attributes = Object.assign({}, sourceValues);
            this.geometryFields.forEach((geo_field) => delete attributes[geo_field]);

            if (cfg.display_polygon_labels === true && cfg.attribute_field_id) {
                attributes.label = sourceValues[cfg.attribute_field_id[1]];
            } else {
                attributes.label = "";
            }
            attributes.color = cfg.begin_color;

            const rawGeometry = sourceValues[cfg.geo_field_id[1]];
            const geometryValue = normalizeGeometryPayload(
                rawGeometry,
                expectedGeoType
            );

            if (!geometryValue) {
                return;
            }

            try {
                // Explicit projection transform via readGeometry options
                const geometry = readGeometryWithProjection(
                    geometryValue,
                    srid,
                    mapProj
                );
                const feature = new ol.Feature({
                    geometry,
                    attributes,
                    model: cfg.model,
                });
                feature.setId(item.resId);
                vectorSource.addFeature(feature);
            } catch (error) {
                console.warn(
                    "geoengine_swisstopo: skipped invalid geometry for record",
                    item?.resId,
                    error
                );
            }
        });
    },
});

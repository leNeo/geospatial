/** @odoo-module */

/* global ol, console */

/**
 * Generic geometry / SRID utilities shared across geoengine modules.
 *
 * Originally defined inside geoengine_swisstopo; moved here so any module
 * (swisstopo or others) can reuse them without depending on the Swiss module.
 */

const WKB_HEX_RE = /^[0-9a-fA-F]+$/;

export function isCoordinatePair(value) {
    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        typeof value[0] === "number" &&
        typeof value[1] === "number"
    );
}

/**
 * Decode a WKB hex string to a GeoJSON object using OpenLayers.
 */
export function wkbHexToGeoJSON(hexStr) {
    if (typeof ol === "undefined" || !ol.format || !ol.format.WKB) {
        return null;
    }
    try {
        const wkbFormat = new ol.format.WKB();
        const feature = wkbFormat.readFeature(hexStr);
        const olGeom = feature.getGeometry();
        const gjFormat = new ol.format.GeoJSON();
        return JSON.parse(gjFormat.writeGeometry(olGeom));
    } catch (e) {
        console.warn("geoengine_tools: failed to decode WKB hex", e);
        return null;
    }
}

/**
 * Ensure geometry payload matches the expected type.
 * Wraps Polygon into MultiPolygon when the field expects MultiPolygon.
 */
export function normalizeGeometryPayload(rawGeometry, expectedType) {
    if (!rawGeometry || expectedType !== "MultiPolygon") {
        return rawGeometry;
    }

    const wasString = typeof rawGeometry === "string";
    let geometry = rawGeometry;

    if (wasString) {
        if (WKB_HEX_RE.test(rawGeometry)) {
            geometry = wkbHexToGeoJSON(rawGeometry);
            if (!geometry) {
                return rawGeometry;
            }
        } else {
            try {
                geometry = JSON.parse(rawGeometry);
            } catch {
                return rawGeometry;
            }
        }
    }

    if (
        !geometry ||
        typeof geometry !== "object" ||
        !Array.isArray(geometry.coordinates)
    ) {
        return rawGeometry;
    }

    let normalized = geometry;

    if (geometry.type === "Polygon") {
        normalized = {
            ...geometry,
            type: "MultiPolygon",
            coordinates: [geometry.coordinates],
        };
    } else if (
        geometry.type === "MultiPolygon" &&
        Array.isArray(geometry.coordinates[0]) &&
        Array.isArray(geometry.coordinates[0][0]) &&
        isCoordinatePair(geometry.coordinates[0][0])
    ) {
        normalized = {
            ...geometry,
            coordinates: [geometry.coordinates],
        };
    }

    return wasString ? JSON.stringify(normalized) : normalized;
}

/**
 * Determine the data SRID for a given vector layer configuration.
 *
 * Priority:
 * 1. cfg.geo_field_srid — injected by Python override (if > 0)
 * 2. Field metadata from props.data.fields (works for main model)
 * 3. renderer._dataSrid — the main model's SRID (set in renderMap)
 * 4. Default: 3857
 */
export function getLayerSrid(cfg, renderer) {
    // 1. Python-injected SRID (must be > 0 to be valid)
    if (cfg.geo_field_srid && cfg.geo_field_srid !== 3857) {
        return cfg.geo_field_srid;
    }

    // 2. Field metadata from the main model's fields_get
    const fieldName =
        cfg.geo_field_id && cfg.geo_field_id[1] ? cfg.geo_field_id[1] : null;
    if (fieldName) {
        const fieldMeta = renderer.props?.data?.fields?.[fieldName];
        if (fieldMeta?.geo_type?.srid) {
            return fieldMeta.geo_type.srid;
        }
    }

    // 3. Main model's SRID (already resolved in renderMap)
    if (renderer._dataSrid && renderer._dataSrid !== 3857) {
        return renderer._dataSrid;
    }

    // 4. Python-injected SRID (even if 3857)
    if (cfg.geo_field_srid) {
        return cfg.geo_field_srid;
    }

    return 3857;
}

/**
 * Get the SRID of the main model's primary geometry field.
 */
export function getMainGeoFieldSrid(renderer) {
    const fieldName = renderer.getGeometryFieldName?.();
    if (fieldName && renderer.props?.data?.fields?.[fieldName]?.geo_type?.srid) {
        return renderer.props.data.fields[fieldName].geo_type.srid;
    }
    return 3857;
}

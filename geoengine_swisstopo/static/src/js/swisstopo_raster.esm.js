/** @odoo-module */

/* global ol */

/**
 * Configuration WMTS Swisstopo pour EPSG:2056 (CH1903+ / LV95 / MN95).
 *
 * Résolutions officielles geo.admin.ch :
 * https://api3.geo.admin.ch/services/sdiservices.html#wmts
 */

export const SWISSTOPO_RESOLUTIONS = [
    4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750,
    650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.1,
];

/**
 * Résolutions de la VUE : grille Swisstopo + niveaux de zoom supplémentaires
 * au-delà de la tuile la plus fine (0.1 m/px). Les tuiles raster sont
 * suréchantillonnées par OpenLayers, les couches vectorielles restent nettes.
 * Le palier le plus fin (0.003125 m/px) permet de zoomer très près pour
 * éditer/positionner finement la géométrie vectorielle.
 */
export const SWISSTOPO_VIEW_RESOLUTIONS = [
    ...SWISSTOPO_RESOLUTIONS,
    0.05,
    0.025,
    0.0125,
    0.00625,
    0.003125,
];

// Origine de la grille de tuiles Swisstopo (coin supérieur gauche de l'étendue LV95)
const SWISSTOPO_TILE_ORIGIN = [2420000, 1350000];

// Étendue nationale CH en LV95 / EPSG:2056
export const SWISSTOPO_EXTENT_2056 = [2420000, 1030000, 2900000, 1350000];

// Zoom max réellement servi par défaut. pixelkarte-farbe / -grau s'arrêtent au
// niveau 27 (0.25 m/px) ; demander le niveau 28 (0.1) renvoie une erreur 400.
// swissimage va plus loin : passer un maxZoom plus élevé pour ces couches.
const SWISSTOPO_DEFAULT_MAX_ZOOM = 27;

/**
 * Construit une ol.source.WMTS pour une couche Swisstopo en EPSG:2056.
 *
 * @param {String} layerName  ex: 'ch.swisstopo.pixelkarte-farbe'
 * @param {String} format     'jpeg' ou 'png' selon la couche
 * @param {Number} maxZoom    niveau de tuile le plus fin servi par la couche
 * @returns {ol.source.WMTS}
 */
export function buildSwisstopoWmtsSource(
    layerName,
    format = "jpeg",
    maxZoom = SWISSTOPO_DEFAULT_MAX_ZOOM
) {
    const projection = ol.proj.get("EPSG:2056");

    // On limite le tile grid aux niveaux réellement servis par la couche.
    // Les résolutions plus fines de la VUE restent disponibles : OpenLayers
    // sur-échantillonne les tuiles, le vecteur reste net.
    const resolutions = SWISSTOPO_RESOLUTIONS.slice(0, maxZoom + 1);
    const matrixIds = resolutions.map((_, i) => i);

    const tileGrid = new ol.tilegrid.WMTS({
        origin: SWISSTOPO_TILE_ORIGIN,
        resolutions: resolutions,
        matrixIds: matrixIds,
    });

    return new ol.source.WMTS({
        url:
            "https://wmts.geo.admin.ch/1.0.0/" +
            "{Layer}/default/current/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}." +
            format,
        layer: layerName,
        matrixSet: "2056",
        format: "image/" + format,
        projection: projection,
        tileGrid: tileGrid,
        style: "default",
        requestEncoding: "REST",
        wrapX: false,
        crossOrigin: "anonymous",
        dimensions: {},
    });
}

/**
 * Crée un ol.layer.Tile Swisstopo prêt à être ajouté à la carte.
 *
 * @param {String} layerName
 * @param {String} format
 * @param {Number} maxZoom    niveau de tuile le plus fin servi par la couche
 * @returns {ol.layer.Tile}
 */
export function buildSwisstopoTileLayer(
    layerName,
    format = "jpeg",
    maxZoom = SWISSTOPO_DEFAULT_MAX_ZOOM
) {
    return new ol.layer.Tile({
        source: buildSwisstopoWmtsSource(layerName, format, maxZoom),
        extent: SWISSTOPO_EXTENT_2056,
    });
}

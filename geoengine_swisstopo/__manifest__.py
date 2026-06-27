# Copyright 2024 Camptocamp SA, Caravanes Treyvaud S.A.
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "GeoEngine - Swisstopo & Multi-Projection",
    "summary": "Adds proj4js support for non-standard SRIDs (EPSG:2056, 21781, etc.) "
    "and fixes projection handling in the geoengine map renderer.",
    "version": "19.0.1.0.0",
    "category": "GeoBI",
    "author": "Camptocamp, Caravanes Treyvaud S.A., Odoo Community Association (OCA)",
    "website": "https://github.com/OCA/geospatial",
    "license": "AGPL-3",
    "depends": ["base_geoengine", "geoengine_tools"],
    "data": [
        "views/geo_raster_layer_view.xml",
    ],
    "assets": {
        "web.assets_backend": [
            # proj4 must load before the patch so EPSG:2056 can be registered.
            "geoengine_swisstopo/static/lib/proj4js/proj4.js",
            "geoengine_swisstopo/static/src/js/**/*",
        ],
    },
    "installable": True,
}

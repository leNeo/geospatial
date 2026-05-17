# Copyright 2024 Caravanes Treyvaud S.A.
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "GeoEngine - Drone Orthophoto + Swisstopo Tile Grid",
    "summary": "Bridge module: enables Swiss LV95 (EPSG:2056) tile grid "
    "for drone orthophoto XYZ tile layers.",
    "version": "19.0.1.0.0",
    "category": "GeoBI",
    "author": "Caravanes Treyvaud S.A., Odoo Community Association (OCA)",
    "website": "https://github.com/OCA/geospatial",
    "license": "AGPL-3",
    "depends": ["geoengine_drone_ortho", "geoengine_swisstopo"],
    "auto_install": True,
    "assets": {
        "web.assets_backend": [
            "geoengine_drone_ortho_swisstopo/static/src/js/**/*",
        ],
    },
    "installable": True,
}

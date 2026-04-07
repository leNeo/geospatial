# Copyright 2024 Caravanes Treyvaud S.A.
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "GeoEngine - Drone Orthophoto Tiles",
    "summary": "Adds XYZ/TMS tile layer support for drone orthophotos "
    "and custom tile sources in GeoEngine.",
    "version": "19.0.1.0.0",
    "category": "GeoBI",
    "author": "Caravanes Treyvaud S.A., Odoo Community Association (OCA)",
    "website": "https://github.com/OCA/geospatial",
    "license": "AGPL-3",
    "depends": ["base_geoengine"],
    "data": [
        "views/geo_raster_layer_view.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "geoengine_drone_ortho/static/src/js/**/*",
        ],
    },
    "installable": True,
}

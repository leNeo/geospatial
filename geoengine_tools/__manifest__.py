# Copyright 2026 Caravanes Treyvaud S.A.
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "GeoEngine Tools",
    "summary": "Reusable draw helpers and record-level geometry editing "
    "for base_geoengine.",
    "version": "19.0.1.0.0",
    "category": "GeoBI",
    "author": "Caravanes Treyvaud S.A., Odoo Community Association (OCA)",
    "website": "https://github.com/OCA/geospatial",
    "license": "AGPL-3",
    "depends": ["base_geoengine"],
    "assets": {
        "web.assets_backend": [
            "geoengine_tools/static/src/**/*",
        ],
    },
    "installable": True,
}

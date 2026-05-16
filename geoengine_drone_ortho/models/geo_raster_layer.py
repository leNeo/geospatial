# Copyright 2024 Caravanes Treyvaud S.A.
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

from odoo import api, fields, models


class GeoRasterLayer(models.Model):
    _inherit = "geoengine.raster.layer"

    raster_type = fields.Selection(
        selection_add=[("xyz_tiles", "XYZ Tiles")],
        ondelete={"xyz_tiles": "set default"},
    )

    xyz_min_zoom = fields.Integer(
        string="Min Zoom",
        default=0,
        help="Minimum zoom level for tile requests.",
    )
    xyz_max_zoom = fields.Integer(
        string="Max Zoom",
        default=22,
        help="Maximum zoom level for tile requests. "
        "TiTiler COG tiles typically support up to 22-24.",
    )
    xyz_tile_extent = fields.Char(
        string="Tile Extent",
        help="Optional bounding box to limit tile loading area. "
        "Format: minx,miny,maxx,maxy (in tile projection coordinates).",
    )
    xyz_tile_projection = fields.Char(
        string="Tile Projection",
        default="EPSG:3857",
        help="Projection of the tiles (e.g., EPSG:3857, EPSG:4326, EPSG:2056). "
        "If different from the map projection, tiles are reprojected on-the-fly.",
    )
    xyz_cross_origin = fields.Selection(
        [
            ("anonymous", "Anonymous"),
            ("use-credentials", "Use Credentials"),
        ],
        string="Cross-Origin",
        default="anonymous",
        help="CORS setting for tile requests. Use 'anonymous' for most tile servers.",
    )

    is_xyz_tiles = fields.Boolean(compute="_compute_is_xyz_tiles")

    @api.depends("raster_type")
    def _compute_is_xyz_tiles(self):
        for rec in self:
            rec.is_xyz_tiles = rec.raster_type == "xyz_tiles"

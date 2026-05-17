Adds XYZ/TMS tile layer support to the GeoEngine map renderer,
enabling drone orthophotos and custom tile sources as raster backgrounds.

This module provides:

- New "XYZ Tiles" raster layer type for GeoEngine views
- Support for TiTiler, MapProxy, or any XYZ/TMS tile server
- Configurable zoom levels, tile extent, and projection
- On-the-fly reprojection when tile projection differs from map projection
- Extension hook ``_buildXyzTileGrid`` for companion modules to provide
  custom tile grids (e.g. Swiss LV95 — see ``geoengine_drone_ortho_swisstopo``)

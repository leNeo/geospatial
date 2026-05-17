Bridge module connecting ``geoengine_drone_ortho`` and ``geoengine_swisstopo``.

When both modules are installed, this module is auto-installed and enables
Swiss LV95 (EPSG:2056) tile grid support for XYZ tile layers:

- Uses Swisstopo's official tile origin ``[2420000, 1350000]`` and
  the WMTS resolution set from ``geoengine_swisstopo``
- Activated automatically when an XYZ tile layer is configured with
  ``Tile Projection = EPSG:2056``
- Falls back to the default WebMercator XYZ grid for all other projections

Without this bridge, drone orthophoto layers in EPSG:2056 would request
tiles using a generic XYZ grid, producing incorrect z/x/y coordinates.

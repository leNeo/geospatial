Open any GeoEngine view.

To edit the geometry of an existing record, expand it in the **Records** panel
and click the pencil button: the record switches to edit mode and you can draw
its new geometry on the map; it is saved automatically when the drawing ends.

A measure toolbox is available on the right side of the map for every user:

- **Coordinates** (crosshairs): toggle on, then move the mouse over the map to
  read the live GPS (WGS84) coordinates. In a projected CRS the native E/N
  coordinates are shown too.
- **Distance** (horizontal arrows): click to add points, double-click to
  finish; the geodesic length of the line is displayed.
- **Surface** (square): click to draw a polygon, double-click to finish; the
  geodesic area and perimeter are displayed.
- **Proximity** (compress): enter a minimum distance (e.g. 4 m); every pair of
  map objects (parcels) closer than that threshold is highlighted with the
  measured gap.
- **Copy last** (copy): copy the last measurement to the clipboard.
- **Copy all** (clipboard): copy every measurement taken to the clipboard.
- **Eraser**: clear all measurements and return to normal selection.

For developers, the module patches `GeoengineRenderer` and exposes
`startDrawInteraction`, `getGeometryFieldName` and `drawOnRecord` on the
prototype, plus generic helpers importable from
`@geoengine_tools/js/geo_utils.esm`.

Open any GeoEngine view.

To edit the geometry of an existing record, expand it in the **Records** panel
and click the pencil button: the record switches to edit mode and you can draw
its new geometry on the map; it is saved automatically when the drawing ends.

For developers, the module patches `GeoengineRenderer` and exposes
`startDrawInteraction`, `getGeometryFieldName` and `drawOnRecord` on the
prototype, plus generic helpers importable from
`@geoengine_tools/js/geo_utils.esm`.

Reusable helpers and UX extensions for the GeoEngine map renderer
(`base_geoengine`), kept out of the core module so the OCA migration stays
faithful to upstream.

This module provides:

- Reusable renderer helpers: `getGeometryFieldName()` and
  `startDrawInteraction({onDrawStart, onDrawEnd})`, a stable extension point
  for modules that need to drive the OpenLayers draw interaction.
- A draw control that writes the new geometry through `this.format`, so
  projection-aware modules (e.g. `geoengine_swisstopo`) get correct
  coordinates without re-implementing the control.
- Record-level geometry editing: a pencil button in the records list that
  lets a user redraw the geometry of an existing record (`drawOnRecord`).
- Generic geometry / SRID utilities (`geo_utils`): WKB hex decoding,
  Polygon → MultiPolygon normalization and SRID resolution helpers.
- A measure toolbox available to every user (read-only): live GPS (WGS84)
  coordinates of the mouse on hover, a distance ruler, a polygon
  surface/perimeter tool, a proximity check that flags pairs of objects closer
  than a given threshold, and clipboard export of the last / all measurements.
  Measurements are geodesic (`ol.sphere`), so they stay correct in any map
  projection (e.g. EPSG:2056 with `geoengine_swisstopo`).

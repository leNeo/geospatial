===============
GeoEngine Tools
===============

Reusable helpers and UX extensions for the GeoEngine map renderer
(``base_geoengine``), kept out of the core module so the OCA migration stays
faithful to upstream.

This module provides:

* reusable renderer helpers ``getGeometryFieldName()`` and
  ``startDrawInteraction({onDrawStart, onDrawEnd})``, a stable extension point
  to drive the OpenLayers draw interaction;
* a draw control that writes geometry through ``this.format`` so
  projection-aware modules (e.g. ``geoengine_swisstopo``) get correct
  coordinates without re-implementing the control;
* record-level geometry editing: a pencil button in the records list to
  redraw the geometry of an existing record (``drawOnRecord``);
* generic geometry / SRID utilities (``geo_utils``): WKB hex decoding,
  Polygon to MultiPolygon normalization and SRID resolution helpers.

Configuration
=============

No extra configuration is required. Install the module and the helpers become
available to ``base_geoengine`` and any module depending on it.

Usage
=====

Open a GeoEngine view. To edit the geometry of an existing record, expand it in
the **Records** panel and click the pencil button: the record switches to edit
mode, draw the new geometry on the map and it is saved when the drawing ends.

For developers, the module patches ``GeoengineRenderer`` and exposes
``startDrawInteraction``, ``getGeometryFieldName`` and ``drawOnRecord`` on the
prototype, plus generic helpers importable from
``@geoengine_tools/js/geo_utils.esm``.

License
=======

AGPL-3

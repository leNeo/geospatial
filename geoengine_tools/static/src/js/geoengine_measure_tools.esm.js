/** @odoo-module */

/* global ol */

/**
 * Measure toolbox for the GeoengineRenderer.
 *
 * Adds three read-only measurement tools (available to every user, not just
 * geoengine admins, since measuring never alters data):
 *
 *  - Coordinate readout: live GPS (WGS84) coordinates of the mouse on hover.
 *    When the map runs in a projected CRS (e.g. EPSG:2056 / CH1903+ LV95 from
 *    geoengine_swisstopo) the native E/N coordinates are shown as well.
 *  - Distance ruler: click to add points, double-click to finish; shows the
 *    geodesic length of the drawn line.
 *  - Polygon area: click to draw a polygon, double-click to finish; shows the
 *    geodesic area and perimeter.
 *
 * A "clear" button removes all measurements and restores normal selection.
 *
 * All measurements use ol.sphere (geodesic), so they stay correct in any map
 * projection without depending on the projection-aware modules.
 */

import {GeoengineRenderer} from "@base_geoengine/js/views/geoengine/geoengine_renderer/geoengine_renderer.esm";
import {patch} from "@web/core/utils/patch";

// Below this gap (in meters) two objects are considered touching/overlapping
// rather than "too close", so the proximity check ignores them (no 0.00 m noise).
const MIN_PROXIMITY_GAP = 0.01;

patch(GeoengineRenderer.prototype, {
    /**
     * Add the measure controls on top of the core controls.
     */
    setupControls() {
        super.setupControls(...arguments);
        this._setupMeasureControls();
    },

    /**
     * Tearing down the active measure tool whenever a core control
     * (draw/select/edit) takes over. The core controls all funnel through
     * addSelectedClassToButton, so this is the single hook that keeps the
     * measure tools mutually exclusive with the core interactions.
     */
    addSelectedClassToButton(button) {
        super.addSelectedClassToButton(button);
        this._deactivateMeasureTools();
    },

    /**
     * Reimplemented (vs base) only to exclude the measurement layer from the
     * select interactions. Measure geometries carry no record, so selecting
     * one would reach mountGeoengineRecord with undefined attributes and crash
     * (evaluating 'attributes.id').
     */
    registerInteraction() {
        const notMeasureLayer = (layer) => layer !== this._measureLayer;
        this.selectPointerMove = new ol.interaction.Select({
            condition: ol.events.condition.pointerMove,
            style: this.selectStyle,
            layers: notMeasureLayer,
        });
        this.selectClick = new ol.interaction.Select({
            condition: ol.events.condition.click,
            style: this.selectStyle,
            layers: notMeasureLayer,
        });
        this.selectClick.on("select", (e) => {
            this.updateInfoBox(e.target.getFeatures());
        });
        this.map.addInteraction(this.selectClick);
        this.map.addInteraction(this.selectPointerMove);
    },

    /**
     * Safety net: ignore features without "attributes" (e.g. measurement
     * geometries) so they never reach mountGeoengineRecord.
     */
    updateInfoBox(features) {
        const feature = features.item(0);
        if (feature !== undefined && feature.get("attributes") === undefined) {
            this.hidePopup();
            return;
        }
        return super.updateInfoBox(...arguments);
    },

    // ---- Setup ----------------------------------------------------------

    _setupMeasureControls() {
        if (this._measureLayer) {
            return;
        }
        this._measureTooltips = [];
        this._measureButtons = [];
        this._activeMeasureType = null;
        // Plain-text record of every measurement taken (for clipboard export).
        this._measureResults = [];

        // Vector layer holding the finished measurement geometries.
        this._measureSource = new ol.source.Vector();
        this._measureLayer = new ol.layer.Vector({
            source: this._measureSource,
            zIndex: 10000,
            style: this._measureStyle(),
        });
        this.map.addLayer(this._measureLayer);

        // Live coordinate readout box.
        this._coordBox = document.createElement("div");
        this._coordBox.className = "geoengine-coord-box ol-unselectable";
        this._coordBox.style.display = "none";
        const coordControl = new ol.control.Control({element: this._coordBox});
        this.map.addControl(coordControl);

        // Toolbar buttons.
        this._createMeasureControl(
            "fa-crosshairs",
            "geoengine-measure-coord-control ol-unselectable ol-control",
            "Coordonnées GPS (survol)",
            (button) => this._toggleCoordinateReadout(button)
        );
        this._createMeasureControl(
            "fa-arrows-h",
            "geoengine-measure-distance-control ol-unselectable ol-control",
            "Mesurer une distance",
            (button) => this._startMeasure("LineString", button)
        );
        this._createMeasureControl(
            "fa-square-o",
            "geoengine-measure-area-control ol-unselectable ol-control",
            "Mesurer une surface / un périmètre",
            (button) => this._startMeasure("Polygon", button)
        );
        this._createMeasureControl(
            "fa-compress",
            "geoengine-measure-proximity-control ol-unselectable ol-control",
            "Contrôler la distance minimale entre objets",
            () => this._checkProximity()
        );
        this._createMeasureControl(
            "fa-copy",
            "geoengine-measure-copy-last-control ol-unselectable ol-control",
            "Copier la dernière mesure",
            () => this._copyLast()
        );
        this._createMeasureControl(
            "fa-clipboard",
            "geoengine-measure-copy-all-control ol-unselectable ol-control",
            "Copier toutes les mesures",
            () => this._copyAll()
        );
        this._createMeasureControl(
            "fa-eraser",
            "geoengine-measure-clear-control ol-unselectable ol-control",
            "Effacer les mesures",
            () => this._clearMeasures()
        );
    },

    _createMeasureControl(iconClass, className, title, onClick) {
        const {element, button} = this.createHtmlControl(
            `<i class="fa ${iconClass}"></i>`,
            className
        );
        button.setAttribute("title", title);
        button.setAttribute("type", "button");
        button.addEventListener("click", () => onClick(button));
        this.map.addControl(new ol.control.Control({element}));
        this._measureButtons.push(button);
        return button;
    },

    // ---- Coordinate readout --------------------------------------------

    _toggleCoordinateReadout(button) {
        if (this._coordActive) {
            this._coordActive = false;
            this.map.un("pointermove", this._coordHandler);
            button.classList.remove("geoengine-coord-active");
            this._coordBox.style.display = "none";
            return;
        }
        this._coordActive = true;
        button.classList.add("geoengine-coord-active");
        this._coordBox.style.display = "block";
        this._coordBox.textContent = "—";
        this._coordHandler = (evt) => this._updateCoordReadout(evt.coordinate);
        this.map.on("pointermove", this._coordHandler);
    },

    _updateCoordReadout(coordinate) {
        const proj = this.map.getView().getProjection();
        const code = proj.getCode();
        let html = "";
        try {
            const lonLat = ol.proj.transform(coordinate, proj, "EPSG:4326");
            html = `GPS (WGS84) : ${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`;
        } catch {
            html = "GPS : indisponible";
        }
        // When the map is in a projected CRS, also show native E/N coordinates.
        if (code !== "EPSG:4326" && code !== "EPSG:3857") {
            html += ` &nbsp;|&nbsp; ${code} : E ${coordinate[0].toFixed(
                2
            )} N ${coordinate[1].toFixed(2)}`;
        }
        this._coordBox.innerHTML = html;
    },

    // ---- Distance / area measurement -----------------------------------

    _startMeasure(type, button) {
        // Toggle off if the same tool is clicked again.
        if (this._activeMeasureType === type) {
            this._deactivateMeasureTools();
            this._restoreSelection();
            return;
        }

        // Clear core interactions so clicks only feed the measure tool.
        this.hidePopup();
        this.removeDrawInteraction();
        this.removeModifyInteraction();
        this.removeSelectInteraction();
        this._removeMeasureDraw();

        this._highlightMeasureButton(button);
        this._activeMeasureType = type;

        const draw = new ol.interaction.Draw({
            source: this._measureSource,
            type,
            style: this._measureStyle(true),
        });
        this._measureDraw = draw;
        this.map.addInteraction(draw);

        let tooltip = null;
        let tooltipEl = null;
        let changeKey = null;

        draw.on("drawstart", (evt) => {
            const geom = evt.feature.getGeometry();
            ({tooltip, tooltipEl} = this._createMeasureTooltip());
            changeKey = geom.on("change", (e) => {
                const g = e.target;
                if (g instanceof ol.geom.Polygon) {
                    tooltipEl.innerHTML = this._formatArea(g);
                    tooltip.setPosition(g.getInteriorPoint().getCoordinates());
                } else {
                    tooltipEl.innerHTML = this._formatLength(g);
                    tooltip.setPosition(g.getLastCoordinate());
                }
            });
        });

        draw.on("drawend", (evt) => {
            if (tooltipEl) {
                tooltipEl.className =
                    "geoengine-measure-tooltip geoengine-measure-tooltip-static";
                tooltip.setOffset([0, -7]);
            }
            if (changeKey) {
                ol.Observable.unByKey(changeKey);
            }
            this._recordMeasureResult(evt.feature.getGeometry());
            tooltip = null;
            tooltipEl = null;
            changeKey = null;
        });
    },

    _createMeasureTooltip() {
        const el = document.createElement("div");
        el.className = "geoengine-measure-tooltip geoengine-measure-tooltip-measuring";
        const tooltip = new ol.Overlay({
            element: el,
            offset: [0, -15],
            positioning: "bottom-center",
            stopEvent: false,
            insertFirst: false,
        });
        this.map.addOverlay(tooltip);
        this._measureTooltips.push(tooltip);
        return {tooltip, tooltipEl: el};
    },

    _distText(meters) {
        if (meters > 1000) {
            return `${(meters / 1000).toFixed(3)} km`;
        }
        return `${meters.toFixed(2)} m`;
    },

    _areaText(squareMeters) {
        if (squareMeters > 10000) {
            return `${(squareMeters / 1000000).toFixed(4)} km² (${(
                squareMeters / 10000
            ).toFixed(2)} ha)`;
        }
        return `${squareMeters.toFixed(2)} m²`;
    },

    _formatLength(line) {
        return this._distText(
            ol.sphere.getLength(line, {projection: this.map.getView().getProjection()})
        );
    },

    _formatArea(polygon) {
        const projection = this.map.getView().getProjection();
        const area = this._areaText(ol.sphere.getArea(polygon, {projection}));
        const perimeter = this._distText(ol.sphere.getLength(polygon, {projection}));
        return `Surface : ${area}<br/>Périmètre : ${perimeter}`;
    },

    /**
     * Store a plain-text summary of a finished measurement so it can later be
     * copied to the clipboard.
     */
    _recordMeasureResult(geom) {
        const projection = this.map.getView().getProjection();
        let text = "";
        if (geom instanceof ol.geom.Polygon) {
            const area = this._areaText(ol.sphere.getArea(geom, {projection}));
            const perimeter = this._distText(ol.sphere.getLength(geom, {projection}));
            text = `Surface : ${area} | Périmètre : ${perimeter}`;
        } else {
            text = `Distance : ${this._distText(
                ol.sphere.getLength(geom, {projection})
            )}`;
        }
        this._measureResults.push(text);
    },

    // ---- Clipboard export ----------------------------------------------

    _copyLast() {
        if (!this._measureResults || this._measureResults.length === 0) {
            this._notify("Aucune mesure à copier.", "warning");
            return;
        }
        this._copyText(this._measureResults[this._measureResults.length - 1]);
    },

    _copyAll() {
        if (!this._measureResults || this._measureResults.length === 0) {
            this._notify("Aucune mesure à copier.", "warning");
            return;
        }
        this._copyText(this._measureResults.join("\n"));
    },

    async _copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            this._notify("Copié dans le presse-papier.");
        } catch {
            this._notify("Échec de la copie dans le presse-papier.", "danger");
        }
    },

    _notify(message, type = "success") {
        const notif = this.env && this.env.services && this.env.services.notification;
        if (notif) {
            notif.add(message, {type});
        }
    },

    // ---- Proximity check between objects --------------------------------

    /**
     * Ask for a minimum distance and highlight every pair of map objects
     * (e.g. parcels) closer than that threshold, with the measured gap.
     */
    _checkProximity() {
        // eslint-disable-next-line no-alert
        const input = window.prompt("Distance minimale entre objets (m) :", "4");
        if (input === null) {
            return;
        }
        const threshold = parseFloat(String(input).replace(",", "."));
        if (!(threshold > 0)) {
            this._notify("Valeur invalide.", "warning");
            return;
        }

        const features = this._getMeasurableFeatures();
        if (features.length < 2) {
            this._notify("Pas assez d'objets sur la carte.", "warning");
            return;
        }

        const projection = this.map.getView().getProjection();
        let count = 0;

        for (let i = 0; i < features.length; i++) {
            const a = features[i].getGeometry();
            const extA = a.getExtent();
            for (let j = i + 1; j < features.length; j++) {
                const b = features[j].getGeometry();
                // Generous bbox pre-filter (map units ≈ meters) to skip far pairs.
                if (
                    !ol.extent.intersects(
                        ol.extent.buffer(extA, threshold * 5),
                        b.getExtent()
                    )
                ) {
                    continue;
                }
                const res = this._minDistanceBetween(a, b, projection);
                // Skip touching/overlapping objects (adjacent parcels share a
                // border → gap ≈ 0): those are not a real "too close" spacing.
                if (res.distance < MIN_PROXIMITY_GAP || res.distance >= threshold) {
                    continue;
                }
                count++;
                this._measureSource.addFeature(
                    new ol.Feature(new ol.geom.LineString([res.from, res.to]))
                );
                const mid = [
                    (res.from[0] + res.to[0]) / 2,
                    (res.from[1] + res.to[1]) / 2,
                ];
                const {tooltip, tooltipEl} = this._createMeasureTooltip();
                tooltipEl.className =
                    "geoengine-measure-tooltip geoengine-measure-tooltip-static";
                tooltipEl.innerHTML = this._distText(res.distance);
                tooltip.setOffset([0, -7]);
                tooltip.setPosition(mid);

                const idA = features[i].getId() ?? "?";
                const idB = features[j].getId() ?? "?";
                this._measureResults.push(
                    `Proximité ${idA} ↔ ${idB} : ${this._distText(res.distance)}`
                );
            }
        }

        if (count === 0) {
            this._notify(`Aucune distance inférieure à ${threshold} m.`, "info");
        } else {
            this._notify(`${count} distance(s) inférieure(s) à ${threshold} m.`);
        }
    },

    /**
     * Collect every feature with a geometry from the "Overlays" vector layers
     * (the measurement layer is separate, so it is never included).
     */
    _getMeasurableFeatures() {
        const features = [];
        const seen = new Set();
        const group = this.map
            .getLayers()
            .getArray()
            .find((l) => l.get("title") === "Overlays");
        if (!group || !group.getLayers) {
            return features;
        }
        group
            .getLayers()
            .getArray()
            .forEach((layer) => {
                const src = layer.getSource && layer.getSource();
                if (src && src.getFeatures) {
                    src.getFeatures().forEach((f) => {
                        if (!f.getGeometry()) {
                            return;
                        }
                        // Dedupe the same object rendered in several layers
                        // (would otherwise produce a 0 m self-pair).
                        const id = f.getId();
                        if (id !== undefined && seen.has(id)) {
                            return;
                        }
                        if (id !== undefined) {
                            seen.add(id);
                        }
                        features.push(f);
                    });
                }
            });
        return features;
    },

    /**
     * Minimum geodesic distance between two geometries. The minimum is always
     * realized at a vertex of one geometry and its closest point on the other,
     * so sampling all vertices both ways gives the exact gap.
     */
    _minDistanceBetween(a, b, projection) {
        let best = {distance: Infinity, from: null, to: null};
        for (const p of this._verticesOf(a)) {
            const c = b.getClosestPoint(p);
            const d = this._geodesicDistance(p, c, projection);
            if (d < best.distance) {
                best = {distance: d, from: p, to: c};
            }
        }
        for (const p of this._verticesOf(b)) {
            const c = a.getClosestPoint(p);
            const d = this._geodesicDistance(p, c, projection);
            if (d < best.distance) {
                best = {distance: d, from: c, to: p};
            }
        }
        return best;
    },

    _verticesOf(geom) {
        const flat = geom.getFlatCoordinates();
        const stride = geom.getStride();
        const out = [];
        for (let i = 0; i + 1 < flat.length; i += stride) {
            out.push([flat[i], flat[i + 1]]);
        }
        return out;
    },

    _geodesicDistance(a, b, projection) {
        return ol.sphere.getLength(new ol.geom.LineString([a, b]), {projection});
    },

    // ---- Teardown helpers ----------------------------------------------

    _highlightMeasureButton(button) {
        document
            .querySelectorAll(".selected-control")
            .forEach((el) => el.classList.remove("selected-control"));
        button.classList.add("selected-control");
    },

    _removeMeasureDraw() {
        if (this._measureDraw) {
            this.map.removeInteraction(this._measureDraw);
            this._measureDraw = undefined;
        }
    },

    _deactivateMeasureTools() {
        this._removeMeasureDraw();
        this._activeMeasureType = null;
        if (this._measureButtons) {
            this._measureButtons.forEach((b) => b.classList.remove("selected-control"));
        }
    },

    _restoreSelection() {
        if (
            this.selectClick === undefined &&
            this.drawInteraction === undefined &&
            this.modifyInteraction === undefined
        ) {
            this.registerInteraction();
        }
    },

    _clearMeasures() {
        if (this._measureSource) {
            this._measureSource.clear();
        }
        if (this._measureTooltips) {
            this._measureTooltips.forEach((t) => this.map.removeOverlay(t));
            this._measureTooltips = [];
        }
        this._measureResults = [];
        this._deactivateMeasureTools();
        this._restoreSelection();
    },

    // ---- Styling --------------------------------------------------------

    _measureStyle(drawing = false) {
        return new ol.style.Style({
            fill: new ol.style.Fill({color: "rgba(113, 99, 158, 0.2)"}),
            stroke: new ol.style.Stroke({
                color: "#71639e",
                lineDash: drawing ? [8, 8] : undefined,
                width: 2,
            }),
            image: new ol.style.Circle({
                radius: 5,
                fill: new ol.style.Fill({color: "#71639e"}),
                stroke: new ol.style.Stroke({color: "#ffffff", width: 1.5}),
            }),
        });
    },
});

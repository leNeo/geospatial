/** @odoo-module */

/* global ol */

/**
 * Reusable geometry-draw helpers for the GeoengineRenderer.
 *
 * These helpers existed in the unmerged 19.0 migration proposal (OCA#446)
 * but are NOT part of the merged OCA base_geoengine (faithful to 18.0).
 * They are provided here so that downstream modules (geoengine_swisstopo,
 * the record-level edit button, ...) can rely on a stable extension point
 * without patching base_geoengine itself.
 *
 * - getGeometryFieldName(): name of the model's geometry field
 * - startDrawInteraction({onDrawStart, onDrawEnd}): reusable draw interaction,
 *   forwards the geometry field name (key) to onDrawEnd(ev, key)
 * - drawOnRecord(record): redraw the geometry of an existing record from the
 *   records list (switch to edit mode, draw, save on draw end)
 */

import {GeoengineRenderer} from "@base_geoengine/js/views/geoengine/geoengine_renderer/geoengine_renderer.esm";
import {patch} from "@web/core/utils/patch";

patch(GeoengineRenderer.prototype, {
    /**
     * Return the name of the model's geometry field.
     */
    getGeometryFieldName() {
        return Object.keys(this.props.data.fields).find(
            (el) => this.props.data.fields[el].geo_type !== undefined
        );
    },

    /**
     * Create and register a draw interaction on the model's geometry field.
     * The geometry field name (key) is forwarded to the onDrawEnd callback so
     * that callers can persist the drawn geometry on the right field.
     */
    startDrawInteraction({onDrawStart, onDrawEnd}) {
        if (this.drawInteraction !== undefined) {
            return;
        }
        const key = this.getGeometryFieldName();
        if (!key) {
            return;
        }
        this.drawInteraction = new ol.interaction.Draw({
            type: this.props.data.fields[key].geo_type.geo_type,
            source: new ol.source.Vector(),
        });
        this.map.addInteraction(this.drawInteraction);
        this.drawInteraction.on("drawstart", () => {
            if (onDrawStart) {
                onDrawStart();
            }
        });
        this.drawInteraction.on("drawend", async (ev) => {
            this.removeDrawInteraction();
            await onDrawEnd(ev, key);
        });
    },

    /**
     * Redraw the geometry of an existing record straight from the records
     * list: switch the record to edit mode, start a draw interaction and
     * save the new geometry on draw end. Uses this.format so the geometry is
     * written in the correct projection (projection-aware downstream modules
     * such as geoengine_swisstopo replace this.format).
     */
    async drawOnRecord(record) {
        const rec =
            this.props.data.records.find((val) => val.resId === record.resId) ||
            record;
        if (!rec) {
            return;
        }
        this.hidePopup();
        this.removeDrawInteraction();
        this.removeModifyInteraction();
        this.removeSelectInteraction();
        if (this.props.data.editedRecord !== undefined) {
            await this.props.onClickDiscard();
        }
        await rec.switchMode("edit");
        if (!this.getGeometryFieldName()) {
            return;
        }
        this.startDrawInteraction({
            onDrawStart: () => this.props.onDrawStart(),
            onDrawEnd: async (ev, key) => {
                this.state.isModified = true;
                const value = this.format.writeGeometry(ev.feature.getGeometry());
                await rec.update({[key]: value});
                await rec.save();
                this.state.isModified = false;
            },
        });
    },

    /**
     * Draw control (toolbar pencil) to create a new record's geometry.
     * Overrides the core inline version to reuse startDrawInteraction and to
     * write the geometry through this.format. Projection-aware downstream
     * modules (geoengine_swisstopo) replace this.format, so the drawn geometry
     * is stored in the correct data SRID without re-implementing this control.
     */
    createDrawControl() {
        const {element, button} = this.createHtmlControl(
            '<i class="fa fa-pencil"></i>',
            "draw-control ol-unselectable ol-control"
        );
        button.addEventListener("click", () => {
            this.hidePopup();
            this.addSelectedClassToButton(button);
            this.removeModifyInteraction();
            this.removeSelectInteraction();
            if (this.props.data.editedRecord !== undefined) {
                this.props.onClickDiscard();
            }
            this.startDrawInteraction({
                onDrawStart: () => this.props.onDrawStart(),
                onDrawEnd: (ev, key) => {
                    this.props.createRecord(
                        this.props.data.resModel,
                        key,
                        this.format.writeGeometry(ev.feature.getGeometry())
                    );
                },
            });
        });

        const DrawControl = new ol.control.Control({
            element: element,
        });
        this.map.addControl(DrawControl);
    },
});

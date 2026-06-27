/** @odoo-module */

/**
 * Allow the RecordsPanel to receive the drawOnRecord callback (bound by the
 * GeoengineRenderer template extension). Kept optional so the panel still
 * works if the callback is not provided.
 */

import {RecordsPanel} from "@base_geoengine/js/views/geoengine/records_panel/records_panel.esm";

RecordsPanel.props = {
    ...RecordsPanel.props,
    drawOnRecord: {type: Function, optional: true},
};

// Copyright 2026 Camptocamp SA
// License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).

import {Component, xml} from "@odoo/owl";
import {
    contains,
    defineModels,
    fields,
    makeMockEnv,
    models,
    mountView,
    mountWithCleanup,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";
import {describe, expect, test} from "@odoo/hoot";
import {MainComponentsContainer} from "@web/core/main_components_container";
import {geoengineView} from "@base_geoengine/js/views/geoengine/geoengine_view.esm";

class GeoTest extends models.Model {
    _name = "geo.test";

    name = fields.Char();

    _records = [{id: 1, name: "Test location"}];
}

class OpenRecordRenderer extends Component {
    static props = ["*"];
    static template = xml`
        <button class="o_test_open_record" t-on-click="openRecord">Open record</button>
    `;

    openRecord() {
        return this.props.openRecord("geo.test", 1);
    }
}

defineModels([GeoTest]);
describe.current.tags("desktop");

test("editable GeoEngine view opens an editable form dialog and refreshes on close", async () => {
    let loadCount = 0;
    onRpc("geo.test", "web_search_read", () => {
        loadCount++;
    });
    patchWithCleanup(geoengineView, {Renderer: OpenRecordRenderer});

    const env = await makeMockEnv();
    await mountWithCleanup(MainComponentsContainer, {env});
    await mountView({
        env,
        type: "geoengine",
        resModel: "geo.test",
        arch: `
            <geoengine editable="1">
                <field name="name"/>
                <templates>
                    <t t-name="info_box"><field name="name"/></t>
                </templates>
            </geoengine>`,
        archs: {
            "form,false": `<form><field name="name"/></form>`,
        },
    });
    const initialLoadCount = loadCount;

    await contains(".o_test_open_record").click();
    expect(".modal .o_form_view .o_field_widget[name='name'] input").toHaveCount(1);

    await contains(".modal .o_form_button_cancel").click();
    expect(loadCount).toBeGreaterThan(initialLoadCount);
});
